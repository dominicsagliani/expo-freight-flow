ALTER TABLE public.work_sessions ADD COLUMN cancelled_at timestamptz, ADD COLUMN cancellation_reason text;
CREATE OR REPLACE FUNCTION public.prevent_loaded_timer_stop() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF OLD.status<>'completed' AND NEW.status='completed' AND EXISTS(SELECT 1 FROM public.ticket_freight WHERE picked_up_session_id=OLD.id AND delivered_at IS NULL) THEN
  IF NOT (NEW.cancelled_at IS NOT NULL AND public.is_org_admin(OLD.organization_id) AND EXISTS(SELECT 1 FROM public.tickets WHERE id=OLD.ticket_id AND status='cancelled')) THEN
   RAISE EXCEPTION 'Scan out all freight on this forklift before stopping its timer';
  END IF;
 END IF;
 RETURN NEW;
END $$;
CREATE OR REPLACE FUNCTION public.reset_org_drivers(_org uuid) RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE ev record; s public.work_sessions; n integer;
BEGIN
 IF auth.uid() IS NULL OR NOT public.is_org_admin(_org) THEN RAISE EXCEPTION 'Only company admins can reset drivers'; END IF;
 FOR ev IN SELECT id FROM public.events WHERE organization_id=_org ORDER BY id LOOP
  PERFORM pg_advisory_xact_lock(hashtextextended(ev.id::text,0));
 END LOOP;
 DELETE FROM public.queue_drivers WHERE organization_id=_org;
 DELETE FROM public.operator_unlocks WHERE operator_id IN (SELECT id FROM public.operators WHERE organization_id=_org);
 UPDATE public.tickets SET status='cancelled', completion_notes=concat_ws(E'\n',nullif(completion_notes,''),'Cancelled by administrator during driver reset; any unfinished freight requires review.') WHERE organization_id=_org AND status IN ('requested','assigned','in_progress');
 FOR s IN SELECT * FROM public.work_sessions WHERE organization_id=_org AND status<>'completed' FOR UPDATE LOOP
  UPDATE public.work_session_pauses SET resumed_at=now() WHERE session_id=s.id AND resumed_at IS NULL;
  UPDATE public.work_sessions SET status='completed', ended_at=now(), paused_seconds=paused_seconds+CASE WHEN paused_at IS NULL THEN 0 ELSE greatest(0,extract(epoch FROM (now()-paused_at))::integer) END, paused_at=NULL, billable_hours=public.session_hours(s), billable_amount=round(public.session_hours(s)*s.hourly_rate,2), cancelled_at=now(), cancellation_reason='Administrator driver reset; cancelled work is excluded from completed-ticket billing' WHERE id=s.id;
  PERFORM public.log_activity(_org,'session_cancelled',s.ticket_id,NULL,(SELECT event_id FROM public.tickets WHERE id=s.ticket_id),jsonb_build_object('session_id',s.id,'reason','Administrator driver reset','freight_requires_review',true));
 END LOOP;
 UPDATE public.operators SET status='available' WHERE organization_id=_org;
 GET DIAGNOSTICS n = ROW_COUNT;
 UPDATE public.equipment SET status='available' WHERE organization_id=_org AND status='in_use' AND retired_at IS NULL;
 PERFORM public.log_activity(_org,'drivers_reset',NULL,NULL,NULL,jsonb_build_object('drivers',n,'reason','Administrator cancelled unfinished jobs and released drivers'));
 RETURN n;
END $$;
REVOKE ALL ON FUNCTION public.reset_org_drivers(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.reset_org_drivers(uuid) TO authenticated;
CREATE OR REPLACE FUNCTION public.delete_event(_event uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE org uuid; event_name text;
BEGIN
 SELECT organization_id,name INTO org,event_name FROM public.events WHERE id=_event;
 IF org IS NULL THEN RAISE EXCEPTION 'Event not found'; END IF;
 IF auth.uid() IS NULL OR NOT public.is_org_admin(org) THEN RAISE EXCEPTION 'Only company admins can delete events'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(_event::text,0));
 IF EXISTS(SELECT 1 FROM public.work_sessions s JOIN public.tickets t ON t.id=s.ticket_id WHERE t.event_id=_event AND s.status<>'completed') THEN RAISE EXCEPTION 'Reset drivers or finish active work before deleting this event'; END IF;
 DELETE FROM public.queue_drivers WHERE event_id=_event;
 DELETE FROM public.operator_unlocks WHERE event_id=_event;
 UPDATE public.operators o SET status='available' WHERE o.organization_id=org AND o.status='on_job' AND EXISTS(SELECT 1 FROM public.tickets t WHERE t.event_id=_event AND t.assigned_operator_id=o.id) AND NOT EXISTS(SELECT 1 FROM public.tickets t WHERE t.event_id<>_event AND t.assigned_operator_id=o.id AND t.status IN ('assigned','in_progress'));
 UPDATE public.equipment e SET status='available' WHERE e.organization_id=org AND e.status='in_use' AND EXISTS(SELECT 1 FROM public.tickets t WHERE t.event_id=_event AND t.assigned_equipment_id=e.id) AND NOT EXISTS(SELECT 1 FROM public.tickets t WHERE t.event_id<>_event AND t.assigned_equipment_id=e.id AND t.status IN ('assigned','in_progress'));
 DELETE FROM public.events WHERE id=_event AND organization_id=org;
 PERFORM public.log_activity(org,'event_deleted',NULL,NULL,NULL,jsonb_build_object('deleted_event_id',_event,'name',event_name));
END $$;
REVOKE ALL ON FUNCTION public.delete_event(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.delete_event(uuid) TO authenticated;