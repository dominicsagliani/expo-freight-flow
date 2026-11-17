CREATE OR REPLACE FUNCTION public.queue_dispatch(_event uuid)
 RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
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
 OR EXISTS (SELECT 1 FROM public.ticket_crew c JOIN public.tickets t ON t.id=c.ticket_id WHERE (c.operator_id=d.operator_id OR c.equipment_id=d.equipment_id) AND t.status IN ('assigned','in_progress')) THEN CONTINUE; END IF;
 SELECT t.id INTO tid FROM public.tickets t WHERE t.event_id=_event AND t.organization_id=d.organization_id AND t.status='requested' AND t.held_at IS NULL
 AND t.assigned_operator_id IS NULL AND t.assigned_equipment_id IS NULL AND public.queue_compatible(t.id,d.equipment_id)
 ORDER BY CASE t.priority WHEN 'urgent' THEN 0 WHEN 'high' THEN 1 WHEN 'normal' THEN 2 ELSE 3 END,t.requested_at,t.id FOR UPDATE SKIP LOCKED LIMIT 1;
 IF tid IS NOT NULL THEN
 UPDATE public.tickets SET assigned_operator_id=d.operator_id,assigned_equipment_id=d.equipment_id,status='assigned',assigned_at=now() WHERE id=tid;
 UPDATE public.queue_drivers SET ready_since=now() WHERE user_id=d.user_id;
 PERFORM public.log_activity(d.organization_id,'auto_assigned',tid,NULL,_event,jsonb_build_object('operator_id',d.operator_id,'equipment_id',d.equipment_id));
 END IF;
 END LOOP;
END $function$;

CREATE OR REPLACE FUNCTION public.tickets_hold_guard() RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $$
BEGIN
  IF (new.held_at IS DISTINCT FROM old.held_at OR new.hold_reason IS DISTINCT FROM old.hold_reason OR new.held_by IS DISTINCT FROM old.held_by)
     AND coalesce(current_setting('expohaul.hold_rpc', true),'') <> '1' THEN
    RAISE EXCEPTION 'Use Hold / Release to change a job hold';
  END IF;
  IF new.held_at IS NOT NULL AND (new.status IN ('assigned','in_progress') OR new.assigned_operator_id IS NOT NULL OR new.assigned_equipment_id IS NOT NULL) THEN
    RAISE EXCEPTION 'This job is on hold — release it before assigning';
  END IF;
  RETURN new;
END $$;
DROP TRIGGER IF EXISTS tickets_hold_guard ON public.tickets;
CREATE TRIGGER tickets_hold_guard BEFORE UPDATE ON public.tickets FOR EACH ROW EXECUTE FUNCTION public.tickets_hold_guard();

CREATE OR REPLACE FUNCTION public.set_ticket_hold(_ticket uuid, _hold boolean, _reason text DEFAULT NULL) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE t public.tickets;
BEGIN
  SELECT * INTO t FROM public.tickets WHERE id=_ticket;
  IF t.id IS NULL OR NOT public.is_org_staff(t.organization_id) THEN RAISE EXCEPTION 'Only dispatch staff can hold jobs'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(t.event_id::text,0));
  SELECT * INTO t FROM public.tickets WHERE id=_ticket FOR UPDATE;
  PERFORM set_config('expohaul.hold_rpc','1',true);
  IF _hold THEN
    IF t.status NOT IN ('requested','assigned') THEN RAISE EXCEPTION 'Only waiting or assigned jobs can be put on hold'; END IF;
    IF EXISTS (SELECT 1 FROM public.work_sessions s WHERE s.ticket_id=_ticket AND s.status<>'completed') THEN
      RAISE EXCEPTION 'A forklift timer is running on this job'; END IF;
    IF EXISTS (SELECT 1 FROM public.ticket_freight tf WHERE tf.ticket_id=_ticket AND tf.picked_up_at IS NOT NULL AND tf.delivered_at IS NULL) THEN
      RAISE EXCEPTION 'Freight is loaded on a forklift — deliver it first'; END IF;
    DELETE FROM public.ticket_crew WHERE ticket_id=_ticket;
    UPDATE public.tickets SET assigned_operator_id=NULL, assigned_equipment_id=NULL, status='requested',
      held_at=now(), held_by=auth.uid(), hold_reason=nullif(trim(coalesce(_reason,'')),'') WHERE id=_ticket;
    PERFORM public.log_activity(t.organization_id,'job_held',_ticket,NULL,t.event_id,jsonb_build_object('reason',_reason));
  ELSE
    IF t.held_at IS NULL THEN RETURN; END IF;
    UPDATE public.tickets SET held_at=NULL, held_by=NULL, hold_reason=NULL WHERE id=_ticket;
    PERFORM public.log_activity(t.organization_id,'job_released',_ticket,NULL,t.event_id,'{}'::jsonb);
    PERFORM public.queue_dispatch(t.event_id);
  END IF;
