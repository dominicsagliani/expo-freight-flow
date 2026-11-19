CREATE OR REPLACE FUNCTION public.my_operator_ids() RETURNS SETOF uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.user_operator_ids()
  UNION SELECT f.operator_id FROM public.forklift_current() f
  UNION SELECT q.operator_id FROM public.queue_drivers q WHERE q.user_id = auth.uid()
$$;
REVOKE ALL ON FUNCTION public.my_operator_ids() FROM public, anon;
GRANT EXECUTE ON FUNCTION public.my_operator_ids() TO authenticated;

CREATE TABLE public.incentive_settings (
  organization_id uuid PRIMARY KEY REFERENCES public.organizations(id) ON DELETE CASCADE,
  w_productivity integer NOT NULL DEFAULT 30,
  w_accuracy integer NOT NULL DEFAULT 25,
  w_on_time integer NOT NULL DEFAULT 20,
  w_documentation integer NOT NULL DEFAULT 15,
  w_reliability integer NOT NULL DEFAULT 10,
  target_units_per_hour numeric NOT NULL DEFAULT 4 CHECK (target_units_per_hour > 0),
  on_time_minutes integer NOT NULL DEFAULT 45 CHECK (on_time_minutes > 0),
  daily_goal_crates integer NOT NULL DEFAULT 10 CHECK (daily_goal_crates > 0),
  time_zone text NOT NULL DEFAULT 'America/New_York',
  updated_by uuid,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT incentive_weights_valid CHECK (
    w_productivity >= 0 AND w_accuracy >= 0 AND w_on_time >= 0 AND w_documentation >= 0 AND w_reliability >= 0
    AND w_productivity + w_accuracy + w_on_time + w_documentation + w_reliability = 100)
);
GRANT SELECT, INSERT, UPDATE ON public.incentive_settings TO authenticated;
GRANT ALL ON public.incentive_settings TO service_role;
ALTER TABLE public.incentive_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Members read incentive settings" ON public.incentive_settings FOR SELECT TO authenticated USING (public.is_org_member(organization_id));
CREATE POLICY "Admins create incentive settings" ON public.incentive_settings FOR INSERT TO authenticated WITH CHECK (public.is_org_admin(organization_id));
CREATE POLICY "Admins update incentive settings" ON public.incentive_settings FOR UPDATE TO authenticated USING (public.is_org_admin(organization_id)) WITH CHECK (public.is_org_admin(organization_id));

CREATE TABLE public.incentive_programs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name text NOT NULL,
  period text NOT NULL CHECK (period IN ('daily','weekly','event')),
  amount numeric NOT NULL DEFAULT 0 CHECK (amount >= 0),
  min_score numeric NOT NULL DEFAULT 80 CHECK (min_score BETWEEN 0 AND 100),
  min_scan_compliance numeric NOT NULL DEFAULT 95 CHECK (min_scan_compliance BETWEEN 0 AND 100),
  min_jobs integer NOT NULL DEFAULT 1 CHECK (min_jobs >= 0),
  min_crates integer NOT NULL DEFAULT 0 CHECK (min_crates >= 0),
  min_shifts integer NOT NULL DEFAULT 1 CHECK (min_shifts >= 0),
  event_id uuid REFERENCES public.events(id) ON DELETE CASCADE,
  starts_on date,
  ends_on date,
  requires_approval boolean NOT NULL DEFAULT true,
  active boolean NOT NULL DEFAULT true,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.incentive_programs TO authenticated;
GRANT ALL ON public.incentive_programs TO service_role;
ALTER TABLE public.incentive_programs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Members read incentive programs" ON public.incentive_programs FOR SELECT TO authenticated USING (public.is_org_member(organization_id));
CREATE POLICY "Admins create incentive programs" ON public.incentive_programs FOR INSERT TO authenticated WITH CHECK (public.is_org_admin(organization_id));
CREATE POLICY "Admins update incentive programs" ON public.incentive_programs FOR UPDATE TO authenticated USING (public.is_org_admin(organization_id)) WITH CHECK (public.is_org_admin(organization_id));

