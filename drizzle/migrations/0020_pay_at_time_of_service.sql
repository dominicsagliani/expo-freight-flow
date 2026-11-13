ALTER TABLE public.organizations ADD COLUMN IF NOT EXISTS payment_link_url text, ADD COLUMN IF NOT EXISTS payment_instructions text;
ALTER TABLE public.organizations ADD CONSTRAINT organizations_payment_link_https CHECK (payment_link_url IS NULL OR payment_link_url ~* '^https://');
ALTER TABLE public.tickets ADD COLUMN IF NOT EXISTS invoice_sent_at timestamptz, ADD COLUMN IF NOT EXISTS paid_at timestamptz, ADD COLUMN IF NOT EXISTS paid_marked_by uuid;

CREATE OR REPLACE FUNCTION public.mark_ticket_paid(_ticket uuid, _paid boolean)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _org uuid; _status text;
BEGIN
  SELECT organization_id, status::text INTO _org, _status FROM tickets WHERE id = _ticket;
  IF _org IS NULL OR NOT public.is_org_staff(_org) THEN RAISE EXCEPTION 'Not allowed'; END IF;
  IF _paid AND _status <> 'completed' THEN RAISE EXCEPTION 'Only completed jobs can be marked paid'; END IF;
  UPDATE tickets SET paid_at = CASE WHEN _paid THEN now() ELSE NULL END,
    paid_marked_by = CASE WHEN _paid THEN auth.uid() ELSE NULL END WHERE id = _ticket;
END $$;
REVOKE ALL ON FUNCTION public.mark_ticket_paid(uuid, boolean) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.mark_ticket_paid(uuid, boolean) TO authenticated;