END $$;
GRANT EXECUTE ON FUNCTION public.set_ticket_hold(uuid, boolean, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.ticket_crew_before_insert() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE t public.tickets;
BEGIN
  SELECT * INTO t FROM public.tickets WHERE id = new.ticket_id;
  IF t.id IS NULL THEN RAISE EXCEPTION 'Ticket not found'; END IF;
  new.organization_id := t.organization_id;
  IF t.held_at IS NOT NULL THEN RAISE EXCEPTION 'This job is on hold'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.operators WHERE id = new.operator_id AND organization_id = new.organization_id AND retired_at IS NULL) THEN
    RAISE EXCEPTION 'Operator is not in this company'; END IF;
  IF new.equipment_id IS NULL THEN RAISE EXCEPTION 'Choose the forklift this operator will drive'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.equipment WHERE id = new.equipment_id AND organization_id = new.organization_id AND retired_at IS NULL AND status <> 'maintenance') THEN
    RAISE EXCEPTION 'Forklift is not available in this company'; END IF;
  IF new.operator_id = t.assigned_operator_id OR new.equipment_id = t.assigned_equipment_id THEN
    RAISE EXCEPTION 'That driver or forklift is already the lead on this job'; END IF;
  IF (SELECT count(*) FROM public.ticket_crew WHERE ticket_id = new.ticket_id) >= 2 THEN
    RAISE EXCEPTION 'A job can have at most three forklifts'; END IF;
  new.added_by := auth.uid(); new.created_at := now();
  PERFORM public.log_activity(new.organization_id, 'crew_added', new.ticket_id, NULL, NULL, jsonb_build_object('operator_id', new.operator_id, 'equipment_id', new.equipment_id));
  RETURN new;
END $$;

CREATE OR REPLACE FUNCTION public.invitations_before_write() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
BEGIN
  new.email := lower(trim(new.email));
  IF new.role = 'super_admin' THEN RAISE EXCEPTION 'Platform owner access cannot be granted by invitation'; END IF;
  IF new.role = 'exhibitor' AND new.exhibitor_id IS NULL THEN RAISE EXCEPTION 'Choose which exhibitor this person represents'; END IF;
  IF new.role = 'operator' AND new.operator_id IS NULL THEN RAISE EXCEPTION 'Choose which operator this person is'; END IF;
  IF new.role::text IN ('venue','organizer') AND new.event_id IS NULL THEN RAISE EXCEPTION 'Choose which event this person can view'; END IF;
  IF new.role NOT IN ('exhibitor') THEN new.exhibitor_id := NULL; END IF;
  IF new.role NOT IN ('operator') THEN new.operator_id := NULL; END IF;
  IF new.role::text NOT IN ('venue','organizer') THEN new.event_id := NULL; END IF;
  IF new.exhibitor_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.exhibitors WHERE id = new.exhibitor_id AND organization_id = new.organization_id) THEN
    RAISE EXCEPTION 'Exhibitor belongs to another company'; END IF;
  IF new.operator_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.operators WHERE id = new.operator_id AND organization_id = new.organization_id) THEN
    RAISE EXCEPTION 'Operator belongs to another company'; END IF;
  IF new.event_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.events WHERE id = new.event_id AND organization_id = new.organization_id) THEN
    RAISE EXCEPTION 'Event belongs to another company'; END IF;
  IF tg_op = 'INSERT' THEN new.invited_by := auth.uid(); new.status := 'pending'; END IF;
  RETURN new;
END $function$;

