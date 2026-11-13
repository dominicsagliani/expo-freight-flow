ALTER TABLE public.equipment ADD COLUMN equipment_class text NOT NULL DEFAULT 'forklift', ADD COLUMN fuel_type text NOT NULL DEFAULT 'unspecified', ADD COLUMN model text, ADD COLUMN retired_at timestamptz;
ALTER TABLE public.equipment ADD CONSTRAINT equipment_capacity_positive CHECK (capacity_lbs IS NULL OR capacity_lbs > 0);
ALTER TABLE public.tickets ADD COLUMN required_equipment_class text NOT NULL DEFAULT 'forklift';
CREATE TABLE public.queue_drivers (
 user_id uuid PRIMARY KEY, organization_id uuid NOT NULL REFERENCES public.organizations(id),
 event_id uuid NOT NULL REFERENCES public.events(id), operator_id uuid NOT NULL UNIQUE REFERENCES public.operators(id),
 equipment_id uuid NOT NULL UNIQUE REFERENCES public.equipment(id), ready boolean NOT NULL DEFAULT true,
 ready_since timestamptz NOT NULL DEFAULT now(), heartbeat_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.queue_drivers TO authenticated;
GRANT ALL ON public.queue_drivers TO service_role;
ALTER TABLE public.queue_drivers ENABLE ROW LEVEL SECURITY;
CREATE POLICY queue_driver_read ON public.queue_drivers FOR SELECT TO authenticated USING (user_id=auth.uid() OR public.is_org_staff(organization_id));
CREATE OR REPLACE FUNCTION public.queue_compatible(_ticket uuid, _equipment uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
 SELECT EXISTS (SELECT 1 FROM public.tickets t JOIN public.equipment e ON e.id=_equipment AND e.organization_id=t.organization_id
 WHERE t.id=_ticket AND e.retired_at IS NULL AND e.status='available' AND e.capacity_lbs>0
 AND t.required_equipment_class=e.equipment_class
 AND EXISTS (SELECT 1 FROM public.ticket_freight WHERE ticket_id=t.id)
 AND NOT EXISTS (SELECT 1 FROM public.ticket_freight tf JOIN public.freight_items f ON f.id=tf.freight_id WHERE tf.ticket_id=t.id AND (f.weight_lbs IS NULL OR f.weight_lbs<=0 OR f.event_id<>t.event_id))
 AND (SELECT sum(f.weight_lbs) FROM public.ticket_freight tf JOIN public.freight_items f ON f.id=tf.freight_id WHERE tf.ticket_id=t.id)<=e.capacity_lbs);
$$;
REVOKE ALL ON FUNCTION public.queue_compatible(uuid,uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.queue_compatible(uuid,uuid) TO authenticated;
CREATE OR REPLACE FUNCTION public.queue_dispatch(_event uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE d public.queue_drivers; tid uuid;
BEGIN
 PERFORM pg_advisory_xact_lock(hashtextextended(_event::text,0));
 FOR d IN SELECT q.* FROM public.queue_drivers q JOIN public.operators o ON o.id=q.operator_id
 WHERE q.event_id=_event AND q.ready AND q.heartbeat_at>now()-interval '60 seconds' AND o.status<>'off_shift'
 AND EXISTS (SELECT 1 FROM public.operator_unlocks u WHERE u.user_id=q.user_id AND u.operator_id=q.operator_id AND u.event_id=q.event_id AND u.expires_at>now())
 AND EXISTS (SELECT 1 FROM public.event_operators eo WHERE eo.event_id=q.event_id AND eo.operator_id=q.operator_id)
 AND EXISTS (SELECT 1 FROM public.events e WHERE e.id=q.event_id AND e.status<>'closed')
 ORDER BY q.ready_since,q.operator_id FOR UPDATE OF q LOOP
 IF EXISTS (SELECT 1 FROM public.tickets t WHERE t.status IN ('assigned','in_progress') AND (t.assigned_operator_id=d.operator_id OR t.assigned_equipment_id=d.equipment_id))
 OR EXISTS (SELECT 1 FROM public.work_sessions s WHERE s.status<>'completed' AND (s.operator_id=d.operator_id OR s.equipment_id=d.equipment_id))
 OR EXISTS (SELECT 1 FROM public.ticket_crew c JOIN public.tickets t ON t.id=c.ticket_id WHERE c.operator_id=d.operator_id AND t.status IN ('assigned','in_progress')) THEN CONTINUE; END IF;
 SELECT t.id INTO tid FROM public.tickets t WHERE t.event_id=_event AND t.organization_id=d.organization_id AND t.status='requested'
 AND t.assigned_operator_id IS NULL AND t.assigned_equipment_id IS NULL AND public.queue_compatible(t.id,d.equipment_id)
 ORDER BY CASE t.priority WHEN 'urgent' THEN 0 WHEN 'high' THEN 1 WHEN 'normal' THEN 2 ELSE 3 END,t.requested_at,t.id FOR UPDATE SKIP LOCKED LIMIT 1;
 IF tid IS NOT NULL THEN
 UPDATE public.tickets SET assigned_operator_id=d.operator_id,assigned_equipment_id=d.equipment_id,status='assigned',assigned_at=now() WHERE id=tid;
 UPDATE public.queue_drivers SET ready_since=now() WHERE user_id=d.user_id;
 PERFORM public.log_activity(d.organization_id,'auto_assigned',tid,NULL,_event,jsonb_build_object('operator_id',d.operator_id,'equipment_id',d.equipment_id));
 END IF;
 END LOOP;
END $$;
REVOKE ALL ON FUNCTION public.queue_dispatch(uuid) FROM PUBLIC,anon,authenticated;
CREATE OR REPLACE FUNCTION public.fleet_select(_equipment uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE u public.operator_unlocks; e public.equipment; oldq public.queue_drivers;
BEGIN
 SELECT * INTO u FROM public.operator_unlocks WHERE user_id=auth.uid() AND expires_at>now();
 IF u.user_id IS NULL THEN RAISE EXCEPTION 'Unlock your operator PIN first'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(u.event_id::text,0));
 SELECT * INTO e FROM public.equipment WHERE id=_equipment FOR UPDATE;
 IF e.id IS NULL OR e.organization_id<>(SELECT organization_id FROM public.events WHERE id=u.event_id) OR e.retired_at IS NOT NULL OR e.status='maintenance' THEN RAISE EXCEPTION 'This machine is unavailable'; END IF;
 SELECT * INTO oldq FROM public.queue_drivers WHERE user_id=auth.uid();
 IF oldq.equipment_id IS DISTINCT FROM _equipment AND (EXISTS (SELECT 1 FROM public.work_sessions WHERE operator_id=u.operator_id AND status<>'completed') OR EXISTS (SELECT 1 FROM public.tickets WHERE assigned_operator_id=u.operator_id AND status IN ('assigned','in_progress'))) THEN RAISE EXCEPTION 'Finish your assigned job before switching machines'; END IF;
 DELETE FROM public.queue_drivers q WHERE q.user_id<>auth.uid() AND q.heartbeat_at<now()-interval '60 seconds'
 AND NOT EXISTS (SELECT 1 FROM public.work_sessions s WHERE s.status<>'completed' AND (s.operator_id=q.operator_id OR s.equipment_id=q.equipment_id))
 AND NOT EXISTS (SELECT 1 FROM public.tickets t WHERE t.status IN ('assigned','in_progress') AND (t.assigned_operator_id=q.operator_id OR t.assigned_equipment_id=q.equipment_id));
 IF EXISTS (SELECT 1 FROM public.queue_drivers WHERE user_id<>auth.uid() AND (equipment_id=_equipment OR operator_id=u.operator_id)) THEN RAISE EXCEPTION 'Machine or operator is already selected on another tablet'; END IF;
 IF EXISTS (SELECT 1 FROM public.work_sessions WHERE equipment_id=_equipment AND operator_id<>u.operator_id AND status<>'completed') OR EXISTS (SELECT 1 FROM public.tickets WHERE assigned_equipment_id=_equipment AND assigned_operator_id IS DISTINCT FROM u.operator_id AND status IN ('assigned','in_progress')) THEN RAISE EXCEPTION 'This machine is assigned to another driver'; END IF;
 INSERT INTO public.queue_drivers(user_id,organization_id,event_id,operator_id,equipment_id) VALUES(auth.uid(),e.organization_id,u.event_id,u.operator_id,_equipment)
 ON CONFLICT(user_id) DO UPDATE SET organization_id=EXCLUDED.organization_id,event_id=EXCLUDED.event_id,operator_id=EXCLUDED.operator_id,equipment_id=EXCLUDED.equipment_id,ready=true,ready_since=now(),heartbeat_at=now();
END $$;
CREATE OR REPLACE FUNCTION public.fleet_release() RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE q public.queue_drivers;
BEGIN
 SELECT * INTO q FROM public.queue_drivers WHERE user_id=auth.uid() FOR UPDATE;
 IF q.user_id IS NULL THEN RETURN; END IF;
 IF EXISTS(SELECT 1 FROM public.work_sessions WHERE operator_id=q.operator_id AND status<>'completed') OR EXISTS(SELECT 1 FROM public.tickets WHERE assigned_operator_id=q.operator_id AND status IN ('assigned','in_progress')) THEN RAISE EXCEPTION 'Finish your assigned job before switching'; END IF;
 DELETE FROM public.queue_drivers WHERE user_id=auth.uid();
END $$;
CREATE OR REPLACE FUNCTION public.queue_poll(_ready boolean DEFAULT NULL) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE q public.queue_drivers; tid uuid;
BEGIN
 SELECT * INTO q FROM public.queue_drivers WHERE user_id=auth.uid();
 IF q.user_id IS NULL OR NOT EXISTS(SELECT 1 FROM public.operator_unlocks WHERE user_id=auth.uid() AND operator_id=q.operator_id AND event_id=q.event_id AND expires_at>now()) THEN RAISE EXCEPTION 'Select your operator and machine again'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(q.event_id::text,0));
 UPDATE public.queue_drivers SET heartbeat_at=now(),ready=coalesce(_ready,ready),ready_since=CASE WHEN _ready=true AND NOT ready THEN now() ELSE ready_since END WHERE user_id=auth.uid();
 PERFORM public.queue_dispatch(q.event_id);
 SELECT id INTO tid FROM public.tickets WHERE assigned_operator_id=q.operator_id AND event_id=q.event_id AND status IN ('assigned','in_progress') ORDER BY requested_at LIMIT 1;
 RETURN tid;
END $$;
REVOKE ALL ON FUNCTION public.fleet_select(uuid),public.fleet_release(),public.queue_poll(boolean) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.fleet_select(uuid),public.fleet_release(),public.queue_poll(boolean) TO authenticated;
CREATE OR REPLACE FUNCTION public.fleet_validate() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF TG_OP='UPDATE' THEN
 NEW.organization_id:=OLD.organization_id;
 IF (NEW.status='maintenance' OR NEW.retired_at IS NOT NULL) AND (EXISTS(SELECT 1 FROM public.work_sessions WHERE equipment_id=NEW.id AND status<>'completed') OR EXISTS(SELECT 1 FROM public.tickets WHERE assigned_equipment_id=NEW.id AND status IN ('assigned','in_progress'))) THEN RAISE EXCEPTION 'Finish or reassign active jobs before removing this machine'; END IF;
 END IF;
 IF coalesce(trim(NEW.unit_number),'')='' THEN RAISE EXCEPTION 'Unit number is required'; END IF;
 IF NEW.equipment_class NOT IN ('forklift','reach_truck','telehandler','pallet_jack') OR NEW.fuel_type NOT IN ('unspecified','electric','propane','diesel','manual') THEN RAISE EXCEPTION 'Invalid machine type or fuel'; END IF;
 IF EXISTS(SELECT 1 FROM public.equipment WHERE organization_id=NEW.organization_id AND lower(trim(unit_number))=lower(trim(NEW.unit_number)) AND id<>NEW.id AND retired_at IS NULL) THEN RAISE EXCEPTION 'Unit number already exists'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER fleet_validate BEFORE INSERT OR UPDATE ON public.equipment FOR EACH ROW EXECUTE FUNCTION public.fleet_validate();
ALTER PUBLICATION supabase_realtime ADD TABLE public.queue_drivers;