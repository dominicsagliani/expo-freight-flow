-- 1) New sign-ups no longer join the demo company automatically.
CREATE OR REPLACE FUNCTION public.handle_new_user() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (new.id, new.email, coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)))
  ON CONFLICT (id) DO NOTHING;
  -- Company membership comes from an accepted invitation or from creating a new company workspace.
  RETURN new;
END $$;

-- 2) Invitations
CREATE TABLE public.invitations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  email text NOT NULL,
  role public.app_role NOT NULL,
  exhibitor_id uuid REFERENCES public.exhibitors(id) ON DELETE CASCADE,
  operator_id uuid REFERENCES public.operators(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending',
  invited_by uuid,
  accepted_by uuid,
  accepted_at timestamptz,
  expires_at timestamptz NOT NULL DEFAULT now() + interval '30 days',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ON public.invitations (organization_id);
CREATE INDEX ON public.invitations (lower(email));
GRANT SELECT, INSERT, UPDATE, DELETE ON public.invitations TO authenticated;
GRANT ALL ON public.invitations TO service_role;
ALTER TABLE public.invitations ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.invitations_before_write() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  new.email := lower(trim(new.email));
  IF new.role = 'super_admin' THEN RAISE EXCEPTION 'Platform owner access cannot be granted by invitation'; END IF;
  IF new.role = 'exhibitor' AND new.exhibitor_id IS NULL THEN RAISE EXCEPTION 'Choose which exhibitor this person represents'; END IF;
  IF new.role = 'operator' AND new.operator_id IS NULL THEN RAISE EXCEPTION 'Choose which operator this person is'; END IF;
  IF new.role NOT IN ('exhibitor') THEN new.exhibitor_id := NULL; END IF;
  IF new.role NOT IN ('operator') THEN new.operator_id := NULL; END IF;
  IF new.exhibitor_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.exhibitors WHERE id = new.exhibitor_id AND organization_id = new.organization_id) THEN
    RAISE EXCEPTION 'Exhibitor belongs to another company'; END IF;
  IF new.operator_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.operators WHERE id = new.operator_id AND organization_id = new.organization_id) THEN
    RAISE EXCEPTION 'Operator belongs to another company'; END IF;
  IF tg_op = 'INSERT' THEN new.invited_by := auth.uid(); new.status := 'pending'; END IF;
  RETURN new;
END $$;
CREATE TRIGGER invitations_before_write BEFORE INSERT OR UPDATE ON public.invitations
  FOR EACH ROW EXECUTE FUNCTION public.invitations_before_write();

CREATE POLICY "Admins view invitations" ON public.invitations FOR SELECT TO authenticated
  USING (public.is_org_admin(organization_id));
CREATE POLICY "Admins create invitations" ON public.invitations FOR INSERT TO authenticated
  WITH CHECK (public.is_org_admin(organization_id));
CREATE POLICY "Admins update invitations" ON public.invitations FOR UPDATE TO authenticated
  USING (public.is_org_admin(organization_id)) WITH CHECK (public.is_org_admin(organization_id));
CREATE POLICY "Admins delete invitations" ON public.invitations FOR DELETE TO authenticated
  USING (public.is_org_admin(organization_id));

-- Accept pending invitations addressed to the caller's confirmed email.
CREATE OR REPLACE FUNCTION public.accept_my_invitations() RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _email text; _confirmed timestamptz; _n integer := 0; r record;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not signed in'; END IF;
  SELECT lower(email), email_confirmed_at INTO _email, _confirmed FROM auth.users WHERE id = auth.uid();
  IF _email IS NULL OR _confirmed IS NULL THEN RETURN 0; END IF;
  FOR r IN SELECT * FROM public.invitations
           WHERE email = _email AND status = 'pending' AND expires_at > now() LOOP
    IF NOT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND organization_id = r.organization_id AND role = r.role
                   AND exhibitor_id IS NOT DISTINCT FROM r.exhibitor_id AND operator_id IS NOT DISTINCT FROM r.operator_id) THEN
      INSERT INTO public.user_roles (user_id, organization_id, role, exhibitor_id, operator_id)
      VALUES (auth.uid(), r.organization_id, r.role, r.exhibitor_id, r.operator_id);
    END IF;
    IF r.operator_id IS NOT NULL THEN
      UPDATE public.operators SET user_id = auth.uid() WHERE id = r.operator_id AND user_id IS NULL;
    END IF;
    UPDATE public.invitations SET status = 'accepted', accepted_by = auth.uid(), accepted_at = now() WHERE id = r.id;
    _n := _n + 1;
  END LOOP;
  RETURN _n;
