CREATE OR REPLACE FUNCTION public.sandbox_reset_event(_event uuid, _deep boolean DEFAULT false)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org uuid;
  v_event_name text;
  v_session public.work_sessions;
  v_jobs integer := 0;
  v_sessions integer := 0;
  v_freight integer := 0;
BEGIN
  SELECT organization_id, name INTO v_org, v_event_name
  FROM public.events WHERE id = _event;

  IF v_org IS NULL THEN
    RAISE EXCEPTION 'Event not found';
  END IF;
  IF auth.uid() IS NULL OR NOT public.is_org_admin(v_org) THEN
    RAISE EXCEPTION 'Only company admins can use sandbox reset';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended(_event::text, 0));

  DELETE FROM public.queue_drivers WHERE event_id = _event;
  DELETE FROM public.operator_unlocks WHERE event_id = _event;
  DELETE FROM public.ticket_crew tc
  USING public.tickets t
  WHERE tc.ticket_id = t.id
    AND t.event_id = _event
    AND t.status IN ('requested', 'assigned', 'in_progress');

  UPDATE public.tickets
  SET status = 'cancelled',
      completion_notes = concat_ws(
        E'\n',
        nullif(completion_notes, ''),
        'Cancelled by administrator during sandbox reset; unfinished work is excluded from completed-ticket billing.'
      )
  WHERE event_id = _event
    AND status IN ('requested', 'assigned', 'in_progress');
  GET DIAGNOSTICS v_jobs = ROW_COUNT;

  FOR v_session IN
    SELECT s.* FROM public.work_sessions s
    JOIN public.tickets t ON t.id = s.ticket_id
    WHERE t.event_id = _event AND s.status <> 'completed'
    FOR UPDATE OF s
  LOOP
    UPDATE public.work_session_pauses
    SET resumed_at = now()
    WHERE session_id = v_session.id AND resumed_at IS NULL;

    UPDATE public.work_sessions
    SET status = 'completed',
        ended_at = now(),
        paused_seconds = paused_seconds + CASE WHEN paused_at IS NULL THEN 0 ELSE greatest(0, extract(epoch FROM (now() - paused_at))::integer) END,
        paused_at = NULL,
        billable_hours = public.session_hours(v_session),
        billable_amount = round(public.session_hours(v_session) * v_session.hourly_rate, 2),
        cancelled_at = now(),
        cancellation_reason = 'Administrator sandbox reset; cancelled work is excluded from completed-ticket billing'
    WHERE id = v_session.id;
    v_sessions := v_sessions + 1;
  END LOOP;

  UPDATE public.ticket_freight tf
  SET picked_up_at = NULL,
      picked_up_by = NULL,
      picked_up_session_id = NULL,
      delivered_at = NULL,
      delivered_by = NULL,
      delivered_session_id = NULL,
      booth_verified = NULL,
      flag = NULL,
      scanned_at = NULL,
      scanned_by = NULL
  FROM public.tickets t
  WHERE tf.ticket_id = t.id
    AND t.event_id = _event
    AND t.status = 'cancelled'
    AND t.completion_notes LIKE '%Administrator sandbox reset%';

  UPDATE public.operators o
  SET status = 'available'
  WHERE o.organization_id = v_org
    AND o.status = 'on_job'
    AND NOT EXISTS (
      SELECT 1 FROM public.tickets t
      WHERE t.assigned_operator_id = o.id AND t.status IN ('assigned', 'in_progress')
    )
    AND NOT EXISTS (
      SELECT 1 FROM public.ticket_crew tc
      JOIN public.tickets t ON t.id = tc.ticket_id
      WHERE tc.operator_id = o.id AND t.status IN ('assigned', 'in_progress')
    );

  UPDATE public.equipment e
  SET status = 'available'
  WHERE e.organization_id = v_org
    AND e.status = 'in_use'
    AND e.retired_at IS NULL
    AND NOT EXISTS (
      SELECT 1 FROM public.tickets t
      WHERE t.assigned_equipment_id = e.id AND t.status IN ('assigned', 'in_progress')
    )
    AND NOT EXISTS (
      SELECT 1 FROM public.ticket_crew tc
      JOIN public.tickets t ON t.id = tc.ticket_id
      WHERE tc.equipment_id = e.id AND t.status IN ('assigned', 'in_progress')
    );

  IF _deep THEN
    UPDATE public.freight_items
    SET arrival_status = CASE
      WHEN storage_location IS NOT NULL AND btrim(storage_location) <> '' THEN 'in_storage'::public.arrival_status
      ELSE 'received'::public.arrival_status
    END
    WHERE event_id = _event;
    GET DIAGNOSTICS v_freight = ROW_COUNT;
  END IF;

  PERFORM public.log_activity(
    v_org,
    'sandbox_reset',
    NULL,
    NULL,
    _event,
    jsonb_build_object(
      'event_name', v_event_name,
      'deep', _deep,
      'cancelled_jobs', v_jobs,
      'stopped_sessions', v_sessions,
      'reset_freight', v_freight
    )
  );

  RETURN jsonb_build_object(
    'cancelled_jobs', v_jobs,
    'stopped_sessions', v_sessions,
    'reset_freight', v_freight,
    'deep', _deep
  );
END;
$$;

REVOKE ALL ON FUNCTION public.sandbox_reset_event(uuid, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.sandbox_reset_event(uuid, boolean) TO authenticated;