CREATE TABLE public.operator_bonuses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  program_id uuid NOT NULL REFERENCES public.incentive_programs(id) ON DELETE CASCADE,
  operator_id uuid NOT NULL REFERENCES public.operators(id),
  event_id uuid REFERENCES public.events(id) ON DELETE SET NULL,
  period text NOT NULL,
  period_start date NOT NULL,
  period_end date NOT NULL,
  score numeric NOT NULL DEFAULT 0,
  metrics jsonb NOT NULL DEFAULT '{}'::jsonb,
  source_ticket_ids uuid[] NOT NULL DEFAULT '{}',
  amount numeric NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'ineligible' CHECK (status IN ('ineligible','pending_review','approved','rejected','paid')),
  ineligible_reasons text[] NOT NULL DEFAULT '{}',
  reviewed_by uuid,
  reviewed_at timestamptz,
  review_note text,
  paid_at timestamptz,
  paid_marked_by uuid,
  payment_reference text,
  calculated_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (program_id, operator_id, period_start)
);
GRANT SELECT ON public.operator_bonuses TO authenticated;
GRANT ALL ON public.operator_bonuses TO service_role;
ALTER TABLE public.operator_bonuses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins and own operator read bonuses" ON public.operator_bonuses FOR SELECT TO authenticated
  USING (public.is_org_admin(organization_id) OR operator_id IN (SELECT public.my_operator_ids()));

CREATE TABLE public.bonus_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  bonus_id uuid REFERENCES public.operator_bonuses(id) ON DELETE SET NULL,
  program_id uuid REFERENCES public.incentive_programs(id) ON DELETE SET NULL,
  operator_id uuid REFERENCES public.operators(id),
  action text NOT NULL,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  actor_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.bonus_audit_log TO authenticated;
GRANT ALL ON public.bonus_audit_log TO service_role;
ALTER TABLE public.bonus_audit_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins read bonus audit" ON public.bonus_audit_log FOR SELECT TO authenticated USING (public.is_org_admin(organization_id));
CREATE INDEX bonus_audit_bonus_idx ON public.bonus_audit_log(bonus_id, created_at);

CREATE OR REPLACE FUNCTION public.incentive_config_audit() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF tg_table_name = 'incentive_settings' THEN
    new.updated_by := auth.uid(); new.updated_at := now();
    INSERT INTO bonus_audit_log(organization_id, action, details, actor_id)
    VALUES (new.organization_id, 'weights_changed', jsonb_build_object('old', CASE WHEN tg_op='UPDATE' THEN to_jsonb(old) END, 'new', to_jsonb(new)), auth.uid());
  ELSE
    IF tg_op = 'INSERT' THEN new.created_by := auth.uid(); END IF;
    IF tg_op = 'UPDATE' THEN new.organization_id := old.organization_id; END IF;
    new.updated_at := now();
    IF new.period = 'event' AND new.event_id IS NULL THEN RAISE EXCEPTION 'Event bonuses need an event'; END IF;
    IF new.event_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM events WHERE id = new.event_id AND organization_id = new.organization_id) THEN
      RAISE EXCEPTION 'Event not found in this company'; END IF;
    INSERT INTO bonus_audit_log(organization_id, program_id, action, details, actor_id)
    VALUES (new.organization_id, CASE WHEN tg_op='UPDATE' THEN new.id END, CASE WHEN tg_op='INSERT' THEN 'program_created' ELSE 'program_changed' END,
      jsonb_build_object('program_id', new.id, 'old', CASE WHEN tg_op='UPDATE' THEN to_jsonb(old) END, 'new', to_jsonb(new)), auth.uid());
  END IF;
  RETURN new;
END $$;
CREATE TRIGGER incentive_settings_audit BEFORE INSERT OR UPDATE ON public.incentive_settings FOR EACH ROW EXECUTE FUNCTION public.incentive_config_audit();
CREATE TRIGGER incentive_programs_audit BEFORE INSERT OR UPDATE ON public.incentive_programs FOR EACH ROW EXECUTE FUNCTION public.incentive_config_audit();

