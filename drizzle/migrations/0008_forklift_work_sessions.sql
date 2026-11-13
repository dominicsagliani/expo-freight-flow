ALTER TYPE public.delivery_update_kind ADD VALUE IF NOT EXISTS 'issue';

-- crew: extra operators/forklifts on a ticket
CREATE TABLE public.ticket_crew (
  ticket_id uuid NOT NULL REFERENCES public.tickets(id) ON DELETE CASCADE,
  operator_id uuid NOT NULL REFERENCES public.operators(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  added_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (ticket_id, operator_id)
);
GRANT SELECT, INSERT, DELETE ON public.ticket_crew TO authenticated;
GRANT ALL ON public.ticket_crew TO service_role;
ALTER TABLE public.ticket_crew ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.ticket_crew_before_insert() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  SELECT organization_id INTO new.organization_id FROM public.tickets WHERE id = new.ticket_id;
  IF new.organization_id IS NULL THEN RAISE EXCEPTION 'Ticket not found'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.operators WHERE id = new.operator_id AND organization_id = new.organization_id) THEN
    RAISE EXCEPTION 'Operator is not in this company'; END IF;
  new.added_by := auth.uid(); new.created_at := now();
  PERFORM public.log_activity(new.organization_id, 'crew_added', new.ticket_id, NULL, NULL, jsonb_build_object('operator_id', new.operator_id));
  RETURN new;
END $$;
CREATE TRIGGER ticket_crew_bi BEFORE INSERT ON public.ticket_crew FOR EACH ROW EXECUTE FUNCTION public.ticket_crew_before_insert();

CREATE OR REPLACE FUNCTION public.operator_ticket_ids() RETURNS SETOF uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  select id from public.tickets where assigned_operator_id in (select public.user_operator_ids())
  union select ticket_id from public.ticket_crew where operator_id in (select public.user_operator_ids())
$$;
CREATE OR REPLACE FUNCTION public.operator_exhibitor_ids() RETURNS SETOF uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  select exhibitor_id from public.tickets where id in (select public.operator_ticket_ids())
$$;
CREATE OR REPLACE FUNCTION public.can_view_ticket(_ticket uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  select exists (select 1 from public.tickets t where t.id = _ticket and (
    public.is_org_staff(t.organization_id)
    or t.exhibitor_id in (select public.user_exhibitor_ids())
    or t.id in (select public.operator_ticket_ids())))
$$;
CREATE OR REPLACE FUNCTION public.can_work_ticket(_ticket uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  select exists (select 1 from public.tickets t where t.id = _ticket and (
    public.is_org_staff(t.organization_id) or t.id in (select public.operator_ticket_ids())))
$$;

CREATE POLICY "crew view" ON public.ticket_crew FOR SELECT TO authenticated USING (public.can_view_ticket(ticket_id));
CREATE POLICY "crew staff add" ON public.ticket_crew FOR INSERT TO authenticated WITH CHECK (public.is_org_staff(organization_id));
CREATE POLICY "crew staff remove" ON public.ticket_crew FOR DELETE TO authenticated USING (public.is_org_staff(organization_id));
CREATE POLICY "crew operators view tickets" ON public.tickets FOR SELECT TO authenticated USING (id IN (SELECT public.operator_ticket_ids()));

-- work sessions
CREATE TYPE public.work_session_status AS ENUM ('active','paused','completed');
CREATE TABLE public.work_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  ticket_id uuid NOT NULL REFERENCES public.tickets(id) ON DELETE CASCADE,
  equipment_id uuid NOT NULL REFERENCES public.equipment(id),
  operator_id uuid NOT NULL REFERENCES public.operators(id),
  status public.work_session_status NOT NULL DEFAULT 'active',
  started_at timestamptz NOT NULL DEFAULT now(),
  ended_at timestamptz,
  paused_at timestamptz,
  paused_seconds integer NOT NULL DEFAULT 0,
  hourly_rate numeric,
  billable_hours numeric,
  billable_amount numeric,
  adjusted_by uuid,
  adjustment_reason text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX work_sessions_one_open ON public.work_sessions (ticket_id, equipment_id) WHERE status <> 'completed';
CREATE INDEX work_sessions_ticket ON public.work_sessions (ticket_id);
GRANT SELECT ON public.work_sessions TO authenticated;
GRANT ALL ON public.work_sessions TO service_role;
ALTER TABLE public.work_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "sessions view" ON public.work_sessions FOR SELECT TO authenticated USING (public.can_view_ticket(ticket_id));

CREATE TABLE public.work_session_pauses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  session_id uuid NOT NULL REFERENCES public.work_sessions(id) ON DELETE CASCADE,
  reason text NOT NULL,
  paused_at timestamptz NOT NULL DEFAULT now(),
  resumed_at timestamptz,
  created_by uuid
);
GRANT SELECT ON public.work_session_pauses TO authenticated;
GRANT ALL ON public.work_session_pauses TO service_role;
ALTER TABLE public.work_session_pauses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "pauses view" ON public.work_session_pauses FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.work_sessions s WHERE s.id = session_id AND public.can_view_ticket(s.ticket_id)));

