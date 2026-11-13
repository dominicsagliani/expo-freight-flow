ALTER TABLE public.exhibitors ADD COLUMN first_name text;
ALTER TABLE public.exhibitors ADD COLUMN last_name text;

UPDATE public.exhibitors
SET first_name = split_part(contact_name, ' ', 1),
    last_name = nullif(btrim(substr(contact_name, length(split_part(contact_name, ' ', 1)) + 1)), '')
WHERE contact_name IS NOT NULL AND btrim(contact_name) <> '';

COMMENT ON COLUMN public.exhibitors.first_name IS 'Contact first name; preferred over contact_name.';
COMMENT ON COLUMN public.exhibitors.last_name IS 'Contact last name; preferred over contact_name.';
COMMENT ON COLUMN public.exhibitors.contact_name IS 'DEPRECATED: replaced by first_name + last_name; kept in sync for labels and invoices.';