END $$;
REVOKE ALL ON FUNCTION public.accept_my_invitations() FROM public, anon;
GRANT EXECUTE ON FUNCTION public.accept_my_invitations() TO authenticated;

-- Create a fresh, isolated company workspace for a signed-in user with no company yet.
CREATE OR REPLACE FUNCTION public.create_my_organization(_name text) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _org uuid;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not signed in'; END IF;
  IF coalesce(length(trim(_name)), 0) < 2 THEN RAISE EXCEPTION 'Enter your company name'; END IF;
  IF EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND organization_id IS NOT NULL) THEN
    RAISE EXCEPTION 'You already belong to a company workspace';
  END IF;
  INSERT INTO public.organizations (name) VALUES (trim(_name)) RETURNING id INTO _org;
  INSERT INTO public.user_roles (user_id, organization_id, role) VALUES (auth.uid(), _org, 'company_admin');
  RETURN _org;
END $$;
REVOKE ALL ON FUNCTION public.create_my_organization(text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.create_my_organization(text) TO authenticated;

-- 3) Job assignment history (written only by the database)
CREATE TABLE public.job_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  ticket_id uuid NOT NULL REFERENCES public.tickets(id) ON DELETE CASCADE,
  operator_id uuid REFERENCES public.operators(id) ON DELETE SET NULL,
  equipment_id uuid REFERENCES public.equipment(id) ON DELETE SET NULL,
  assigned_at timestamptz NOT NULL DEFAULT now(),
  assigned_by uuid,
  released_at timestamptz,
  release_reason text
);
CREATE INDEX ON public.job_assignments (ticket_id);
CREATE INDEX ON public.job_assignments (operator_id);
GRANT SELECT ON public.job_assignments TO authenticated;
GRANT ALL ON public.job_assignments TO service_role;
ALTER TABLE public.job_assignments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "View assignments for visible tickets" ON public.job_assignments FOR SELECT TO authenticated
  USING (public.can_view_ticket(ticket_id));

CREATE OR REPLACE FUNCTION public.tickets_assignment_history() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF tg_op = 'UPDATE' AND new.assigned_operator_id IS NOT DISTINCT FROM old.assigned_operator_id
     AND new.assigned_equipment_id IS NOT DISTINCT FROM old.assigned_equipment_id THEN
    IF new.status IN ('completed','cancelled') AND old.status IS DISTINCT FROM new.status THEN
      UPDATE public.job_assignments SET released_at = now(), release_reason = new.status::text
      WHERE ticket_id = new.id AND released_at IS NULL;
    END IF;
    RETURN new;
  END IF;
  UPDATE public.job_assignments SET released_at = now(), release_reason = 'reassigned'
  WHERE ticket_id = new.id AND released_at IS NULL;
  IF new.assigned_operator_id IS NOT NULL OR new.assigned_equipment_id IS NOT NULL THEN
    INSERT INTO public.job_assignments (organization_id, ticket_id, operator_id, equipment_id, assigned_at, assigned_by)
    VALUES (new.organization_id, new.id, new.assigned_operator_id, new.assigned_equipment_id, coalesce(new.assigned_at, now()), auth.uid());
  END IF;
  RETURN new;
END $$;
CREATE TRIGGER trg_tickets_assignment_history AFTER INSERT OR UPDATE ON public.tickets
  FOR EACH ROW EXECUTE FUNCTION public.tickets_assignment_history();