-- per-item pickup/delivery
ALTER TABLE public.ticket_freight
  ADD COLUMN picked_up_at timestamptz, ADD COLUMN picked_up_by uuid,
  ADD COLUMN picked_up_session_id uuid REFERENCES public.work_sessions(id),
  ADD COLUMN delivered_at timestamptz, ADD COLUMN delivered_by uuid,
  ADD COLUMN delivered_session_id uuid REFERENCES public.work_sessions(id),
  ADD COLUMN booth_verified boolean, ADD COLUMN flag text;

-- issues
ALTER TABLE public.delivery_updates
  ADD COLUMN issue_type text CHECK (issue_type IN ('damaged','missing','wrong_booth','blocked_access','equipment_problem','waiting_assistance','other')),
  ADD COLUMN resolved_at timestamptz, ADD COLUMN resolved_by uuid;

-- helpers
CREATE OR REPLACE FUNCTION public.my_operator_on_ticket(_ticket uuid) RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  select o from (
    select t.assigned_operator_id o from public.tickets t where t.id=_ticket and t.assigned_operator_id in (select public.user_operator_ids())
    union all select c.operator_id from public.ticket_crew c where c.ticket_id=_ticket and c.operator_id in (select public.user_operator_ids())
  ) x limit 1
$$;

CREATE OR REPLACE FUNCTION public.session_hourly_rate(_ticket uuid) RETURNS numeric LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  select sr.rate from public.tickets t
    join public.rate_cards rc on rc.organization_id=t.organization_id and (rc.event_id=t.event_id or (rc.event_id is null and rc.is_default))
    join public.service_rates sr on sr.rate_card_id=rc.id and sr.unit='per_hour'
  where t.id=_ticket
  order by (rc.event_id is not null) desc, (sr.service_type=t.service_type) desc, rc.created_at desc limit 1
$$;

CREATE OR REPLACE FUNCTION public.session_hours(s public.work_sessions) RETURNS numeric LANGUAGE sql STABLE AS $$
  select round(greatest(0, extract(epoch from (coalesce(s.ended_at, now()) - s.started_at))
    - s.paused_seconds - coalesce(extract(epoch from (now() - s.paused_at)),0) * (s.ended_at is null and s.paused_at is not null)::int) / 3600.0, 2)
$$;

CREATE OR REPLACE FUNCTION public.op_start_session(_ticket uuid, _equipment uuid) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE t public.tickets; op uuid; sid uuid;
BEGIN
  op := public.my_operator_on_ticket(_ticket);
  IF op IS NULL THEN RAISE EXCEPTION 'This job is not assigned to you'; END IF;
  SELECT * INTO t FROM public.tickets WHERE id=_ticket FOR UPDATE;
  IF t.status IN ('completed','cancelled') THEN RAISE EXCEPTION 'This job is already %', t.status; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.equipment WHERE id=_equipment AND organization_id=t.organization_id) THEN
    RAISE EXCEPTION 'Pick your forklift first'; END IF;
  SELECT id INTO sid FROM public.work_sessions WHERE ticket_id=_ticket AND equipment_id=_equipment AND status<>'completed';
  IF sid IS NOT NULL THEN RETURN sid; END IF;
  INSERT INTO public.work_sessions (organization_id, ticket_id, equipment_id, operator_id, hourly_rate)
    VALUES (t.organization_id, _ticket, _equipment, op, public.session_hourly_rate(_ticket)) RETURNING id INTO sid;
  IF t.status IN ('requested','assigned') THEN
    UPDATE public.tickets SET status='in_progress', started_at=coalesce(started_at, now()) WHERE id=_ticket;
  END IF;
  UPDATE public.operators SET status='on_job' WHERE id=op;
  UPDATE public.equipment SET status='in_use' WHERE id=_equipment;
  PERFORM public.log_activity(t.organization_id, 'session_started', _ticket, NULL, t.event_id, jsonb_build_object('session_id', sid, 'equipment_id', _equipment));
  RETURN sid;
