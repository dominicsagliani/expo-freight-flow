CREATE OR REPLACE FUNCTION public.tickets_before_insert()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
declare ev_org uuid; booth text;
begin
  select organization_id into ev_org from public.events where id = new.event_id;
  if ev_org is null then raise exception 'Event not found'; end if;
  if not exists (select 1 from public.exhibitors where id = new.exhibitor_id and organization_id = ev_org) then
    raise exception 'Exhibitor does not belong to this company';
  end if;
  new.organization_id := ev_org;
  new.ticket_number := 'MH-' || nextval('public.ticket_number_seq');
  if new.requested_by is null then new.requested_by := auth.uid(); end if;
  if new.booth_number is null or new.booth_number = '' then
    select booth_number into booth from public.event_exhibitors where event_id = new.event_id and exhibitor_id = new.exhibitor_id;
    new.booth_number := booth;
  end if;
  if new.assigned_operator_id is not null and new.assigned_at is null then new.assigned_at := now(); end if;
  return new;
end $function$;
CREATE OR REPLACE FUNCTION public.tickets_keep_number() RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $$
begin
  if new.ticket_number is distinct from old.ticket_number and old.ticket_number ~ '^MH-' then new.ticket_number := old.ticket_number; end if;
  if new.ticket_number !~ '^MH-' then new.ticket_number := 'MH-' || nextval('public.ticket_number_seq'); end if;
  return new;
end $$;
DROP TRIGGER IF EXISTS tickets_keep_number ON public.tickets;
CREATE TRIGGER tickets_keep_number BEFORE UPDATE OF ticket_number ON public.tickets FOR EACH ROW EXECUTE FUNCTION public.tickets_keep_number();