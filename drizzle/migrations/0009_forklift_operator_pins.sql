CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

CREATE TABLE public.event_operators (
  event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  operator_id uuid NOT NULL REFERENCES public.operators(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  added_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (event_id, operator_id)
);
GRANT SELECT, INSERT, DELETE ON public.event_operators TO authenticated;
GRANT ALL ON public.event_operators TO service_role;
ALTER TABLE public.event_operators ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.event_operators_before_insert() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  SELECT organization_id INTO NEW.organization_id FROM public.events WHERE id = NEW.event_id;
  IF NOT EXISTS (SELECT 1 FROM public.operators WHERE id = NEW.operator_id AND organization_id = NEW.organization_id) THEN
    RAISE EXCEPTION 'Operator belongs to another company';
  END IF;
  NEW.added_by := auth.uid();
  RETURN NEW;
END $$;
CREATE TRIGGER event_operators_before_insert BEFORE INSERT ON public.event_operators FOR EACH ROW EXECUTE FUNCTION public.event_operators_before_insert();

CREATE POLICY "event operators view" ON public.event_operators FOR SELECT TO authenticated USING (public.is_org_member(organization_id));
CREATE POLICY "event operators staff add" ON public.event_operators FOR INSERT TO authenticated WITH CHECK (public.is_org_staff(organization_id));
CREATE POLICY "event operators staff remove" ON public.event_operators FOR DELETE TO authenticated USING (public.is_org_staff(organization_id));

-- PINs: no client grants; reachable only through RPCs
CREATE TABLE public.operator_pins (
  operator_id uuid PRIMARY KEY REFERENCES public.operators(id) ON DELETE CASCADE,
  pin_hash text NOT NULL,
  failed_attempts integer NOT NULL DEFAULT 0,
  locked_until timestamptz,
  set_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.operator_pins TO service_role;
ALTER TABLE public.operator_pins ENABLE ROW LEVEL SECURITY;

-- One unlocked operator per signed-in account (shared tablet)
CREATE TABLE public.operator_unlocks (
  user_id uuid PRIMARY KEY,
  operator_id uuid NOT NULL REFERENCES public.operators(id) ON DELETE CASCADE,
  event_id uuid REFERENCES public.events(id) ON DELETE SET NULL,
  unlocked_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL
);
GRANT ALL ON public.operator_unlocks TO service_role;
ALTER TABLE public.operator_unlocks ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.user_operator_ids() RETURNS SETOF uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  select operator_id from public.user_roles
  where user_id = auth.uid() and role = 'operator' and operator_id is not null
  union
  select operator_id from public.operator_unlocks where user_id = auth.uid() and expires_at > now()
$$;

CREATE OR REPLACE FUNCTION public.forklift_operators(_event uuid)
RETURNS TABLE(id uuid, full_name text, has_pin boolean) LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
DECLARE org uuid;
BEGIN
  SELECT organization_id INTO org FROM public.events WHERE events.id = _event;
  IF org IS NULL OR NOT public.is_org_member(org) THEN RAISE EXCEPTION 'Event not found'; END IF;
  RETURN QUERY SELECT o.id, o.full_name, EXISTS (SELECT 1 FROM public.operator_pins p WHERE p.operator_id = o.id)
    FROM public.event_operators eo JOIN public.operators o ON o.id = eo.operator_id
    WHERE eo.event_id = _event ORDER BY o.full_name;
END $$;

CREATE OR REPLACE FUNCTION public.forklift_unlock(_event uuid, _operator uuid, _pin text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public, extensions AS $$
DECLARE org uuid; p public.operator_pins; created boolean := false;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Sign in required'; END IF;
  IF _pin IS NULL OR _pin !~ '^[0-9]{6}$' THEN RETURN jsonb_build_object('ok', false, 'error', 'PIN must be 6 digits'); END IF;
  SELECT e.organization_id INTO org FROM public.events e WHERE e.id = _event;
  IF org IS NULL OR NOT public.is_org_member(org) THEN RAISE EXCEPTION 'Event not found'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.event_operators WHERE event_id = _event AND operator_id = _operator) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Operator is not registered for this event');
  END IF;
  SELECT * INTO p FROM public.operator_pins WHERE operator_id = _operator FOR UPDATE;
  IF p.operator_id IS NULL THEN
    INSERT INTO public.operator_pins(operator_id, pin_hash) VALUES (_operator, crypt(_pin, gen_salt('bf')));
    created := true;
  ELSE
    IF p.locked_until IS NOT NULL AND p.locked_until > now() THEN
      RETURN jsonb_build_object('ok', false, 'error', 'Too many wrong tries. Wait 5 minutes or ask dispatch to reset the PIN.');
    END IF;
    IF p.pin_hash <> crypt(_pin, p.pin_hash) THEN
      UPDATE public.operator_pins SET failed_attempts = failed_attempts + 1,
        locked_until = CASE WHEN failed_attempts + 1 >= 5 THEN now() + interval '5 minutes' ELSE NULL END
        WHERE operator_id = _operator;
      RETURN jsonb_build_object('ok', false, 'error', 'Wrong PIN');
    END IF;
    UPDATE public.operator_pins SET failed_attempts = 0, locked_until = NULL WHERE operator_id = _operator;
  END IF;
  INSERT INTO public.operator_unlocks(user_id, operator_id, event_id, expires_at)
    VALUES (auth.uid(), _operator, _event, now() + interval '12 hours')
    ON CONFLICT (user_id) DO UPDATE SET operator_id = EXCLUDED.operator_id, event_id = EXCLUDED.event_id,
      unlocked_at = now(), expires_at = EXCLUDED.expires_at;
  UPDATE public.operators SET status = 'available' WHERE id = _operator AND status = 'off_shift';
  RETURN jsonb_build_object('ok', true, 'created', created);
END $$;

CREATE OR REPLACE FUNCTION public.forklift_lock() RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path=public AS $$
  delete from public.operator_unlocks where user_id = auth.uid()
$$;

CREATE OR REPLACE FUNCTION public.forklift_current() RETURNS TABLE(operator_id uuid, full_name text, event_id uuid)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  select u.operator_id, o.full_name, u.event_id from public.operator_unlocks u join public.operators o on o.id = u.operator_id
  where u.user_id = auth.uid() and u.expires_at > now()
$$;

CREATE OR REPLACE FUNCTION public.reset_operator_pin(_operator uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE org uuid;
BEGIN
  SELECT organization_id INTO org FROM public.operators WHERE id = _operator;
  IF org IS NULL OR NOT public.is_org_staff(org) THEN RAISE EXCEPTION 'Not allowed'; END IF;
  DELETE FROM public.operator_pins WHERE operator_id = _operator;
  DELETE FROM public.operator_unlocks WHERE operator_id = _operator;
END $$;

CREATE OR REPLACE FUNCTION public.operator_pin_status() RETURNS TABLE(operator_id uuid, has_pin boolean)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  select o.id, exists(select 1 from public.operator_pins p where p.operator_id = o.id)
  from public.operators o where public.is_org_staff(o.organization_id)
$$;

REVOKE ALL ON FUNCTION public.forklift_operators(uuid), public.forklift_unlock(uuid,uuid,text), public.forklift_lock(),
  public.forklift_current(), public.reset_operator_pin(uuid), public.operator_pin_status() FROM public, anon;
GRANT EXECUTE ON FUNCTION public.forklift_operators(uuid), public.forklift_unlock(uuid,uuid,text), public.forklift_lock(),
  public.forklift_current(), public.reset_operator_pin(uuid), public.operator_pin_status() TO authenticated;

-- Register operators already working on each event's tickets so the dropdown isn't empty
INSERT INTO public.event_operators(event_id, operator_id, organization_id)
SELECT DISTINCT t.event_id, t.assigned_operator_id, t.organization_id FROM public.tickets t WHERE t.assigned_operator_id IS NOT NULL
ON CONFLICT DO NOTHING;