INSERT INTO public.job_assignments (organization_id, ticket_id, operator_id, equipment_id, assigned_at, released_at, release_reason)
SELECT organization_id, id, assigned_operator_id, assigned_equipment_id, coalesce(assigned_at, created_at),
  CASE WHEN status IN ('completed','cancelled') THEN coalesce(completed_at, updated_at) END,
  CASE WHEN status IN ('completed','cancelled') THEN status::text END
FROM public.tickets WHERE assigned_operator_id IS NOT NULL OR assigned_equipment_id IS NOT NULL;

-- 4) Delivery status updates with notes
CREATE TYPE public.delivery_update_kind AS ENUM ('picked_up','in_transit','at_booth','delivered','exception','note');
CREATE TABLE public.delivery_updates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  ticket_id uuid NOT NULL REFERENCES public.tickets(id) ON DELETE CASCADE,
  freight_id uuid REFERENCES public.freight_items(id) ON DELETE CASCADE,
  kind public.delivery_update_kind NOT NULL DEFAULT 'note',
  note text,
  location text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ON public.delivery_updates (ticket_id);
CREATE INDEX ON public.delivery_updates (freight_id);
GRANT SELECT, INSERT ON public.delivery_updates TO authenticated;
GRANT ALL ON public.delivery_updates TO service_role;
ALTER TABLE public.delivery_updates ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.delivery_updates_before_insert() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  SELECT organization_id INTO new.organization_id FROM public.tickets WHERE id = new.ticket_id;
  IF new.organization_id IS NULL THEN RAISE EXCEPTION 'Ticket not found'; END IF;
  IF new.freight_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.ticket_freight WHERE ticket_id = new.ticket_id AND freight_id = new.freight_id) THEN
    RAISE EXCEPTION 'That freight item is not on this ticket';
  END IF;
  IF new.kind = 'note' AND coalesce(trim(new.note), '') = '' THEN RAISE EXCEPTION 'Write a note'; END IF;
  new.created_by := auth.uid();
  new.created_at := now();
  RETURN new;
END $$;
CREATE TRIGGER delivery_updates_before_insert BEFORE INSERT ON public.delivery_updates
  FOR EACH ROW EXECUTE FUNCTION public.delivery_updates_before_insert();

CREATE OR REPLACE FUNCTION public.delivery_updates_after_insert() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public.log_activity(new.organization_id, 'delivery_update', new.ticket_id, new.freight_id,
    (SELECT event_id FROM public.tickets WHERE id = new.ticket_id),
    jsonb_build_object('kind', new.kind, 'note', new.note, 'location', new.location));
  RETURN new;
END $$;
CREATE TRIGGER delivery_updates_after_insert AFTER INSERT ON public.delivery_updates
  FOR EACH ROW EXECUTE FUNCTION public.delivery_updates_after_insert();

CREATE POLICY "View updates for visible tickets" ON public.delivery_updates FOR SELECT TO authenticated
  USING (public.can_view_ticket(ticket_id));
CREATE POLICY "Workers post updates" ON public.delivery_updates FOR INSERT TO authenticated
  WITH CHECK (public.can_work_ticket(ticket_id));

-- 5) Photos can point at a single freight item or a delivery update
ALTER TABLE public.ticket_photos ADD COLUMN freight_id uuid REFERENCES public.freight_items(id) ON DELETE SET NULL;
ALTER TABLE public.ticket_photos ADD COLUMN delivery_update_id uuid REFERENCES public.delivery_updates(id) ON DELETE SET NULL;

CREATE OR REPLACE FUNCTION public.ticket_photos_check_links() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF new.freight_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.ticket_freight WHERE ticket_id = new.ticket_id AND freight_id = new.freight_id) THEN
    RAISE EXCEPTION 'That freight item is not on this ticket';
  END IF;
  IF new.delivery_update_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.delivery_updates WHERE id = new.delivery_update_id AND ticket_id = new.ticket_id) THEN
    RAISE EXCEPTION 'That update is not on this ticket';
  END IF;
  RETURN new;
END $$;
CREATE TRIGGER ticket_photos_check_links BEFORE INSERT ON public.ticket_photos
  FOR EACH ROW EXECUTE FUNCTION public.ticket_photos_check_links();