CREATE OR REPLACE FUNCTION public.accept_my_invitations() RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE _email text; _confirmed timestamptz; _n integer := 0; r record;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not signed in'; END IF;
  SELECT lower(email), email_confirmed_at INTO _email, _confirmed FROM auth.users WHERE id = auth.uid();
  IF _email IS NULL OR _confirmed IS NULL THEN RETURN 0; END IF;
  FOR r IN SELECT * FROM public.invitations WHERE email = _email AND status = 'pending' AND expires_at > now() LOOP
    IF NOT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND organization_id = r.organization_id AND role = r.role
                   AND exhibitor_id IS NOT DISTINCT FROM r.exhibitor_id AND operator_id IS NOT DISTINCT FROM r.operator_id AND event_id IS NOT DISTINCT FROM r.event_id) THEN
      INSERT INTO public.user_roles (user_id, organization_id, role, exhibitor_id, operator_id, event_id)
      VALUES (auth.uid(), r.organization_id, r.role, r.exhibitor_id, r.operator_id, r.event_id);
    END IF;
    IF r.operator_id IS NOT NULL THEN
      UPDATE public.operators SET user_id = auth.uid() WHERE id = r.operator_id AND user_id IS NULL;
    END IF;
    UPDATE public.invitations SET status = 'accepted', accepted_by = auth.uid(), accepted_at = now() WHERE id = r.id;
    _n := _n + 1;
  END LOOP;
  RETURN _n;
END $function$;

CREATE OR REPLACE FUNCTION public.can_view_event_status(_event uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT EXISTS (SELECT 1 FROM public.events e WHERE e.id=_event AND public.is_org_staff(e.organization_id))
      OR EXISTS (SELECT 1 FROM public.user_roles r JOIN public.events e ON e.id=r.event_id AND e.organization_id=r.organization_id
                 WHERE r.user_id=auth.uid() AND r.event_id=_event AND r.role::text IN ('venue','organizer'))
$$;

CREATE OR REPLACE FUNCTION public.viewer_events() RETURNS TABLE(id uuid, name text, venue text, start_date date, end_date date, status event_status)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT e.id, e.name, e.venue, e.start_date, e.end_date, e.status FROM public.events e
  WHERE public.can_view_event_status(e.id) ORDER BY e.start_date
$$;

CREATE OR REPLACE FUNCTION public.event_status_board(_event uuid)
RETURNS TABLE(exhibitor_name text, booth_number text, freight_total integer, freight_received integer, freight_delivered integer, jobs_open integer, jobs_held integer, jobs_completed integer, open_issues integer)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF NOT public.can_view_event_status(_event) THEN RAISE EXCEPTION 'You do not have access to this event'; END IF;
  RETURN QUERY
  SELECT x.company_name, ee.booth_number,
    (SELECT count(*)::int FROM public.freight_items f WHERE f.event_id=_event AND f.exhibitor_id=ee.exhibitor_id),
    (SELECT count(*)::int FROM public.freight_items f WHERE f.event_id=_event AND f.exhibitor_id=ee.exhibitor_id AND f.arrival_status<>'expected'),
    (SELECT count(*)::int FROM public.freight_items f WHERE f.event_id=_event AND f.exhibitor_id=ee.exhibitor_id AND f.arrival_status IN ('delivered_to_booth','outbound','shipped')),
    (SELECT count(*)::int FROM public.tickets t WHERE t.event_id=_event AND t.exhibitor_id=ee.exhibitor_id AND t.status IN ('requested','assigned','in_progress') AND t.held_at IS NULL),
    (SELECT count(*)::int FROM public.tickets t WHERE t.event_id=_event AND t.exhibitor_id=ee.exhibitor_id AND t.held_at IS NOT NULL AND t.status='requested'),
    (SELECT count(*)::int FROM public.tickets t WHERE t.event_id=_event AND t.exhibitor_id=ee.exhibitor_id AND t.status='completed'),
    (SELECT count(*)::int FROM public.freight_issues i JOIN public.freight_items f ON f.id=i.freight_id WHERE f.event_id=_event AND f.exhibitor_id=ee.exhibitor_id AND i.resolved_at IS NULL)
  FROM public.event_exhibitors ee JOIN public.exhibitors x ON x.id=ee.exhibitor_id
  WHERE ee.event_id=_event ORDER BY ee.booth_number;
END $$;
GRANT EXECUTE ON FUNCTION public.viewer_events() TO authenticated;
GRANT EXECUTE ON FUNCTION public.event_status_board(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_view_event_status(uuid) TO authenticated;