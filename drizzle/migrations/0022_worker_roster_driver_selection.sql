ALTER TABLE public.operators ADD COLUMN first_name text, ADD COLUMN last_name text, ADD COLUMN retired_at timestamptz;
UPDATE public.operators SET first_name=split_part(trim(full_name),' ',1), last_name=coalesce(nullif(trim(substr(trim(full_name),length(split_part(trim(full_name),' ',1))+1)),''),'') WHERE equipment_id IS NULL;
ALTER POLICY "Staff manage operators" ON public.operators WITH CHECK (public.is_org_admin(organization_id));
ALTER POLICY "Staff update operators" ON public.operators USING (public.is_org_admin(organization_id)) WITH CHECK (public.is_org_admin(organization_id));
CREATE OR REPLACE FUNCTION public.manage_worker(_org uuid, _first text DEFAULT NULL, _last text DEFAULT NULL, _worker uuid DEFAULT NULL, _remove boolean DEFAULT false) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE w public.operators; result uuid;
BEGIN
 IF NOT public.is_org_admin(_org) THEN RAISE EXCEPTION 'Only company admins can manage workers'; END IF;
 IF _worker IS NOT NULL THEN
  SELECT * INTO w FROM public.operators WHERE id=_worker AND organization_id=_org AND equipment_id IS NULL FOR UPDATE;
  IF w.id IS NULL THEN RAISE EXCEPTION 'Worker not found'; END IF;
 END IF;
 IF _remove THEN
  IF w.id IS NULL THEN RAISE EXCEPTION 'Worker not found'; END IF;
  IF EXISTS(SELECT 1 FROM public.queue_drivers WHERE operator_id=w.id) OR EXISTS(SELECT 1 FROM public.tickets WHERE assigned_operator_id=w.id AND status IN ('assigned','in_progress')) OR EXISTS(SELECT 1 FROM public.work_sessions WHERE operator_id=w.id AND status<>'completed') THEN RAISE EXCEPTION 'Take this worker offline and finish their jobs before deleting'; END IF;
  UPDATE public.operators SET retired_at=now(),status='off_shift' WHERE id=w.id;
  DELETE FROM public.operator_unlocks WHERE operator_id=w.id;
  RETURN w.id;
 END IF;
 IF coalesce(trim(_first),'')='' OR coalesce(trim(_last),'')='' THEN RAISE EXCEPTION 'First and last name are required'; END IF;
 IF w.id IS NULL THEN
  INSERT INTO public.operators(organization_id,first_name,last_name,full_name) VALUES(_org,trim(_first),trim(_last),trim(_first)||' '||trim(_last)) RETURNING id INTO result;
 ELSE
  UPDATE public.operators SET first_name=trim(_first),last_name=trim(_last),full_name=trim(_first)||' '||trim(_last) WHERE id=w.id RETURNING id INTO result;
 END IF;
 RETURN result;
END $$;
CREATE OR REPLACE FUNCTION public.driver_roster(_event uuid) RETURNS TABLE(id uuid,full_name text) LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
DECLARE org uuid;
BEGIN
 SELECT organization_id INTO org FROM public.events WHERE events.id=_event AND status<>'closed';
 IF org IS NULL OR NOT (public.is_org_staff(org) OR public.has_org_role(org,'operator')) THEN RAISE EXCEPTION 'Company sign-in required'; END IF;
 RETURN QUERY SELECT o.id,o.full_name FROM public.operators o WHERE o.organization_id=org AND o.equipment_id IS NULL AND o.retired_at IS NULL ORDER BY o.full_name;
END $$;
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
 RETURN _driver;
END $$;
REVOKE ALL ON FUNCTION public.manage_worker(uuid,text,text,uuid,boolean),public.driver_roster(uuid),public.driver_go_online(uuid,uuid,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.manage_worker(uuid,text,text,uuid,boolean),public.driver_roster(uuid),public.driver_go_online(uuid,uuid,uuid) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.forklift_go_online(uuid,uuid) FROM authenticated;
COMMENT ON COLUMN public.operators.retired_at IS 'Removed workers remain in job and billing history but are excluded from quick driver selection.';