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
 VALUES (_event,_exhibitor,trim(_location),_service,_priority,_class,_service_only,CASE WHEN _service_only THEN NULL ELSE _weight END,nullif(trim(_notes),''),_source,_key,'') RETURNING id INTO tid;
 PERFORM public.queue_dispatch(_event);
 RETURN tid;
END $$;
REVOKE ALL ON FUNCTION public.create_call_in(uuid,uuid,text,public.service_type,public.ticket_priority,text,boolean,numeric,text,text,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.create_call_in(uuid,uuid,text,public.service_type,public.ticket_priority,text,boolean,numeric,text,text,uuid) TO authenticated;