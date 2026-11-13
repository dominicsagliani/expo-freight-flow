REVOKE EXECUTE ON FUNCTION public.queue_compatible(uuid,uuid) FROM authenticated;
CREATE OR REPLACE FUNCTION public.op_start_session(_ticket uuid, _equipment uuid) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE t public.tickets; op uuid; sid uuid; e public.equipment;
BEGIN
 op:=public.my_operator_on_ticket(_ticket);
 IF op IS NULL THEN RAISE EXCEPTION 'This job is not assigned to you'; END IF;
 SELECT * INTO t FROM public.tickets WHERE id=_ticket FOR UPDATE;
 IF t.status IN ('completed','cancelled') THEN RAISE EXCEPTION 'This job is already %',t.status; END IF;
 SELECT * INTO e FROM public.equipment WHERE id=_equipment AND organization_id=t.organization_id FOR UPDATE;
 IF e.id IS NULL OR e.status='maintenance' OR e.retired_at IS NOT NULL THEN RAISE EXCEPTION 'Pick an available forklift first'; END IF;
 IF EXISTS(SELECT 1 FROM public.queue_drivers WHERE equipment_id=_equipment AND operator_id<>op) THEN RAISE EXCEPTION 'This machine is selected by another operator'; END IF;
 IF EXISTS(SELECT 1 FROM public.work_sessions WHERE status<>'completed' AND (equipment_id=_equipment OR operator_id=op) AND (ticket_id<>_ticket OR operator_id<>op OR equipment_id<>_equipment)) THEN RAISE EXCEPTION 'Finish the active work session before starting another'; END IF;
 SELECT id INTO sid FROM public.work_sessions WHERE ticket_id=_ticket AND equipment_id=_equipment AND operator_id=op AND status<>'completed';
 IF sid IS NOT NULL THEN RETURN sid; END IF;
 INSERT INTO public.work_sessions(organization_id,ticket_id,equipment_id,operator_id,hourly_rate) VALUES(t.organization_id,_ticket,_equipment,op,public.session_hourly_rate(_ticket)) RETURNING id INTO sid;
 IF t.status IN ('requested','assigned') THEN UPDATE public.tickets SET status='in_progress',started_at=coalesce(started_at,now()) WHERE id=_ticket; END IF;
 UPDATE public.operators SET status='on_job' WHERE id=op;
 UPDATE public.equipment SET status='in_use' WHERE id=_equipment;
 PERFORM public.log_activity(t.organization_id,'session_started',_ticket,NULL,t.event_id,jsonb_build_object('session_id',sid,'equipment_id',_equipment));
 RETURN sid;
END $$;