CREATE OR REPLACE FUNCTION public.incentive_score(_prod numeric, _acc numeric, _ontime numeric, _doc numeric, _rel numeric,
  _wp integer, _wa integer, _wo integer, _wd integer, _wr integer) RETURNS numeric LANGUAGE sql IMMUTABLE SET search_path = public AS $$
  SELECT round(least(1,greatest(0,coalesce(_prod,0)))*_wp + least(1,greatest(0,coalesce(_acc,0)))*_wa
    + least(1,greatest(0,coalesce(_ontime,0)))*_wo + least(1,greatest(0,coalesce(_doc,0)))*_wd
    + least(1,greatest(0,coalesce(_rel,0)))*_wr, 1)
$$;

CREATE OR REPLACE FUNCTION public.operator_performance(_org uuid, _event uuid, _from timestamptz, _to timestamptz, _operator uuid DEFAULT NULL)
RETURNS TABLE(
  operator_id uuid, full_name text, jobs_completed integer, crates_delivered integer, weight_lbs numeric,
  active_hours numeric, avg_accept_min numeric, avg_pickup_min numeric, avg_transit_min numeric, avg_gap_min numeric,
  on_time_pct numeric, scan_compliance_pct numeric, delivery_accuracy_pct numeric, confirmation_pct numeric,
  exceptions_reported integer, shifts integer, org_work_days integer, open_assignments integer,
  productivity numeric, accuracy numeric, on_time numeric, documentation numeric, reliability numeric,
  score numeric, source_ticket_ids uuid[])
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE s incentive_settings; staff boolean; mine uuid[];
BEGIN
  staff := is_org_staff(_org);
  SELECT array_agg(x) INTO mine FROM public.my_operator_ids() x;
  IF NOT staff AND (mine IS NULL OR (_operator IS NOT NULL AND NOT _operator = ANY(mine))) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  SELECT * INTO s FROM incentive_settings WHERE organization_id = _org;
  IF NOT FOUND THEN s.organization_id := _org; s.w_productivity := 30; s.w_accuracy := 25; s.w_on_time := 20;
    s.w_documentation := 15; s.w_reliability := 10; s.target_units_per_hour := 4; s.on_time_minutes := 45; s.time_zone := 'America/New_York'; END IF;

  RETURN QUERY
  WITH ops AS (
    SELECT o.id, o.full_name, o.user_id FROM operators o
    WHERE o.organization_id = _org
      AND (_operator IS NULL OR o.id = _operator)
      AND (staff OR o.id = ANY(mine))
  ),
  tix AS (
    SELECT t.* FROM tickets t WHERE t.organization_id = _org AND (_event IS NULL OR t.event_id = _event)
  ),
  sess AS (
    SELECT w.*, greatest(0, extract(epoch FROM (coalesce(w.ended_at, least(now(), _to)) - w.started_at)) - w.paused_seconds) AS secs
    FROM work_sessions w JOIN tix t ON t.id = w.ticket_id
    WHERE w.cancelled_at IS NULL AND w.started_at < _to AND coalesce(w.ended_at, now()) >= _from
      AND w.operator_id IN (SELECT id FROM ops)
  ),
  crates AS (
    SELECT w.operator_id, tf.ticket_id, tf.freight_id, tf.picked_up_at, tf.delivered_at, tf.booth_verified, tf.flag,
      tf.picked_up_session_id, w.paused_seconds, coalesce(f.weight_lbs,0) wt,
      (SELECT max(a.assigned_at) FROM job_assignments a WHERE a.ticket_id = tf.ticket_id AND a.operator_id = w.operator_id AND a.assigned_at <= coalesce(tf.picked_up_at, tf.delivered_at)) AS assigned_at,
      (SELECT count(*) FROM ticket_freight x WHERE x.ticket_id = tf.ticket_id) AS ticket_crates
    FROM ticket_freight tf JOIN work_sessions w ON w.id = tf.delivered_session_id JOIN tix t ON t.id = tf.ticket_id
    JOIN freight_items f ON f.id = tf.freight_id
    WHERE tf.delivered_at >= _from AND tf.delivered_at < _to AND w.cancelled_at IS NULL AND w.operator_id IN (SELECT id FROM ops)
  ),
  jobs AS (
    SELECT DISTINCT x.operator_id, t.id ticket_id FROM tix t
    JOIN (SELECT ss.operator_id, ss.ticket_id FROM sess ss UNION SELECT c.operator_id, c.ticket_id FROM crates c) x ON x.ticket_id = t.id
    WHERE t.status = 'completed' AND t.completed_at >= _from AND t.completed_at < _to
  ),
  firsts AS (
    SELECT a.operator_id, a.ticket_id, a.assigned_at,
      (SELECT min(ss.started_at) FROM work_sessions ss WHERE ss.ticket_id = a.ticket_id AND ss.operator_id = a.operator_id AND ss.started_at >= a.assigned_at AND ss.cancelled_at IS NULL) started,
      (SELECT min(tf.picked_up_at) FROM ticket_freight tf JOIN work_sessions ss ON ss.id = tf.picked_up_session_id WHERE tf.ticket_id = a.ticket_id AND ss.operator_id = a.operator_id AND tf.picked_up_at >= a.assigned_at) picked
    FROM job_assignments a JOIN tix t ON t.id = a.ticket_id
    WHERE a.assigned_at >= _from AND a.assigned_at < _to AND a.operator_id IN (SELECT id FROM ops)
      AND coalesce(t.held_at, 'infinity') > a.assigned_at
  ),
  gaps AS (
    SELECT g.operator_id, extract(epoch FROM (g.next_start - g.ended_at))/60 AS m FROM (
      SELECT ss.operator_id, ss.ended_at, lead(ss.started_at) OVER (PARTITION BY ss.operator_id ORDER BY ss.started_at) next_start
      FROM sess ss WHERE ss.ended_at IS NOT NULL) g
    WHERE g.next_start > g.ended_at AND g.next_start - g.ended_at < interval '4 hours'
  ),
  docs AS (
    SELECT o.id operator_id,
      (SELECT count(*) FROM delivery_updates d JOIN tix t ON t.id = d.ticket_id WHERE o.user_id IS NOT NULL AND d.created_by = o.user_id AND d.kind IN ('exception','issue') AND d.created_at >= _from AND d.created_at < _to)
      + (SELECT count(*) FROM freight_issues fi WHERE o.user_id IS NOT NULL AND fi.created_by = o.user_id AND fi.organization_id = _org AND (_event IS NULL OR fi.event_id = _event) AND fi.created_at >= _from AND fi.created_at < _to)
      + (SELECT count(*) FROM crates c WHERE c.operator_id = o.id AND c.flag IS NOT NULL) AS n
    FROM ops o
  ),
  days AS (
    SELECT count(DISTINCT (w.started_at AT TIME ZONE s.time_zone)::date) n FROM work_sessions w JOIN tix t ON t.id = w.ticket_id
    WHERE w.cancelled_at IS NULL AND w.started_at >= _from AND w.started_at < _to
  ),
  base AS (
    SELECT o.id, o.full_name,
      (SELECT count(*) FROM jobs j WHERE j.operator_id = o.id)::int jobs_n,
      (SELECT count(*) FROM crates c WHERE c.operator_id = o.id)::int crates_n,
      (SELECT coalesce(sum(c.wt),0) FROM crates c WHERE c.operator_id = o.id) wt,
      (SELECT coalesce(sum(ss.secs),0)/3600.0 FROM sess ss WHERE ss.operator_id = o.id) hrs,
      (SELECT avg(extract(epoch FROM (fi.started - fi.assigned_at))/60) FROM firsts fi WHERE fi.operator_id = o.id AND fi.started IS NOT NULL) acc_m,
      (SELECT avg(extract(epoch FROM (fi.picked - fi.assigned_at))/60) FROM firsts fi WHERE fi.operator_id = o.id AND fi.picked IS NOT NULL) pick_m,
      (SELECT avg(extract(epoch FROM (c.delivered_at - c.picked_up_at))/60) FROM crates c WHERE c.operator_id = o.id AND c.picked_up_at IS NOT NULL) tr_m,
      (SELECT avg(g.m) FROM gaps g WHERE g.operator_id = o.id) gap_m,
      (SELECT count(*) FROM crates c WHERE c.operator_id = o.id AND c.flag IS NULL AND c.assigned_at IS NOT NULL) ot_den,
      (SELECT count(*) FROM crates c WHERE c.operator_id = o.id AND c.flag IS NULL AND c.assigned_at IS NOT NULL
         AND extract(epoch FROM (c.delivered_at - c.assigned_at)) - c.paused_seconds <= s.on_time_minutes * 60 * (1 + 0.25 * (c.ticket_crates - 1))) ot_num,
      (SELECT count(*) FROM crates c WHERE c.operator_id = o.id AND c.picked_up_session_id IS NOT NULL) scan_num,
      (SELECT count(*) FROM crates c WHERE c.operator_id = o.id AND c.flag IS NULL AND c.booth_verified IS NOT NULL) acc_den,
      (SELECT count(*) FROM crates c WHERE c.operator_id = o.id AND c.flag IS NULL AND c.booth_verified) acc_num,
      (SELECT count(*) FROM crates c WHERE c.operator_id = o.id AND (c.booth_verified IS NOT NULL OR c.flag IS NOT NULL)) conf_num,
      (SELECT d.n FROM docs d WHERE d.operator_id = o.id)::int exc,
      (SELECT count(DISTINCT (ss.started_at AT TIME ZONE s.time_zone)::date) FROM sess ss WHERE ss.operator_id = o.id)::int shifts_n,
      (SELECT count(*) FROM tix t WHERE t.assigned_operator_id = o.id AND t.status IN ('assigned','in_progress'))::int open_n,
      (SELECT coalesce(array_agg(DISTINCT j.ticket_id), '{}') FROM jobs j WHERE j.operator_id = o.id) src
    FROM ops o
  ),
  comp AS (
    SELECT b.*, (SELECT n FROM days)::int wd,
      CASE WHEN b.crates_n + b.jobs_n = 0 THEN 0 ELSE least(1, (b.crates_n + 0.5 * b.jobs_n + b.wt / 2000.0) / greatest(b.hrs, 0.25) / s.target_units_per_hour) END p,
      CASE WHEN b.crates_n = 0 THEN NULL ELSE b.scan_num::numeric / b.crates_n END scan_r,
      CASE WHEN b.acc_den = 0 THEN CASE WHEN b.crates_n = 0 THEN NULL ELSE 1 END ELSE b.acc_num::numeric / b.acc_den END acc_r,
      CASE WHEN b.ot_den = 0 THEN CASE WHEN b.crates_n = 0 THEN NULL ELSE 1 END ELSE b.ot_num::numeric / b.ot_den END ot_r,
      CASE WHEN b.crates_n = 0 THEN NULL ELSE b.conf_num::numeric / b.crates_n END conf_r
    FROM base b
  )
  SELECT c.id, c.full_name, c.jobs_n, c.crates_n, round(c.wt,0), round(c.hrs,2),
    round(c.acc_m,1), round(c.pick_m,1), round(c.tr_m,1), round(c.gap_m,1),
    round(c.ot_r*100,1), round(c.scan_r*100,1), round(c.acc_r*100,1), round(c.conf_r*100,1),
    c.exc, c.shifts_n, c.wd, c.open_n,
    round(c.p,3), round(coalesce((c.scan_r + c.acc_r)/2, 0),3), round(coalesce(c.ot_r,0),3), round(coalesce(c.conf_r,0),3),
    round(CASE WHEN c.wd = 0 THEN 0 ELSE least(1, c.shifts_n::numeric / c.wd) END,3),
    incentive_score(c.p, (c.scan_r + c.acc_r)/2, c.ot_r, c.conf_r, CASE WHEN c.wd = 0 THEN 0 ELSE least(1, c.shifts_n::numeric / c.wd) END,
      s.w_productivity, s.w_accuracy, s.w_on_time, s.w_documentation, s.w_reliability),
    c.src
  FROM comp c ORDER BY c.full_name;
