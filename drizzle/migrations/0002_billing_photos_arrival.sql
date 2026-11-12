ALTER TABLE public.tickets ADD COLUMN charge_amount numeric(12,2);
ALTER TABLE public.freight_items ADD COLUMN arrived_at timestamptz;

CREATE OR REPLACE FUNCTION public.compute_ticket_charge(_ticket uuid)
RETURNS numeric LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE t public.tickets; r public.service_rates; w numeric; p integer; hrs numeric; amt numeric;
BEGIN
  SELECT * INTO t FROM public.tickets WHERE id = _ticket;
  IF t.id IS NULL THEN RETURN NULL; END IF;
  SELECT sr.* INTO r FROM public.service_rates sr JOIN public.rate_cards rc ON rc.id = sr.rate_card_id
   WHERE rc.organization_id = t.organization_id AND sr.service_type = t.service_type
     AND (rc.event_id = t.event_id OR (rc.event_id IS NULL AND rc.is_default))
   ORDER BY (rc.event_id IS NOT NULL) DESC, rc.created_at DESC LIMIT 1;
  IF r.id IS NULL THEN RETURN NULL; END IF;
  SELECT coalesce(sum(f.weight_lbs),0), coalesce(sum(f.pieces),0) INTO w, p
    FROM public.ticket_freight tf JOIN public.freight_items f ON f.id = tf.freight_id WHERE tf.ticket_id = _ticket;
  IF r.unit = 'per_cwt' THEN amt := ceil(w / 100.0) * r.rate;
  ELSIF r.unit = 'per_piece' THEN amt := p * r.rate;
  ELSIF r.unit = 'per_hour' THEN
    hrs := CASE WHEN t.started_at IS NULL OR t.completed_at IS NULL THEN 1
           ELSE greatest(0.5, ceil(extract(epoch FROM (t.completed_at - t.started_at)) / 1800.0) / 2.0) END;
    amt := hrs * r.rate;
  ELSE amt := r.rate; END IF;
  RETURN round(greatest(amt, r.minimum_charge), 2);
END $$;
REVOKE ALL ON FUNCTION public.compute_ticket_charge(uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.compute_ticket_charge(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.tickets_charge_before_update()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF new.status = 'completed' AND old.status IS DISTINCT FROM 'completed' THEN
    new.charge_amount := NULL;
    PERFORM 1;
    -- compute using the new timestamps
    DECLARE r public.service_rates; w numeric; p integer; hrs numeric; amt numeric;
    BEGIN
      SELECT sr.* INTO r FROM public.service_rates sr JOIN public.rate_cards rc ON rc.id = sr.rate_card_id
       WHERE rc.organization_id = new.organization_id AND sr.service_type = new.service_type
         AND (rc.event_id = new.event_id OR (rc.event_id IS NULL AND rc.is_default))
       ORDER BY (rc.event_id IS NOT NULL) DESC, rc.created_at DESC LIMIT 1;
      IF r.id IS NOT NULL THEN
        SELECT coalesce(sum(f.weight_lbs),0), coalesce(sum(f.pieces),0) INTO w, p
          FROM public.ticket_freight tf JOIN public.freight_items f ON f.id = tf.freight_id WHERE tf.ticket_id = new.id;
        IF r.unit = 'per_cwt' THEN amt := ceil(w / 100.0) * r.rate;
        ELSIF r.unit = 'per_piece' THEN amt := p * r.rate;
        ELSIF r.unit = 'per_hour' THEN
          hrs := CASE WHEN new.started_at IS NULL OR new.completed_at IS NULL THEN 1
                 ELSE greatest(0.5, ceil(extract(epoch FROM (new.completed_at - new.started_at)) / 1800.0) / 2.0) END;
          amt := hrs * r.rate;
        ELSE amt := r.rate; END IF;
        new.charge_amount := round(greatest(amt, r.minimum_charge), 2);
      END IF;
    END;
  ELSIF new.status <> 'completed' THEN
    new.charge_amount := NULL;
  ELSE
    new.charge_amount := old.charge_amount;
  END IF;
  RETURN new;
END $$;
CREATE TRIGGER zz_tickets_charge BEFORE UPDATE ON public.tickets
  FOR EACH ROW EXECUTE FUNCTION public.tickets_charge_before_update();

UPDATE public.tickets SET charge_amount = public.compute_ticket_charge(id) WHERE status = 'completed';

CREATE OR REPLACE FUNCTION public.freight_arrival_stamp()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF new.arrival_status <> 'expected' AND new.arrived_at IS NULL
     AND (TG_OP = 'INSERT' OR old.arrival_status = 'expected') THEN
    new.arrived_at := now();
  ELSIF new.arrival_status = 'expected' THEN
    new.arrived_at := NULL;
  END IF;
  RETURN new;
END $$;
CREATE TRIGGER zz_freight_arrival BEFORE INSERT OR UPDATE ON public.freight_items
  FOR EACH ROW EXECUTE FUNCTION public.freight_arrival_stamp();
UPDATE public.freight_items SET arrived_at = created_at WHERE arrival_status <> 'expected' AND arrived_at IS NULL;

CREATE OR REPLACE FUNCTION public.can_work_ticket(_ticket uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  select exists (select 1 from public.tickets t where t.id = _ticket and (
    public.is_org_staff(t.organization_id) or t.assigned_operator_id in (select public.user_operator_ids())))
$$;
REVOKE ALL ON FUNCTION public.can_work_ticket(uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.can_work_ticket(uuid) TO authenticated;

CREATE TABLE public.ticket_photos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id),
  ticket_id uuid NOT NULL REFERENCES public.tickets(id) ON DELETE CASCADE,
  storage_path text NOT NULL UNIQUE,
  uploaded_by uuid DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, DELETE ON public.ticket_photos TO authenticated;
GRANT ALL ON public.ticket_photos TO service_role;
ALTER TABLE public.ticket_photos ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.ticket_photos_before_insert()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  SELECT organization_id INTO new.organization_id FROM public.tickets WHERE id = new.ticket_id;
  new.uploaded_by := auth.uid();
  RETURN new;
END $$;
CREATE TRIGGER ticket_photos_before_insert BEFORE INSERT ON public.ticket_photos
  FOR EACH ROW EXECUTE FUNCTION public.ticket_photos_before_insert();

CREATE POLICY "View ticket photos" ON public.ticket_photos FOR SELECT TO authenticated
  USING (public.can_view_ticket(ticket_id));
CREATE POLICY "Workers add ticket photos" ON public.ticket_photos FOR INSERT TO authenticated
  WITH CHECK (public.can_work_ticket(ticket_id) AND storage_path LIKE ticket_id::text || '/%');
CREATE POLICY "Staff or uploader delete photos" ON public.ticket_photos FOR DELETE TO authenticated
  USING (public.is_org_staff(organization_id) OR uploaded_by = auth.uid());

CREATE POLICY "View ticket photo files" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'ticket-photos' AND public.can_view_ticket(((storage.foldername(name))[1])::uuid));
CREATE POLICY "Workers upload ticket photo files" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'ticket-photos' AND public.can_work_ticket(((storage.foldername(name))[1])::uuid));