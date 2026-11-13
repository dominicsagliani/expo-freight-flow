ALTER TABLE public.tickets ADD COLUMN request_source text NOT NULL DEFAULT 'standard' CHECK (request_source IN ('standard','phone','walk_in','radio')), ADD COLUMN service_only boolean NOT NULL DEFAULT false, ADD COLUMN estimated_weight_lbs numeric CHECK (estimated_weight_lbs > 0), ADD COLUMN intake_key uuid UNIQUE;
CREATE OR REPLACE FUNCTION public.queue_compatible(_ticket uuid, _equipment uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
 SELECT EXISTS (SELECT 1 FROM public.tickets t JOIN public.equipment e ON e.id=_equipment AND e.organization_id=t.organization_id
 WHERE t.id=_ticket AND e.retired_at IS NULL AND e.status='available' AND e.capacity_lbs>0 AND t.required_equipment_class=e.equipment_class
 AND (CASE WHEN EXISTS (SELECT 1 FROM public.ticket_freight WHERE ticket_id=t.id) THEN
 NOT EXISTS (SELECT 1 FROM public.ticket_freight tf JOIN public.freight_items f ON f.id=tf.freight_id WHERE tf.ticket_id=t.id AND (f.weight_lbs IS NULL OR f.weight_lbs<=0 OR f.event_id<>t.event_id))
 AND (SELECT sum(f.weight_lbs) FROM public.ticket_freight tf JOIN public.freight_items f ON f.id=tf.freight_id WHERE tf.ticket_id=t.id)<=e.capacity_lbs
 ELSE t.request_source<>'standard' AND (t.service_only OR (t.estimated_weight_lbs>0 AND t.estimated_weight_lbs<=e.capacity_lbs)) END));
$$;
CREATE OR REPLACE FUNCTION public.dispatch_next_available(_event uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE org uuid;
BEGIN
 SELECT organization_id INTO org FROM public.events WHERE id=_event AND status<>'closed';
 IF org IS NULL OR NOT public.is_org_staff(org) THEN RAISE EXCEPTION 'Only event dispatch staff can dispatch this queue'; END IF;
 PERFORM public.queue_dispatch(_event);
END $$;
REVOKE ALL ON FUNCTION public.dispatch_next_available(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.dispatch_next_available(uuid) TO authenticated;
CREATE OR REPLACE FUNCTION public.create_call_in(_event uuid, _exhibitor uuid, _location text, _service public.service_type, _priority public.ticket_priority, _class text, _service_only boolean, _weight numeric, _notes text, _source text, _key uuid) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE org uuid; tid uuid; existing public.tickets;
BEGIN
 SELECT organization_id INTO org FROM public.events WHERE id=_event AND status<>'closed';
 IF org IS NULL OR NOT public.is_org_staff(org) THEN RAISE EXCEPTION 'Only event dispatch staff can create call-in requests'; END IF;
 IF _key IS NULL THEN RAISE EXCEPTION 'Request identifier required'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(_key::text,0));
 SELECT * INTO existing FROM public.tickets WHERE intake_key=_key;
 IF existing.id IS NOT NULL THEN
 IF existing.organization_id<>org OR existing.event_id<>_event THEN RAISE EXCEPTION 'Request identifier already used'; END IF;
 RETURN existing.id;
 END IF;
 IF NOT EXISTS(SELECT 1 FROM public.event_exhibitors WHERE event_id=_event AND exhibitor_id=_exhibitor) THEN RAISE EXCEPTION 'Choose an exhibitor registered at this event'; END IF;
 IF coalesce(trim(_location),'')='' OR length(_location)>300 THEN RAISE EXCEPTION 'Enter a location (up to 300 characters)'; END IF;
 IF _class IS NULL OR _class NOT IN ('forklift','reach_truck','telehandler','pallet_jack') OR _source IS NULL OR _source NOT IN ('phone','walk_in','radio') OR _service_only IS NULL OR _service IS NULL OR _priority IS NULL THEN RAISE EXCEPTION 'Invalid request details'; END IF;
 IF _weight IS NOT NULL AND _weight<=0 THEN RAISE EXCEPTION 'Load weight must be positive'; END IF;
 IF length(coalesce(_notes,''))>2000 THEN RAISE EXCEPTION 'Notes must be 2000 characters or less'; END IF;
 INSERT INTO public.tickets(event_id, exhibitor_id, destination, service_type, priority, required_equipment_class, service_only, estimated_weight_lbs, special_instructions, request_source, intake_key, ticket_number)
 VALUES (_event,_exhibitor,trim(_location),_service,_priority,_class,_service_only,CASE WHEN _service_only THEN NULL ELSE _weight END,nullif(trim(_notes),''),_source,_key) RETURNING id INTO tid;
 PERFORM public.queue_dispatch(_event);
 RETURN tid;
END $$;
REVOKE ALL ON FUNCTION public.create_call_in(uuid,uuid,text,public.service_type,public.ticket_priority,text,boolean,numeric,text,text,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.create_call_in(uuid,uuid,text,public.service_type,public.ticket_priority,text,boolean,numeric,text,text,uuid) TO authenticated;
CREATE OR REPLACE FUNCTION public.op_complete_call_in(_ticket uuid, _notes text DEFAULT NULL) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE t public.tickets; s public.work_sessions;
BEGIN
 SELECT * INTO t FROM public.tickets WHERE id=_ticket;
 IF t.id IS NULL OR t.request_source='standard' OR t.assigned_operator_id NOT IN (SELECT public.user_operator_ids()) OR t.assigned_operator_id IS NULL THEN RAISE EXCEPTION 'This call-in is not assigned to you'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(t.event_id::text,0));
 SELECT * INTO t FROM public.tickets WHERE id=_ticket FOR UPDATE;
 IF t.status<>'in_progress' THEN RAISE EXCEPTION 'Start work before completing this request'; END IF;
 IF EXISTS(SELECT 1 FROM public.ticket_freight WHERE ticket_id=_ticket) THEN RAISE EXCEPTION 'Deliver attached freight before completing through the freight workflow'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.work_sessions WHERE ticket_id=_ticket) THEN RAISE EXCEPTION 'Start the work timer first'; END IF;
 FOR s IN SELECT * FROM public.work_sessions WHERE ticket_id=_ticket AND status<>'completed' FOR UPDATE LOOP
 IF s.operator_id<>t.assigned_operator_id THEN RAISE EXCEPTION 'Other operators must finish their work first'; END IF;
 PERFORM public.op_complete_session(s.id);
 END LOOP;
 PERFORM public.operator_complete_job(_ticket,_notes);
 PERFORM public.queue_dispatch(t.event_id);
END $$;
REVOKE ALL ON FUNCTION public.op_complete_call_in(uuid,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.op_complete_call_in(uuid,text) TO authenticated;