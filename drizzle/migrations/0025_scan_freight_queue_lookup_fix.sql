CREATE OR REPLACE FUNCTION public.scan_freight_to_queue(_token text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE
  freight public.freight_items;
  job public.tickets;
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

  SELECT * INTO freight FROM public.freight_items WHERE qr_token=trim(_token);
  IF freight.id IS NULL THEN RAISE EXCEPTION 'Unknown freight label'; END IF;
  v_freight_id:=freight.id;
  v_event_id:=freight.event_id;
  v_exhibitor_id:=freight.exhibitor_id;
  IF NOT (public.is_org_staff(freight.organization_id) OR public.has_org_role(freight.organization_id,'operator')) THEN
    RAISE EXCEPTION 'Only company staff and drivers can queue freight';
  END IF;
  IF NOT EXISTS(SELECT 1 FROM public.events e WHERE e.id=v_event_id AND e.status<>'closed') THEN
    RAISE EXCEPTION 'This event is closed';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended(v_event_id::text,0));
  SELECT * INTO freight FROM public.freight_items WHERE id=v_freight_id FOR UPDATE;

  SELECT tf.ticket_id INTO v_ticket_id
  FROM public.ticket_freight tf
  JOIN public.tickets tk ON tk.id=tf.ticket_id
  WHERE tf.freight_id=v_freight_id AND tk.status IN ('requested','assigned','in_progress')
  ORDER BY tk.requested_at,tk.id
  LIMIT 1;

  IF v_ticket_id IS NULL THEN
    IF freight.arrival_status IN ('delivered_to_booth','shipped') THEN
      RAISE EXCEPTION 'This freight has already been delivered';
    END IF;
    INSERT INTO public.tickets(
      event_id,exhibitor_id,booth_number,service_type,priority,
      required_equipment_class,service_only,estimated_weight_lbs,request_source
    ) VALUES(
      v_event_id,v_exhibitor_id,freight.booth_number,'inbound_delivery','normal',
      'forklift',false,nullif(freight.weight_lbs,0),'walk_in'
    ) RETURNING id INTO v_ticket_id;
    INSERT INTO public.ticket_freight(ticket_id,freight_id) VALUES(v_ticket_id,v_freight_id);
    IF freight.arrival_status='expected' THEN
      UPDATE public.freight_items SET arrival_status='received' WHERE id=v_freight_id;
    END IF;
    created:=true;
  END IF;

  PERFORM public.queue_dispatch(v_event_id);
  SELECT * INTO job FROM public.tickets WHERE id=v_ticket_id;
  v_operator_id:=job.assigned_operator_id;
  v_equipment_id:=job.assigned_equipment_id;

  IF created THEN
    PERFORM public.log_activity(
      freight.organization_id,'freight_scan_queued',v_ticket_id,v_freight_id,v_event_id,
      jsonb_build_object('freight_code',freight.freight_code,'ticket_number',job.ticket_number)
    );
  END IF;

  SELECT company_name INTO exhibitor_name FROM public.exhibitors WHERE id=v_exhibitor_id;
  SELECT full_name INTO driver_name FROM public.operators WHERE id=v_operator_id;
  SELECT unit_number INTO equipment_unit FROM public.equipment WHERE id=v_equipment_id;

  RETURN jsonb_build_object(
    'ok',true,'created',created,'ticket_id',v_ticket_id,'ticket_number',job.ticket_number,
    'status',job.status,'freight_id',v_freight_id,'freight_code',freight.freight_code,
    'description',freight.description,'exhibitor',exhibitor_name,'booth',freight.booth_number,
    'assigned',v_operator_id IS NOT NULL AND v_equipment_id IS NOT NULL,
    'operator_id',v_operator_id,'operator_name',driver_name,
    'equipment_id',v_equipment_id,'equipment_unit',equipment_unit
  );
END $$;
REVOKE ALL ON FUNCTION public.scan_freight_to_queue(text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.scan_freight_to_queue(text) TO authenticated;