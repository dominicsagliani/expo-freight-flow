CREATE OR REPLACE FUNCTION public.event_freight_status(_event uuid)
RETURNS TABLE(
  freight_id uuid,
  freight_code text,
  exhibitor_id uuid,
  exhibitor_name text,
  booth_number text,
  description text,
  arrival_status arrival_status,
  created_at timestamptz
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT public.can_view_event_status(_event) THEN
    RAISE EXCEPTION 'You do not have access to this event';
  END IF;
  RETURN QUERY
  SELECT f.id, f.freight_code, x.id, x.company_name, f.booth_number,
    f.description, f.arrival_status, f.created_at
  FROM public.freight_items f
  JOIN public.exhibitors x ON x.id = f.exhibitor_id
  WHERE f.event_id = _event
  ORDER BY x.company_name, f.booth_number, f.created_at, f.freight_code;
END $$;

CREATE OR REPLACE FUNCTION public.freight_chain_of_custody(_freight uuid)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  f public.freight_items%ROWTYPE;
  b public.bills_of_lading%ROWTYPE;
  v_staff boolean;
  v_events jsonb;
BEGIN
  SELECT * INTO f FROM public.freight_items WHERE id = _freight;
  IF f.id IS NULL OR auth.uid() IS NULL OR NOT (
    public.is_org_staff(f.organization_id)
    OR f.exhibitor_id IN (SELECT public.user_exhibitor_ids())
    OR f.id IN (SELECT public.operator_freight_ids())
    OR public.can_view_event_status(f.event_id)
  ) THEN
    RAISE EXCEPTION 'Freight not found or access denied';
  END IF;

  v_staff := public.is_org_staff(f.organization_id);
  SELECT * INTO b FROM public.bills_of_lading WHERE id = f.bol_id;

  WITH history AS (
    -- Receiving is anchored to the actual arrival/check-in record.
    SELECT
      f.id::text || '-received' AS id,
      COALESCE(f.arrived_at, b.created_at, f.created_at) AS occurred_at,
      'received'::text AS kind,
      CASE WHEN f.arrived_at IS NOT NULL THEN 'Received at dock' ELSE 'Freight registered' END AS title,
      NULLIF(concat_ws(' · ',
        NULLIF(b.carrier_name, ''),
        CASE WHEN NULLIF(b.pro_number, '') IS NOT NULL THEN 'PRO ' || b.pro_number END,
        CASE WHEN b.id IS NOT NULL THEN 'Bill of lading checked in' ELSE 'Manual freight registration' END
      ), '') AS description,
      COALESCE(NULLIF((SELECT p.full_name FROM public.profiles p WHERE p.id = b.received_by), ''), 'Receiving staff') AS actor_name,
      'Receiving dock'::text AS location,
      NULL::uuid AS ticket_id,
      NULL::text AS ticket_number,
      '[]'::jsonb AS photos

    UNION ALL
    SELECT
      'staging-' || s.id::text,
      s.staged_at,
      'staging',
      'Staged in ' || s.area,
      NULLIF(concat_ws(' · ', NULLIF(s.location_note, ''), CASE WHEN NULLIF(s.landmark, '') IS NOT NULL THEN 'Near ' || s.landmark END), ''),
      COALESCE(NULLIF((SELECT p.full_name FROM public.profiles p WHERE p.id = s.staged_by), ''), CASE WHEN v_staff THEN s.staged_by_name END, 'Warehouse staff'),
      s.area,
      NULL,
      NULL,
      CASE WHEN s.photo_path IS NULL THEN '[]'::jsonb ELSE jsonb_build_array(jsonb_build_object('id', s.id, 'bucket', 'freight-issue-photos', 'path', s.photo_path)) END
    FROM public.freight_staging s
    WHERE s.freight_id = f.id

    UNION ALL
    SELECT
      'job-' || tf.ticket_id::text,
      tf.created_at,
      'dispatch',
      'Added to delivery job ' || t.ticket_number,
      NULLIF(concat_ws(' · ', initcap(t.priority::text) || ' priority', t.destination), ''),
      'Dispatch',
      t.destination,
      t.id,
      t.ticket_number,
      '[]'::jsonb
    FROM public.ticket_freight tf
    JOIN public.tickets t ON t.id = tf.ticket_id
    WHERE tf.freight_id = f.id

    UNION ALL
    SELECT
      'assignment-' || ja.id::text,
      ja.assigned_at,
      'assignment',
      'Assigned to ' || COALESCE(o.full_name, 'forklift driver'),
      NULLIF(e.unit_number, ''),
      COALESCE(o.full_name, 'Driver'),
      NULL,
      t.id,
      t.ticket_number,
      '[]'::jsonb
    FROM public.ticket_freight tf
    JOIN public.tickets t ON t.id = tf.ticket_id
    JOIN public.job_assignments ja ON ja.ticket_id = tf.ticket_id
    LEFT JOIN public.operators o ON o.id = ja.operator_id
    LEFT JOIN public.equipment e ON e.id = ja.equipment_id
    WHERE tf.freight_id = f.id

    UNION ALL
    SELECT
      'pickup-' || tf.ticket_id::text,
      tf.picked_up_at,
      'pickup',
      'Picked up on forks',
      NULLIF(concat_ws(' · ', e.unit_number, 'Job ' || t.ticket_number), ''),
      COALESCE(o.full_name, 'Forklift operator'),
      NULL,
      t.id,
      t.ticket_number,
      '[]'::jsonb
    FROM public.ticket_freight tf
    JOIN public.tickets t ON t.id = tf.ticket_id
    LEFT JOIN public.work_sessions ws ON ws.id = tf.picked_up_session_id
    LEFT JOIN public.operators o ON o.id = ws.operator_id
    LEFT JOIN public.equipment e ON e.id = ws.equipment_id
    WHERE tf.freight_id = f.id AND tf.picked_up_at IS NOT NULL

    UNION ALL
    SELECT
      'delivery-' || tf.ticket_id::text,
      tf.delivered_at,
      'delivery',
      'Delivered to booth ' || COALESCE(f.booth_number, t.booth_number, '—'),
      NULLIF(concat_ws(' · ', e.unit_number,
        CASE WHEN tf.booth_verified THEN 'Booth verified' END,
        CASE WHEN tf.flag = 'damaged' THEN 'Reported damaged' WHEN tf.flag = 'missing' THEN 'Reported missing pieces' END
      ), ''),
      COALESCE(o.full_name, 'Forklift operator'),
      'Booth ' || COALESCE(f.booth_number, t.booth_number, '—'),
      t.id,
      t.ticket_number,
      COALESCE((
        SELECT jsonb_agg(jsonb_build_object('id', p.id, 'bucket', 'ticket-photos', 'path', p.storage_path) ORDER BY p.created_at)
        FROM public.ticket_photos p
        WHERE p.ticket_id = tf.ticket_id AND (
          p.freight_id = f.id OR p.delivery_update_id IN (
            SELECT du.id FROM public.delivery_updates du WHERE du.ticket_id = tf.ticket_id AND du.freight_id = f.id
          )
        )
      ), '[]'::jsonb)
    FROM public.ticket_freight tf
    JOIN public.tickets t ON t.id = tf.ticket_id
    LEFT JOIN public.work_sessions ws ON ws.id = tf.delivered_session_id
    LEFT JOIN public.operators o ON o.id = ws.operator_id
    LEFT JOIN public.equipment e ON e.id = ws.equipment_id
    WHERE tf.freight_id = f.id AND tf.delivered_at IS NOT NULL

    UNION ALL
    SELECT
      'update-' || du.id::text,
      du.created_at,
      CASE WHEN du.kind IN ('issue', 'exception') THEN 'issue' ELSE 'note' END,
      CASE du.kind
        WHEN 'in_transit' THEN 'In transit'
        WHEN 'at_booth' THEN 'Arrived at booth'
        WHEN 'issue' THEN 'Issue: ' || initcap(replace(COALESCE(du.issue_type, 'other'), '_', ' '))
        WHEN 'exception' THEN 'Delivery exception'
        ELSE 'Delivery note'
      END,
      du.note,
      COALESCE(NULLIF((SELECT p.full_name FROM public.profiles p WHERE p.id = du.created_by), ''), 'Operations staff'),
      du.location,
      t.id,
      t.ticket_number,
      COALESCE((
        SELECT jsonb_agg(jsonb_build_object('id', p.id, 'bucket', 'ticket-photos', 'path', p.storage_path) ORDER BY p.created_at)
        FROM public.ticket_photos p WHERE p.delivery_update_id = du.id
      ), '[]'::jsonb)
    FROM public.delivery_updates du
    JOIN public.tickets t ON t.id = du.ticket_id
    WHERE du.freight_id = f.id AND du.kind NOT IN ('picked_up', 'delivered')

    UNION ALL
    SELECT
      'freight-issue-' || fi.id::text,
      fi.created_at,
      'issue',
      'Freight issue: ' || initcap(replace(fi.kind, '_', ' ')),
      fi.note,
      COALESCE(NULLIF((SELECT p.full_name FROM public.profiles p WHERE p.id = fi.created_by), ''), 'Operations staff'),
      NULL,
      NULL,
      NULL,
      CASE WHEN fi.photo_path IS NULL THEN '[]'::jsonb ELSE jsonb_build_array(jsonb_build_object('id', fi.id, 'bucket', 'freight-issue-photos', 'path', fi.photo_path)) END
    FROM public.freight_issues fi
    WHERE fi.freight_id = f.id

    UNION ALL
    SELECT
      'freight-resolution-' || fi.id::text,
      fi.resolved_at,
      'resolution',
      'Issue resolved',
      initcap(replace(fi.kind, '_', ' ')),
      COALESCE(NULLIF((SELECT p.full_name FROM public.profiles p WHERE p.id = fi.resolved_by), ''), 'Operations staff'),
      NULL,
      NULL,
      NULL,
      '[]'::jsonb
    FROM public.freight_issues fi
    WHERE fi.freight_id = f.id AND fi.resolved_at IS NOT NULL

    UNION ALL
    SELECT
      'activity-' || a.id::text,
      a.created_at,
      CASE WHEN a.action = 'scan_corrected' THEN 'correction' WHEN a.action = 'issue_resolved' THEN 'resolution' ELSE 'status' END,
      CASE a.action
        WHEN 'scan_corrected' THEN 'Scan corrected'
        WHEN 'issue_resolved' THEN 'Delivery issue resolved'
        ELSE 'Freight status updated'
      END,
      CASE
        WHEN a.action = 'scan_corrected' THEN concat_ws(' · ',
          'Undid ' || COALESCE(a.details->>'undo', 'scan'),
          NULLIF(a.details->>'reason', ''))
        WHEN a.action = 'issue_resolved' THEN initcap(replace(COALESCE(a.details->>'issue_type', 'issue'), '_', ' '))
        ELSE concat_ws(' · ',
          NULLIF(concat_ws(' → ', NULLIF(a.details->>'from', ''), NULLIF(a.details->>'to', '')), ''),
          NULLIF(a.details->>'storage_location', ''))
      END,
      COALESCE(NULLIF((SELECT p.full_name FROM public.profiles p WHERE p.id = a.actor_id), ''), 'Operations staff'),
      NULLIF(a.details->>'storage_location', ''),
      a.ticket_id,
      (SELECT t.ticket_number FROM public.tickets t WHERE t.id = a.ticket_id),
      '[]'::jsonb
    FROM public.activity_log a
    WHERE a.freight_id = f.id AND a.action IN ('freight_status_changed', 'scan_corrected', 'issue_resolved')
  )
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id', h.id,
    'occurred_at', h.occurred_at,
    'kind', h.kind,
    'title', h.title,
    'description', h.description,
    'actor_name', h.actor_name,
    'location', h.location,
    'ticket_id', h.ticket_id,
    'ticket_number', h.ticket_number,
    'photos', h.photos
  ) ORDER BY h.occurred_at, h.id), '[]'::jsonb)
  INTO v_events
  FROM history h;

  RETURN jsonb_build_object(
    'freight', jsonb_build_object(
      'id', f.id,
      'freight_code', f.freight_code,
      'description', f.description,
      'freight_type', f.freight_type,
      'pieces', f.pieces,
      'weight_lbs', f.weight_lbs,
      'booth_number', f.booth_number,
      'arrival_status', f.arrival_status,
      'storage_location', f.storage_location,
      'event_name', (SELECT e.name FROM public.events e WHERE e.id = f.event_id),
      'exhibitor_name', (SELECT x.company_name FROM public.exhibitors x WHERE x.id = f.exhibitor_id),
      'bol', CASE WHEN b.id IS NULL THEN NULL ELSE jsonb_build_object(
        'carrier_name', b.carrier_name,
        'pro_number', b.pro_number,
        'shipper_name', b.shipper_name,
        'consignee_name', b.consignee_name,
        'created_at', b.created_at,
        'document', CASE WHEN v_staff THEN jsonb_build_object('bucket', 'bol-documents', 'path', b.storage_path, 'filename', b.original_filename) ELSE NULL END
      ) END
    ),
    'events', v_events
  );
END $$;

REVOKE ALL ON FUNCTION public.event_freight_status(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.freight_chain_of_custody(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.event_freight_status(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.freight_chain_of_custody(uuid) TO authenticated;