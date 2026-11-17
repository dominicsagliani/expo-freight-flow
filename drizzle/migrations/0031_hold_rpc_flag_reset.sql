CREATE OR REPLACE FUNCTION public.set_ticket_hold(_ticket uuid, _hold boolean, _reason text DEFAULT NULL) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE t public.tickets;
BEGIN
  SELECT * INTO t FROM public.tickets WHERE id=_ticket;
  IF t.id IS NULL OR NOT public.is_org_staff(t.organization_id) THEN RAISE EXCEPTION 'Only dispatch staff can hold jobs'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(t.event_id::text,0));
  SELECT * INTO t FROM public.tickets WHERE id=_ticket FOR UPDATE;
  IF _hold THEN
    IF t.status NOT IN ('requested','assigned') THEN RAISE EXCEPTION 'Only waiting or assigned jobs can be put on hold'; END IF;
    IF EXISTS (SELECT 1 FROM public.work_sessions s WHERE s.ticket_id=_ticket AND s.status<>'completed') THEN
      RAISE EXCEPTION 'A forklift timer is running on this job'; END IF;
    IF EXISTS (SELECT 1 FROM public.ticket_freight tf WHERE tf.ticket_id=_ticket AND tf.picked_up_at IS NOT NULL AND tf.delivered_at IS NULL) THEN
      RAISE EXCEPTION 'Freight is loaded on a forklift — deliver it first'; END IF;
    DELETE FROM public.ticket_crew WHERE ticket_id=_ticket;
    PERFORM set_config('expohaul.hold_rpc','1',true);
    UPDATE public.tickets SET assigned_operator_id=NULL, assigned_equipment_id=NULL, status='requested',
      held_at=now(), held_by=auth.uid(), hold_reason=nullif(trim(coalesce(_reason,'')),'') WHERE id=_ticket;
    PERFORM set_config('expohaul.hold_rpc','',true);
    PERFORM public.log_activity(t.organization_id,'job_held',_ticket,NULL,t.event_id,jsonb_build_object('reason',_reason));
  ELSE
    IF t.held_at IS NULL THEN RETURN; END IF;
    PERFORM set_config('expohaul.hold_rpc','1',true);
    UPDATE public.tickets SET held_at=NULL, held_by=NULL, hold_reason=NULL WHERE id=_ticket;
    PERFORM set_config('expohaul.hold_rpc','',true);
    PERFORM public.log_activity(t.organization_id,'job_released',_ticket,NULL,t.event_id,'{}'::jsonb);
    PERFORM public.queue_dispatch(t.event_id);
  END IF;
END $$;