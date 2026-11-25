CREATE OR REPLACE FUNCTION public.delete_event_and_exhibitors(_event uuid, _delete_exhibitors boolean)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE org uuid; ids uuid[]; n integer := 0;
BEGIN
 SELECT organization_id INTO org FROM public.events WHERE id=_event;
 IF org IS NULL THEN RAISE EXCEPTION 'Event not found'; END IF;
 IF auth.uid() IS NULL OR NOT public.is_org_admin(org) THEN RAISE EXCEPTION 'Only company admins can delete events'; END IF;
 IF _delete_exhibitors THEN
   SELECT coalesce(array_agg(DISTINCT x.id), '{}') INTO ids FROM public.exhibitors x
   WHERE x.organization_id=org
     AND (EXISTS(SELECT 1 FROM public.event_exhibitors ee WHERE ee.exhibitor_id=x.id AND ee.event_id=_event)
          OR EXISTS(SELECT 1 FROM public.freight_items f WHERE f.exhibitor_id=x.id AND f.event_id=_event))
     AND NOT EXISTS(SELECT 1 FROM public.event_exhibitors ee WHERE ee.exhibitor_id=x.id AND ee.event_id<>_event)
     AND NOT EXISTS(SELECT 1 FROM public.freight_items f WHERE f.exhibitor_id=x.id AND f.event_id<>_event)
     AND NOT EXISTS(SELECT 1 FROM public.tickets t WHERE t.exhibitor_id=x.id AND t.event_id<>_event)
     AND NOT EXISTS(SELECT 1 FROM public.bills_of_lading b WHERE b.exhibitor_id=x.id AND b.event_id<>_event)
     AND NOT EXISTS(SELECT 1 FROM public.inbound_shipments s WHERE s.exhibitor_id=x.id AND s.event_id<>_event);
 END IF;
 PERFORM public.delete_event(_event);
 IF _delete_exhibitors AND array_length(ids,1) > 0 THEN
   UPDATE public.booth_markers SET exhibitor_id=NULL WHERE exhibitor_id = ANY(ids);
   DELETE FROM public.exhibitors WHERE organization_id=org AND id = ANY(ids);
   GET DIAGNOSTICS n = ROW_COUNT;
 END IF;
 RETURN n;
END $$;
REVOKE ALL ON FUNCTION public.delete_event_and_exhibitors(uuid, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.delete_event_and_exhibitors(uuid, boolean) TO authenticated;