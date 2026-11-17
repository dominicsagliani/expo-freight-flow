CREATE OR REPLACE FUNCTION public.scan_freight_to_queue(_token text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE
  f public.freight_items;
  t public.tickets;
  created boolean := false;
  exhibitor_name text;
  driver_name text;
  equipment_unit text;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Sign in required'; END IF;
  IF coalesce(trim(_token),'')='' THEN RAISE EXCEPTION 'Scan an ExpoHaul freight label'; END IF;

  SELECT * INTO f FROM public.freight_items WHERE qr_token=trim(_token);
  IF f.id IS NULL THEN RAISE EXCEPTION 'Unknown freight label'; END IF;
  IF NOT (public.is_org_staff(f.organization_id) OR public.has_org_role(f.organization_id,'operator')) THEN
    RAISE EXCEPTION 'Only company staff and drivers can queue freight';
  END IF;
  IF NOT EXISTS(SELECT 1 FROM public.events e WHERE e.id=f.event_id AND e.status<>'closed') THEN
    RAISE EXCEPTION 'This event is closed';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended(f.event_id::text,0));
  SELECT * INTO f FROM public.freight_items WHERE id=f.id FOR UPDATE;

  SELECT t.* INTO t
  FROM public.ticket_freight tf
  JOIN public.tickets t ON t.id=tf.ticket_id
  WHERE tf.freight_id=f.id AND t.status IN ('requested','assigned','in_progress')
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
      f.event_id,f.exhibitor_id,f.booth_number,'inbound_delivery','normal',
      'forklift',false,nullif(f.weight_lbs,0),'walk_in'
    ) RETURNING * INTO t;
    INSERT INTO public.ticket_freight(ticket_id,freight_id) VALUES(t.id,f.id);
    IF f.arrival_status='expected' THEN
      UPDATE public.freight_items SET arrival_status='received' WHERE id=f.id;
    END IF;
    created:=true;
    PERFORM public.log_activity(
      f.organization_id,'freight_scan_queued',t.id,f.id,f.event_id,
      jsonb_build_object('freight_code',f.freight_code,'ticket_number',t.ticket_number)
    );
  END IF;

  PERFORM public.queue_dispatch(f.event_id);
  SELECT * INTO t FROM public.tickets WHERE id=t.id;
  SELECT company_name INTO exhibitor_name FROM public.exhibitors WHERE id=f.exhibitor_id;
  SELECT full_name INTO driver_name FROM public.operators WHERE id=t.assigned_operator_id;
  SELECT unit_number INTO equipment_unit FROM public.equipment WHERE id=t.assigned_equipment_id;

  RETURN jsonb_build_object(
    'ok',true,'created',created,'ticket_id',t.id,'ticket_number',t.ticket_number,
    'status',t.status,'freight_id',f.id,'freight_code',f.freight_code,
    'description',f.description,'exhibitor',exhibitor_name,'booth',f.booth_number,
    'assigned',t.assigned_operator_id IS NOT NULL AND t.assigned_equipment_id IS NOT NULL,
    'operator_id',t.assigned_operator_id,'operator_name',driver_name,
    'equipment_id',t.assigned_equipment_id,'equipment_unit',equipment_unit
  );
END $$;
REVOKE ALL ON FUNCTION public.scan_freight_to_queue(text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.scan_freight_to_queue(text) TO authenticated;

CREATE OR REPLACE FUNCTION public.driver_go_online(_event uuid,_equipment uuid,_driver uuid) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE org uuid; w public.operators; q public.queue_drivers;
BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Company sign-in required'; END IF;
 SELECT organization_id INTO org FROM public.events WHERE id=_event AND status<>'closed';
 IF org IS NULL OR NOT (public.is_org_staff(org) OR public.has_org_role(org,'operator')) THEN RAISE EXCEPTION 'Event not found'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(auth.uid()::text,0));
 PERFORM pg_advisory_xact_lock(hashtextextended(_event::text,0));
 SELECT * INTO w FROM public.operators WHERE id=_driver AND organization_id=org AND equipment_id IS NULL AND retired_at IS NULL FOR UPDATE;
 IF w.id IS NULL THEN RAISE EXCEPTION 'Choose an active worker'; END IF;
 SELECT * INTO q FROM public.queue_drivers WHERE user_id=auth.uid();
 IF q.user_id IS NOT NULL AND (q.operator_id IS DISTINCT FROM _driver OR q.equipment_id IS DISTINCT FROM _equipment OR q.event_id IS DISTINCT FROM _event) THEN
  PERFORM public.fleet_release();
 END IF;
 IF EXISTS(SELECT 1 FROM public.queue_drivers WHERE user_id<>auth.uid() AND operator_id=_driver AND heartbeat_at>now()-interval '60 seconds') THEN RAISE EXCEPTION 'This worker is already online on another device'; END IF;
 INSERT INTO public.event_operators(event_id,operator_id,organization_id,added_by) VALUES(_event,_driver,org,auth.uid()) ON CONFLICT DO NOTHING;
 INSERT INTO public.operator_unlocks(user_id,operator_id,event_id,expires_at) VALUES(auth.uid(),_driver,_event,now()+interval '12 hours') ON CONFLICT(user_id) DO UPDATE SET operator_id=EXCLUDED.operator_id,event_id=EXCLUDED.event_id,unlocked_at=now(),expires_at=EXCLUDED.expires_at;
 UPDATE public.operators SET status=CASE WHEN status='off_shift' THEN 'available'::public.operator_status ELSE status END WHERE id=_driver;
 PERFORM public.fleet_select(_equipment);
 PERFORM public.queue_dispatch(_event);
 RETURN _driver;
END $$;
REVOKE ALL ON FUNCTION public.driver_go_online(uuid,uuid,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.driver_go_online(uuid,uuid,uuid) TO authenticated;