END $$;

CREATE OR REPLACE FUNCTION public.op_pause_session(_session uuid, _reason text) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE s public.work_sessions;
BEGIN
  SELECT * INTO s FROM public.work_sessions WHERE id=_session FOR UPDATE;
  IF s.id IS NULL OR NOT public.can_work_ticket(s.ticket_id) THEN RAISE EXCEPTION 'Session not found'; END IF;
  IF s.status<>'active' THEN RAISE EXCEPTION 'Only a running timer can be paused'; END IF;
  IF coalesce(trim(_reason),'')='' THEN RAISE EXCEPTION 'Pick a reason'; END IF;
  UPDATE public.work_sessions SET status='paused', paused_at=now() WHERE id=_session;
  INSERT INTO public.work_session_pauses (organization_id, session_id, reason, created_by) VALUES (s.organization_id, _session, trim(_reason), auth.uid());
  PERFORM public.log_activity(s.organization_id, 'session_paused', s.ticket_id, NULL, NULL, jsonb_build_object('session_id', _session, 'reason', trim(_reason)));
END $$;

CREATE OR REPLACE FUNCTION public.op_resume_session(_session uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE s public.work_sessions;
BEGIN
  SELECT * INTO s FROM public.work_sessions WHERE id=_session FOR UPDATE;
  IF s.id IS NULL OR NOT public.can_work_ticket(s.ticket_id) THEN RAISE EXCEPTION 'Session not found'; END IF;
  IF s.status<>'paused' THEN RAISE EXCEPTION 'Timer is not paused'; END IF;
  UPDATE public.work_sessions SET status='active', paused_at=NULL,
    paused_seconds = paused_seconds + extract(epoch from now()-s.paused_at)::int WHERE id=_session;
  UPDATE public.work_session_pauses SET resumed_at=now() WHERE session_id=_session AND resumed_at IS NULL;
  PERFORM public.log_activity(s.organization_id, 'session_resumed', s.ticket_id, NULL, NULL, jsonb_build_object('session_id', _session));
END $$;

CREATE OR REPLACE FUNCTION public.op_complete_session(_session uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE s public.work_sessions; h numeric;
BEGIN
  SELECT * INTO s FROM public.work_sessions WHERE id=_session FOR UPDATE;
  IF s.id IS NULL OR NOT public.can_work_ticket(s.ticket_id) THEN RAISE EXCEPTION 'Session not found'; END IF;
  IF s.status='completed' THEN RAISE EXCEPTION 'This timer is already stopped'; END IF;
  IF s.status='paused' THEN
    s.paused_seconds := s.paused_seconds + extract(epoch from now()-s.paused_at)::int;
    UPDATE public.work_session_pauses SET resumed_at=now() WHERE session_id=_session AND resumed_at IS NULL;
  END IF;
  s.ended_at := now(); s.paused_at := NULL;
  h := public.session_hours(s);
  UPDATE public.work_sessions SET status='completed', ended_at=s.ended_at, paused_at=NULL, paused_seconds=s.paused_seconds,
    billable_hours=h, billable_amount=CASE WHEN hourly_rate IS NULL THEN NULL ELSE round(h*hourly_rate,2) END WHERE id=_session;
  UPDATE public.equipment SET status='available' WHERE id=s.equipment_id
    AND NOT EXISTS (SELECT 1 FROM public.work_sessions x WHERE x.equipment_id=s.equipment_id AND x.status<>'completed');
  UPDATE public.operators SET status='available' WHERE id=s.operator_id
    AND NOT EXISTS (SELECT 1 FROM public.work_sessions x WHERE x.operator_id=s.operator_id AND x.status<>'completed');
  PERFORM public.log_activity(s.organization_id, 'session_completed', s.ticket_id, NULL, NULL, jsonb_build_object('session_id', _session, 'hours', h));
END $$;

CREATE OR REPLACE FUNCTION public.op_scan_freight(_token text, _ticket uuid, _action text, _equipment uuid DEFAULT NULL,
  _booth_ok boolean DEFAULT NULL, _flag text DEFAULT NULL, _note text DEFAULT NULL) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE f public.freight_items; tf public.ticket_freight; t public.tickets; sid uuid; ex text;
BEGIN
  IF NOT public.can_work_ticket(_ticket) THEN RETURN jsonb_build_object('ok', false, 'error', 'This job is not assigned to you'); END IF;
  SELECT * INTO t FROM public.tickets WHERE id=_ticket;
  SELECT * INTO f FROM public.freight_items WHERE qr_token=trim(_token) AND organization_id=t.organization_id;
  IF f.id IS NULL THEN RETURN jsonb_build_object('ok', false, 'error', 'Unknown freight label'); END IF;
  SELECT company_name INTO ex FROM public.exhibitors WHERE id=f.exhibitor_id;
  SELECT * INTO tf FROM public.ticket_freight WHERE ticket_id=_ticket AND freight_id=f.id FOR UPDATE;
  IF tf.ticket_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Wrong freight — not on this job', 'freight_code', f.freight_code, 'exhibitor', ex, 'booth', f.booth_number);
  END IF;
  IF _action='pickup' THEN
    IF tf.picked_up_at IS NOT NULL THEN RETURN jsonb_build_object('ok', false, 'error', 'Already picked up', 'freight_code', f.freight_code); END IF;
    sid := public.op_start_session(_ticket, _equipment);
    UPDATE public.ticket_freight SET picked_up_at=now(), picked_up_by=auth.uid(), picked_up_session_id=sid,
      scanned_at=coalesce(scanned_at, now()), scanned_by=coalesce(scanned_by, auth.uid()) WHERE ticket_id=_ticket AND freight_id=f.id;
    INSERT INTO public.delivery_updates (ticket_id, freight_id, kind) VALUES (_ticket, f.id, 'picked_up');
  ELSIF _action='deliver' THEN
    IF tf.delivered_at IS NOT NULL THEN RETURN jsonb_build_object('ok', false, 'error', 'Already delivered', 'freight_code', f.freight_code); END IF;
    IF tf.picked_up_at IS NULL THEN RETURN jsonb_build_object('ok', false, 'error', 'Scan pickup first', 'freight_code', f.freight_code); END IF;
    IF _flag IS NOT NULL AND _flag NOT IN ('damaged','missing') THEN RAISE EXCEPTION 'Bad flag'; END IF;
    SELECT id INTO sid FROM public.work_sessions WHERE ticket_id=_ticket AND status<>'completed'
      AND (equipment_id=_equipment OR _equipment IS NULL) ORDER BY started_at DESC LIMIT 1;
    UPDATE public.ticket_freight SET delivered_at=now(), delivered_by=auth.uid(), delivered_session_id=sid,
      booth_verified=_booth_ok, flag=_flag WHERE ticket_id=_ticket AND freight_id=f.id;
    UPDATE public.freight_items SET arrival_status='delivered_to_booth' WHERE id=f.id;
    INSERT INTO public.delivery_updates (ticket_id, freight_id, kind, note, location)
      VALUES (_ticket, f.id, 'delivered', nullif(trim(coalesce(_note,'')),''), f.booth_number);
    IF _flag IS NOT NULL THEN
      INSERT INTO public.delivery_updates (ticket_id, freight_id, kind, issue_type, note)
        VALUES (_ticket, f.id, 'issue', _flag, nullif(trim(coalesce(_note,'')),''));
    END IF;
  ELSE RAISE EXCEPTION 'Unknown action'; END IF;
  RETURN jsonb_build_object('ok', true, 'action', _action, 'freight_id', f.id, 'freight_code', f.freight_code,
    'description', f.description, 'exhibitor', ex, 'booth', f.booth_number, 'ticket_number', t.ticket_number, 'session_id', sid);
END $$;

CREATE OR REPLACE FUNCTION public.staff_correct_scan(_ticket uuid, _freight uuid, _what text, _reason text) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE t public.tickets;
BEGIN
  SELECT * INTO t FROM public.tickets WHERE id=_ticket;
  IF t.id IS NULL OR NOT public.is_org_staff(t.organization_id) THEN RAISE EXCEPTION 'Only dispatchers and admins can correct scans'; END IF;
  IF coalesce(trim(_reason),'')='' THEN RAISE EXCEPTION 'A reason is required'; END IF;
  IF _what='delivery' THEN
    UPDATE public.ticket_freight SET delivered_at=NULL, delivered_by=NULL, delivered_session_id=NULL, booth_verified=NULL, flag=NULL
      WHERE ticket_id=_ticket AND freight_id=_freight;
  ELSIF _what='pickup' THEN
    UPDATE public.ticket_freight SET picked_up_at=NULL, picked_up_by=NULL, picked_up_session_id=NULL,
      delivered_at=NULL, delivered_by=NULL, delivered_session_id=NULL, booth_verified=NULL, flag=NULL
      WHERE ticket_id=_ticket AND freight_id=_freight;
  ELSE RAISE EXCEPTION 'Unknown correction'; END IF;
  PERFORM public.log_activity(t.organization_id, 'scan_corrected', _ticket, _freight, t.event_id, jsonb_build_object('undo', _what, 'reason', trim(_reason)));
END $$;

CREATE OR REPLACE FUNCTION public.resolve_issue(_update uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE d public.delivery_updates;
BEGIN
  SELECT * INTO d FROM public.delivery_updates WHERE id=_update;
  IF d.id IS NULL OR NOT public.is_org_staff(d.organization_id) THEN RAISE EXCEPTION 'Not allowed'; END IF;
  UPDATE public.delivery_updates SET resolved_at=now(), resolved_by=auth.uid() WHERE id=_update AND resolved_at IS NULL;
  PERFORM public.log_activity(d.organization_id, 'issue_resolved', d.ticket_id, d.freight_id, NULL, jsonb_build_object('issue_type', d.issue_type));
END $$;

-- charge uses forklift session hours when dispatcher hasn't entered hours
CREATE OR REPLACE FUNCTION public.calc_ticket_charge(_org uuid, _event uuid, _service service_type, _ticket uuid, _started timestamptz, _completed timestamptz, _labor numeric)
 RETURNS numeric LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $function$
DECLARE r public.service_rates; w numeric; p integer; hrs numeric; amt numeric; sess numeric;
BEGIN
  SELECT sr.* INTO r FROM public.service_rates sr JOIN public.rate_cards rc ON rc.id = sr.rate_card_id
   WHERE rc.organization_id = _org AND sr.service_type = _service
     AND (rc.event_id = _event OR (rc.event_id IS NULL AND rc.is_default))
   ORDER BY (rc.event_id IS NOT NULL) DESC, rc.created_at DESC LIMIT 1;
  IF r.id IS NULL THEN RETURN NULL; END IF;
  SELECT coalesce(sum(f.weight_lbs),0), coalesce(sum(f.pieces),0) INTO w, p
    FROM public.ticket_freight tf JOIN public.freight_items f ON f.id = tf.freight_id WHERE tf.ticket_id = _ticket;
  IF r.unit = 'per_cwt' THEN amt := ceil(w / 100.0) * r.rate;
  ELSIF r.unit = 'per_piece' THEN amt := p * r.rate;
  ELSIF r.unit = 'per_hour' THEN
    IF _labor IS NULL AND EXISTS (SELECT 1 FROM public.work_sessions WHERE ticket_id=_ticket) THEN
      SELECT sum(coalesce(s.billable_hours, public.session_hours(s)) * coalesce(s.hourly_rate, r.rate)) INTO sess
        FROM public.work_sessions s WHERE s.ticket_id=_ticket;
      amt := sess;
    ELSE
      hrs := CASE WHEN _labor IS NOT NULL THEN _labor
                  WHEN _started IS NULL OR _completed IS NULL THEN 1
                  ELSE greatest(0.5, ceil(extract(epoch FROM (_completed - _started)) / 1800.0) / 2.0) END;
      amt := hrs * r.rate;
    END IF;
  ELSE amt := r.rate; END IF;
  RETURN round(greatest(amt, r.minimum_charge), 2);
END $function$;

GRANT EXECUTE ON FUNCTION public.op_start_session(uuid,uuid), public.op_pause_session(uuid,text), public.op_resume_session(uuid),
  public.op_complete_session(uuid), public.op_scan_freight(text,uuid,text,uuid,boolean,text,text),
  public.staff_correct_scan(uuid,uuid,text,text), public.resolve_issue(uuid) TO authenticated;

ALTER PUBLICATION supabase_realtime ADD TABLE public.work_sessions, public.ticket_freight, public.delivery_updates, public.tickets;