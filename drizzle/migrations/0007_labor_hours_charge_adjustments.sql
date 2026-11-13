ALTER TABLE public.tickets ADD COLUMN labor_hours numeric(6,2);
ALTER TABLE public.tickets ADD COLUMN calculated_charge numeric(12,2);
ALTER TABLE public.tickets ADD COLUMN charge_adjustment_reason text;
ALTER TABLE public.tickets ADD COLUMN charge_adjusted_by uuid;
ALTER TABLE public.tickets ADD COLUMN charge_adjusted_at timestamptz;
ALTER TABLE public.tickets ADD CONSTRAINT tickets_labor_hours_range CHECK (labor_hours IS NULL OR (labor_hours > 0 AND labor_hours <= 999));

CREATE OR REPLACE FUNCTION public.calc_ticket_charge(_org uuid, _event uuid, _service public.service_type, _ticket uuid,
  _started timestamptz, _completed timestamptz, _labor numeric)
RETURNS numeric LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE r public.service_rates; w numeric; p integer; hrs numeric; amt numeric;
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
    hrs := CASE WHEN _labor IS NOT NULL THEN _labor
                WHEN _started IS NULL OR _completed IS NULL THEN 1
                ELSE greatest(0.5, ceil(extract(epoch FROM (_completed - _started)) / 1800.0) / 2.0) END;
    amt := hrs * r.rate;
  ELSE amt := r.rate; END IF;
  RETURN round(greatest(amt, r.minimum_charge), 2);
END $$;
REVOKE ALL ON FUNCTION public.calc_ticket_charge(uuid, uuid, public.service_type, uuid, timestamptz, timestamptz, numeric) FROM public, anon, authenticated;

CREATE OR REPLACE FUNCTION public.compute_ticket_charge(_ticket uuid)
RETURNS numeric LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE t public.tickets;
BEGIN
  SELECT * INTO t FROM public.tickets WHERE id = _ticket;
  IF t.id IS NULL THEN RETURN NULL; END IF;
  RETURN public.calc_ticket_charge(t.organization_id, t.event_id, t.service_type, t.id, t.started_at, t.completed_at, t.labor_hours);
END $$;

CREATE OR REPLACE FUNCTION public.tickets_charge_before_update()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE calc numeric; staff_call boolean := auth.uid() IS NOT NULL;
BEGIN
  -- only staff (or system) may change labor hours
  IF new.labor_hours IS DISTINCT FROM old.labor_hours AND staff_call AND NOT public.is_org_staff(old.organization_id) THEN
    RAISE EXCEPTION 'Only dispatchers and admins can enter labor hours';
  END IF;

  IF new.status <> 'completed' THEN
    new.charge_amount := NULL; new.calculated_charge := NULL;
    new.charge_adjustment_reason := NULL; new.charge_adjusted_by := NULL; new.charge_adjusted_at := NULL;
    RETURN new;
  END IF;

  calc := public.calc_ticket_charge(new.organization_id, new.event_id, new.service_type, new.id,
                                    new.started_at, new.completed_at, new.labor_hours);
  new.calculated_charge := calc;

  -- manual adjustment request on an already-completed ticket
  IF old.status = 'completed' AND (new.charge_amount IS DISTINCT FROM old.charge_amount
       OR new.charge_adjustment_reason IS DISTINCT FROM old.charge_adjustment_reason) THEN
    IF staff_call AND NOT public.is_org_admin(old.organization_id) THEN
      RAISE EXCEPTION 'Only company admins can adjust charges';
    END IF;
    IF new.charge_amount IS NULL THEN
      -- reset to calculated
      new.charge_amount := calc;
      new.charge_adjustment_reason := NULL; new.charge_adjusted_by := NULL; new.charge_adjusted_at := NULL;
      PERFORM public.log_activity(new.organization_id, 'charge_reset', new.id, NULL, new.event_id,
        jsonb_build_object('ticket_number', new.ticket_number, 'from', old.charge_amount, 'to', calc));
    ELSE
      IF new.charge_amount < 0 THEN RAISE EXCEPTION 'Charge cannot be negative'; END IF;
      IF coalesce(btrim(new.charge_adjustment_reason), '') = '' THEN
        RAISE EXCEPTION 'A reason is required to adjust a charge';
      END IF;
      new.charge_amount := round(new.charge_amount, 2);
      new.charge_adjusted_by := auth.uid(); new.charge_adjusted_at := now();
      PERFORM public.log_activity(new.organization_id, 'charge_adjusted', new.id, NULL, new.event_id,
        jsonb_build_object('ticket_number', new.ticket_number, 'from', old.charge_amount, 'to', new.charge_amount,
                           'reason', new.charge_adjustment_reason));
    END IF;
    RETURN new;
  END IF;

  -- adjusted charges stay locked; otherwise follow the calculation
  IF old.status = 'completed' AND old.charge_adjusted_at IS NOT NULL THEN
    new.charge_amount := old.charge_amount;
    new.charge_adjustment_reason := old.charge_adjustment_reason;
    new.charge_adjusted_by := old.charge_adjusted_by; new.charge_adjusted_at := old.charge_adjusted_at;
  ELSE
    new.charge_amount := calc;
    new.charge_adjustment_reason := NULL; new.charge_adjusted_by := NULL; new.charge_adjusted_at := NULL;
  END IF;

  IF new.labor_hours IS DISTINCT FROM old.labor_hours THEN
    PERFORM public.log_activity(new.organization_id, 'labor_hours_set', new.id, NULL, new.event_id,
      jsonb_build_object('ticket_number', new.ticket_number, 'from', old.labor_hours, 'to', new.labor_hours));
  END IF;
  RETURN new;
END $$;

CREATE OR REPLACE FUNCTION public.tickets_charge_keep()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  RETURN new;
END $$;

UPDATE public.tickets SET calculated_charge = charge_amount WHERE status = 'completed';