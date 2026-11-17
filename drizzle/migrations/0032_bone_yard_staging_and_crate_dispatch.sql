CREATE TABLE public.freight_staging (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  freight_id uuid NOT NULL REFERENCES public.freight_items(id) ON DELETE CASCADE,
  event_id uuid REFERENCES public.events(id) ON DELETE CASCADE,
  area text NOT NULL,
  location_note text,
  landmark text,
  photo_path text,
  staged_by uuid,
  staged_by_name text,
  staged_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX freight_staging_freight_idx ON public.freight_staging(freight_id, staged_at DESC);
GRANT SELECT, INSERT ON public.freight_staging TO authenticated;
GRANT ALL ON public.freight_staging TO service_role;
ALTER TABLE public.freight_staging ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff and drivers view staging" ON public.freight_staging FOR SELECT TO authenticated
  USING (public.is_org_staff(organization_id) OR public.has_org_role(organization_id,'operator'));
CREATE POLICY "Staff record staging" ON public.freight_staging FOR INSERT TO authenticated
  WITH CHECK (public.is_org_staff(organization_id));

CREATE OR REPLACE FUNCTION public.freight_staging_before_insert() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
begin
  select organization_id, event_id into new.organization_id, new.event_id from public.freight_items where id = new.freight_id;
  if new.organization_id is null then raise exception 'Freight not found'; end if;
  if not public.is_org_staff(new.organization_id) then raise exception 'Only company staff can stage freight'; end if;
  new.area := nullif(trim(new.area),'');
  if new.area is null then raise exception 'Staging area is required'; end if;
  if new.photo_path is not null and split_part(new.photo_path,'/',1) <> new.organization_id::text then raise exception 'Invalid photo path'; end if;
  new.staged_by := auth.uid(); new.staged_at := now();
  new.staged_by_name := coalesce((select coalesce(nullif(full_name,''), email) from public.profiles where id = auth.uid()), 'Staff');
  update public.freight_items set
    storage_location = concat_ws(' · ', new.area, nullif(trim(new.location_note),''), case when nullif(trim(new.landmark),'') is not null then 'near '||trim(new.landmark) end),
    arrival_status = case when arrival_status in ('expected','received','in_storage') then 'in_storage'::arrival_status else arrival_status end
  where id = new.freight_id;
  perform public.log_activity(new.organization_id,'freight_staged',null,new.freight_id,new.event_id,
    jsonb_build_object('area',new.area,'note',new.location_note,'landmark',new.landmark,'photo',new.photo_path is not null));
  return new;
end $$;
CREATE TRIGGER freight_staging_before_insert BEFORE INSERT ON public.freight_staging
  FOR EACH ROW EXECUTE FUNCTION public.freight_staging_before_insert();

CREATE OR REPLACE FUNCTION public.ticket_freight_no_conflict() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
begin
  if exists (select 1 from public.ticket_freight tf join public.tickets t on t.id = tf.ticket_id
             where tf.freight_id = new.freight_id and tf.ticket_id <> new.ticket_id
               and t.status in ('requested','assigned','in_progress')) then
    raise exception 'This crate is already on another open delivery job';
  end if;
  return new;
end $$;
CREATE TRIGGER ticket_freight_no_conflict BEFORE INSERT ON public.ticket_freight
  FOR EACH ROW EXECUTE FUNCTION public.ticket_freight_no_conflict();

CREATE OR REPLACE FUNCTION public.dispatch_staged_crates(_freight uuid[], _priority ticket_priority DEFAULT 'normal', _destination text DEFAULT NULL, _notes text DEFAULT NULL)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
declare f record; n int; t_id uuid;
begin
  if _freight is null or cardinality(_freight) = 0 then raise exception 'Select at least one crate'; end if;
  select min(organization_id::text)::uuid org, min(event_id::text)::uuid ev, min(exhibitor_id::text)::uuid exh,
         count(distinct organization_id) orgs, count(distinct event_id) evs, count(distinct exhibitor_id) exhs,
         count(*) cnt, sum(weight_lbs) w, min(booth_number) booth
    into f from public.freight_items where id = any(_freight);
  if f.cnt <> cardinality(_freight) then raise exception 'Crate not found'; end if;
  if f.orgs <> 1 or not public.is_org_staff(f.org) then raise exception 'Only company staff can dispatch crates'; end if;
  if f.evs <> 1 or f.exhs <> 1 then raise exception 'Combine crates for one exhibitor at one event per job'; end if;
  perform pg_advisory_xact_lock(hashtext(f.ev::text));
  insert into public.tickets (organization_id, event_id, exhibitor_id, booth_number, service_type, priority, destination, special_instructions, ticket_number, estimated_weight_lbs)
  values (f.org, f.ev, f.exh, f.booth, 'inbound_delivery', coalesce(_priority,'normal'),
          coalesce(nullif(trim(_destination),''), case when f.booth is not null then 'Booth '||f.booth end), nullif(trim(_notes),''), '', f.w)
  returning id into t_id;
  insert into public.ticket_freight (ticket_id, freight_id, organization_id) select t_id, x, f.org from unnest(_freight) x;
  perform public.queue_dispatch(f.ev);
  return t_id;
end $$;
REVOKE ALL ON FUNCTION public.dispatch_staged_crates(uuid[], ticket_priority, text, text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.dispatch_staged_crates(uuid[], ticket_priority, text, text) TO authenticated;