END $$;
REVOKE ALL ON FUNCTION public.operator_performance(uuid, uuid, timestamptz, timestamptz, uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.operator_performance(uuid, uuid, timestamptz, timestamptz, uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.ensure_incentive_defaults(_org uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT is_org_admin(_org) THEN RAISE EXCEPTION 'Only company admins can set up incentives'; END IF;
  INSERT INTO incentive_settings(organization_id) VALUES (_org) ON CONFLICT DO NOTHING;
  IF NOT EXISTS (SELECT 1 FROM incentive_programs WHERE organization_id = _org) THEN
    INSERT INTO incentive_programs(organization_id, name, period, amount, min_score, min_scan_compliance, min_jobs, min_crates, min_shifts)
    VALUES (_org, 'Daily productivity bonus', 'daily', 20, 80, 95, 3, 5, 1),
           (_org, 'Weekly performance bonus', 'weekly', 75, 85, 95, 10, 20, 3);
  END IF;
END $$;
REVOKE ALL ON FUNCTION public.ensure_incentive_defaults(uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.ensure_incentive_defaults(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.calculate_bonuses(_program uuid, _period_start date) RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE p incentive_programs; s incentive_settings; tz text; d0 date; d1 date; r record; reasons text[]; st text; old operator_bonuses; n int := 0; bid uuid; m jsonb;
BEGIN
  SELECT * INTO p FROM incentive_programs WHERE id = _program;
  IF NOT FOUND OR NOT is_org_admin(p.organization_id) THEN RAISE EXCEPTION 'Only company admins can calculate bonuses'; END IF;
  PERFORM pg_advisory_xact_lock(hashtext('bonus:' || _program::text));
  SELECT * INTO s FROM incentive_settings WHERE organization_id = p.organization_id;
  tz := coalesce(s.time_zone, 'America/New_York');
  IF p.period = 'daily' THEN d0 := _period_start; d1 := _period_start;
  ELSIF p.period = 'weekly' THEN d0 := _period_start; d1 := _period_start + 6;
  ELSE SELECT e.start_date, e.end_date INTO d0, d1 FROM events e WHERE e.id = p.event_id; END IF;

  FOR r IN SELECT * FROM operator_performance(p.organization_id, p.event_id, (d0::timestamp AT TIME ZONE tz), ((d1 + 1)::timestamp AT TIME ZONE tz)) LOOP
    IF r.jobs_completed = 0 AND r.crates_delivered = 0 AND r.shifts = 0 THEN CONTINUE; END IF;
    reasons := '{}';
    IF NOT p.active THEN reasons := reasons || 'Program inactive'::text; END IF;
    IF (p.starts_on IS NOT NULL AND d1 < p.starts_on) OR (p.ends_on IS NOT NULL AND d0 > p.ends_on) THEN reasons := reasons || 'Outside eligible dates'::text; END IF;
    IF r.score < p.min_score THEN reasons := reasons || format('Score %s below %s', r.score, p.min_score); END IF;
    IF coalesce(r.scan_compliance_pct, 0) < p.min_scan_compliance THEN reasons := reasons || format('Scan compliance %s%% below %s%%', coalesce(r.scan_compliance_pct, 0), p.min_scan_compliance); END IF;
    IF r.jobs_completed < p.min_jobs THEN reasons := reasons || format('%s of %s jobs', r.jobs_completed, p.min_jobs); END IF;
    IF r.crates_delivered < p.min_crates THEN reasons := reasons || format('%s of %s crates', r.crates_delivered, p.min_crates); END IF;
    IF r.shifts < p.min_shifts THEN reasons := reasons || format('%s of %s shifts', r.shifts, p.min_shifts); END IF;
    st := CASE WHEN cardinality(reasons) > 0 THEN 'ineligible' WHEN p.requires_approval THEN 'pending_review' ELSE 'approved' END;
    m := to_jsonb(r) - 'source_ticket_ids' - 'full_name' - 'operator_id';

    SELECT * INTO old FROM operator_bonuses WHERE program_id = p.id AND operator_id = r.operator_id AND period_start = d0;
    IF FOUND THEN
      IF old.status = 'paid' OR (old.status IN ('approved','rejected') AND old.reviewed_by IS NOT NULL) THEN CONTINUE; END IF;
      IF old.score = r.score AND old.metrics = m AND old.status = st AND old.amount = p.amount THEN CONTINUE; END IF;
      UPDATE operator_bonuses SET score = r.score, metrics = m, source_ticket_ids = r.source_ticket_ids, amount = p.amount,
        status = st, ineligible_reasons = reasons, calculated_at = now() WHERE id = old.id;
      INSERT INTO bonus_audit_log(organization_id, bonus_id, program_id, operator_id, action, details, actor_id)
      VALUES (p.organization_id, old.id, p.id, r.operator_id, 'recalculated',
        jsonb_build_object('old_score', old.score, 'new_score', r.score, 'old_status', old.status, 'new_status', st, 'amount', p.amount, 'reasons', reasons, 'source_ticket_ids', r.source_ticket_ids), auth.uid());
    ELSE
      INSERT INTO operator_bonuses(organization_id, program_id, operator_id, event_id, period, period_start, period_end, score, metrics, source_ticket_ids, amount, status, ineligible_reasons)
      VALUES (p.organization_id, p.id, r.operator_id, p.event_id, p.period, d0, d1, r.score, m, r.source_ticket_ids, p.amount, st, reasons) RETURNING id INTO bid;
      INSERT INTO bonus_audit_log(organization_id, bonus_id, program_id, operator_id, action, details, actor_id)
      VALUES (p.organization_id, bid, p.id, r.operator_id, 'calculated',
        jsonb_build_object('score', r.score, 'status', st, 'amount', p.amount, 'reasons', reasons, 'metrics', m, 'source_ticket_ids', r.source_ticket_ids), auth.uid());
    END IF;
    n := n + 1;
  END LOOP;
  RETURN n;
END $$;
REVOKE ALL ON FUNCTION public.calculate_bonuses(uuid, date) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.calculate_bonuses(uuid, date) TO authenticated;

CREATE OR REPLACE FUNCTION public.review_bonus(_bonus uuid, _approve boolean, _note text DEFAULT NULL) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE b operator_bonuses; st text;
BEGIN
  SELECT * INTO b FROM operator_bonuses WHERE id = _bonus FOR UPDATE;
  IF NOT FOUND OR NOT is_org_admin(b.organization_id) THEN RAISE EXCEPTION 'Only company admins can review bonuses'; END IF;
  IF b.status NOT IN ('pending_review','approved','rejected') THEN RAISE EXCEPTION 'This bonus cannot be reviewed (status %)', b.status; END IF;
  IF NOT _approve AND coalesce(trim(_note), '') = '' THEN RAISE EXCEPTION 'Give a reason for rejecting'; END IF;
  st := CASE WHEN _approve THEN 'approved' ELSE 'rejected' END;
  UPDATE operator_bonuses SET status = st, reviewed_by = auth.uid(), reviewed_at = now(), review_note = nullif(trim(_note), '') WHERE id = b.id;
  INSERT INTO bonus_audit_log(organization_id, bonus_id, program_id, operator_id, action, details, actor_id)
  VALUES (b.organization_id, b.id, b.program_id, b.operator_id, st, jsonb_build_object('from', b.status, 'note', _note, 'amount', b.amount), auth.uid());
END $$;
REVOKE ALL ON FUNCTION public.review_bonus(uuid, boolean, text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.review_bonus(uuid, boolean, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.mark_bonus_paid(_bonus uuid, _paid boolean, _reference text DEFAULT NULL) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE b operator_bonuses;
BEGIN
  SELECT * INTO b FROM operator_bonuses WHERE id = _bonus FOR UPDATE;
  IF NOT FOUND OR NOT is_org_admin(b.organization_id) THEN RAISE EXCEPTION 'Only company admins can record payment'; END IF;
  IF _paid AND b.status <> 'approved' THEN RAISE EXCEPTION 'Only approved bonuses can be marked paid'; END IF;
  IF NOT _paid AND b.status <> 'paid' THEN RAISE EXCEPTION 'Bonus is not marked paid'; END IF;
  UPDATE operator_bonuses SET status = CASE WHEN _paid THEN 'paid' ELSE 'approved' END,
    paid_at = CASE WHEN _paid THEN now() END, paid_marked_by = CASE WHEN _paid THEN auth.uid() END,
    payment_reference = CASE WHEN _paid THEN nullif(trim(_reference), '') END WHERE id = b.id;
  INSERT INTO bonus_audit_log(organization_id, bonus_id, program_id, operator_id, action, details, actor_id)
  VALUES (b.organization_id, b.id, b.program_id, b.operator_id, CASE WHEN _paid THEN 'marked_paid' ELSE 'payment_undone' END,
    jsonb_build_object('reference', _reference, 'amount', b.amount), auth.uid());
END $$;
REVOKE ALL ON FUNCTION public.mark_bonus_paid(uuid, boolean, text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.mark_bonus_paid(uuid, boolean, text) TO authenticated;