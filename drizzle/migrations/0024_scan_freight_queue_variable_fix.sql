CREATE OR REPLACE FUNCTION public.scan_freight_to_queue(_token text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE
  f public.freight_items;
  t public.tickets;
  v_freight_id uuid;
  v_ticket_id uuid;
  v_event_id uuid;
  v_exhibitor_id uuid;
  v_operator_id uuid;
  v_equipment_id uuid;
  created boolean := false;
  exhibitor_name text;
  driver_name text;
  equipment_unit text;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Sign in required'; END IF;
  IF coalesce(trim(_token),'')='' THEN RAISE EXCEPTION 'Scan an ExpoHaul freight label'; END IF;

  SELECT * INTO f FROM public.freight_items WHERE qr_token=trim(_token);
  IF f.id IS NULL THEN RAISE EXCEPTION 'Unknown freight label'; END IF;
  v_freight_id:=f.id;
  v_event_id:=f.event_id;
  v_exhibitor_id:=f.exhibitor_id;
  IF NOT (public.is_org_staff(f.organization_id) OR public.has_org_role(f.organization_id,'operator')) THEN
    RAISE EXCEPTION 'Only company staff and drivers can queue freight';
  END IF;
  IF NOT EXISTS(SELECT 1 FROM public.events e WHERE e.id=v_event_id AND e.status<>'closed') THEN
    RAISE EXCEPTION 'This event is closed';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended(v_event_id::text,0));
  SELECT * INTO f FROM public.freight_items WHERE id=v_freight_id FOR UPDATE;

  SELECT t.* INTO t
  FROM public.ticket_freight tf
  JOIN public.tickets t ON t.id=tf.ticket_id
  WHERE tf.freight_id=v_freight_id AND t.status IN ('requested','assigned','in_progress')
  ORDER BY t.requested_at,t.id
  LIMIT 1 FOR UPDATE OF t;

  IF t.id IS NULL THEN
    IF f.arrival_status IN ('delivered_to_booth','shipped') THEN
      RAISE EXCEPTION 'This freight has already been delivered';
    END IF;
    INSERT INTO public.tickets(
      event_id,exhibitor_id,booth_number,service_type,priority,
      required_equipment_class,service_only,estimated_weight_lbs,request_source
    ) VALUES(
      v_event_id,v_exhibitor_id,f.booth_number,'inbound_delivery','normal',
      'forklift',false,nullif(f.weight_lbs,0),'walk_in'
    ) RETURNING * INTO t;
    v_ticket_id:=t.id;
    INSERT INTO public.ticket_freight(ticket_id,freight_id) VALUES(v_ticket_id,v_freight_id);
    IF f.arrival_status='expected' THEN
      UPDATE public.freight_items SET arrival_status='received' WHERE id=v_freight_id;
    END IF;
    created:=true;
    PERFORM public.log_activity(
      f.organization_id,'freight_scan_queued',v_ticket_id,v_freight_id,v_event_id,
      jsonb_build_object('freight_code',f.freight_code,'ticket_number',t.ticket_number)
    );
  ELSE
    v_ticket_id:=t.id;
  END IF;

  PERFORM public.queue_dispatch(v_event_id);
  SELECT * INTO t FROM public.tickets WHERE id=v_ticket_id;
  v_operator_id:=t.assigned_operator_id;
  v_equipment_id:=t.assigned_equipment_id;
  SELECT company_name INTO exhibitor_name FROM public.exhibitors WHERE id=v_exhibitor_id;
  SELECT full_name INTO driver_name FROM public.operators WHERE id=v_operator_id;
  SELECT unit_number INTO equipment_unit FROM public.equipment WHERE id=v_equipment_id;

  RETURN jsonb_build_object(
    'ok',true,'created',created,'ticket_id',v_ticket_id,'ticket_number',t.ticket_number,
    'status',t.status,'freight_id',v_freight_id,'freight_code',f.freight_code,
    'description',f.description,'exhibitor',exhibitor_name,'booth',f.booth_number,
    'assigned',v_operator_id IS NOT NULL AND v_equipment_id IS NOT NULL,
    'operator_id',v_operator_id,'operator_name',driver_name,
    'equipment_id',v_equipment_id,'equipment_unit',equipment_unit
  );
END $$;
REVOKE ALL ON FUNCTION public.scan_freight_to_queue(text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.scan_freight_to_queue(text) TO authenticated;