CREATE OR REPLACE FUNCTION public.tickets_charge_keep()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF new.status = 'completed' AND old.status = 'completed' AND old.charge_amount IS NULL THEN
    new.charge_amount := public.compute_ticket_charge(new.id);
  END IF;
  RETURN new;
END $$;
CREATE TRIGGER zzz_tickets_charge_keep BEFORE UPDATE ON public.tickets
  FOR EACH ROW EXECUTE FUNCTION public.tickets_charge_keep();
UPDATE public.tickets SET updated_at = now() WHERE status = 'completed' AND charge_amount IS NULL;