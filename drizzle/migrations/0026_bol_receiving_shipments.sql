create table public.bills_of_lading (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  event_id uuid not null references public.events(id) on delete cascade,
  exhibitor_id uuid not null references public.exhibitors(id) on delete cascade,
  intake_key uuid not null unique default gen_random_uuid(),
  storage_path text not null unique,
  original_filename text not null,
  mime_type text not null,
  file_size_bytes bigint not null,
  carrier_name text,
  pro_number text,
  shipper_name text,
  consignee_name text,
  booth_number text,
  declared_pieces integer not null,
  description text,
  total_weight_lbs numeric(12,2),
  special_instructions text,
  received_by uuid,
  created_at timestamptz not null default now(),
  constraint bol_mime_allowed check (mime_type in ('application/pdf', 'image/jpeg', 'image/png')),
  constraint bol_file_size_valid check (file_size_bytes > 0 and file_size_bytes <= 15728640),
  constraint bol_declared_pieces_valid check (declared_pieces between 1 and 50),
  constraint bol_total_weight_valid check (total_weight_lbs is null or total_weight_lbs >= 0)
);
grant select on public.bills_of_lading to authenticated;
grant all on public.bills_of_lading to service_role;
alter table public.bills_of_lading enable row level security;
create policy "Staff view bills of lading" on public.bills_of_lading for select to authenticated
  using (public.is_org_staff(organization_id));

alter table public.freight_items add column bol_id uuid references public.bills_of_lading(id) on delete set null;
alter table public.freight_items add column bol_crate_number integer;
create index freight_items_bol_idx on public.freight_items (bol_id, bol_crate_number);
create index bills_of_lading_event_idx on public.bills_of_lading (event_id, created_at desc);

create or replace function public.receive_bill_of_lading(
  _event uuid,
  _exhibitor uuid,
  _storage_path text,
  _filename text,
  _mime text,
  _file_size bigint,
  _carrier text,
  _pro text,
  _shipper text,
  _consignee text,
  _booth text,
  _declared_pieces integer,
  _description text,
  _total_weight numeric,
  _special text,
  _crates jsonb,
  _intake_key uuid
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_org uuid;
  v_bol_id uuid;
  v_count integer;
  v_booth text;
begin
  if _intake_key is null then raise exception 'Missing intake key'; end if;

  select b.id, b.organization_id into v_bol_id, v_org
    from public.bills_of_lading b where b.intake_key = _intake_key;
  if v_bol_id is not null then
    if not public.is_org_staff(v_org) then raise exception 'Not authorized'; end if;
    return (select jsonb_build_object(
      'bol_id', v_bol_id,
      'freight_ids', coalesce(jsonb_agg(f.id order by f.bol_crate_number), '[]'::jsonb)
    ) from public.freight_items f where f.bol_id = v_bol_id);
  end if;

  select e.organization_id into v_org from public.events e where e.id = _event;
  if v_org is null then raise exception 'Event not found'; end if;
  if not public.is_org_staff(v_org) then raise exception 'Not authorized'; end if;
  if not exists (select 1 from public.exhibitors x where x.id = _exhibitor and x.organization_id = v_org) then
    raise exception 'Exhibitor does not belong to this company';
  end if;
  if not exists (select 1 from public.event_exhibitors ee where ee.event_id = _event and ee.exhibitor_id = _exhibitor) then
    raise exception 'Exhibitor is not registered for this event';
  end if;
  if _crates is null or jsonb_typeof(_crates) <> 'array' then raise exception 'Crate list is required'; end if;
  v_count := jsonb_array_length(_crates);
  if v_count < 1 or v_count > 50 then raise exception 'Enter between 1 and 50 crates'; end if;
  if _declared_pieces is distinct from v_count then raise exception 'Piece count must match the individual crate records'; end if;
  if exists (
    select 1 from jsonb_array_elements(_crates) c(value)
    where jsonb_typeof(c.value) <> 'object'
       or (nullif(c.value->>'weight_lbs', '') is not null and (c.value->>'weight_lbs')::numeric < 0)
  ) then raise exception 'Crate weights cannot be negative'; end if;
  if _total_weight is not null and _total_weight < 0 then raise exception 'Total weight cannot be negative'; end if;
  if _mime not in ('application/pdf', 'image/jpeg', 'image/png') then raise exception 'Only PDF, JPG and PNG files are allowed'; end if;
  if _file_size <= 0 or _file_size > 15728640 then raise exception 'Document must be 15 MB or smaller'; end if;
  if nullif(trim(_filename), '') is null then raise exception 'Original filename is required'; end if;
  if _storage_path <> v_org::text || '/' || _event::text || '/' || _intake_key::text || '/' || _filename then
    raise exception 'Document path does not match this shipment';
  end if;
  if not exists (select 1 from storage.objects o where o.bucket_id = 'bol-documents' and o.name = _storage_path) then
    raise exception 'Upload the BOL document before check-in';
  end if;

  select ee.booth_number into v_booth from public.event_exhibitors ee
    where ee.event_id = _event and ee.exhibitor_id = _exhibitor;

  insert into public.bills_of_lading (
    organization_id, event_id, exhibitor_id, intake_key, storage_path, original_filename,
    mime_type, file_size_bytes, carrier_name, pro_number, shipper_name, consignee_name,
    booth_number, declared_pieces, description, total_weight_lbs, special_instructions, received_by
  ) values (
    v_org, _event, _exhibitor, _intake_key, _storage_path, trim(_filename),
    _mime, _file_size, nullif(trim(_carrier), ''), nullif(trim(_pro), ''), nullif(trim(_shipper), ''),
    nullif(trim(_consignee), ''), coalesce(nullif(trim(_booth), ''), v_booth), _declared_pieces,
    nullif(trim(_description), ''), _total_weight, nullif(trim(_special), ''), auth.uid()
  ) returning id into v_bol_id;

  insert into public.freight_items (
    organization_id, event_id, exhibitor_id, bol_id, bol_crate_number, freight_code,
    freight_type, description, pieces, weight_lbs, booth_number, arrival_status, created_by
  )
  select
    v_org, _event, _exhibitor, v_bol_id, c.ordinality, '', 'crate',
    left(coalesce(nullif(trim(c.value->>'description'), ''), nullif(trim(_description), ''), 'Received freight')
      || ' — Crate ' || c.ordinality::text, 500),
    1, coalesce(nullif(c.value->>'weight_lbs', '')::numeric, 0),
    coalesce(nullif(trim(_booth), ''), v_booth), 'received', auth.uid()
  from jsonb_array_elements(_crates) with ordinality c(value, ordinality);

  perform public.log_activity(v_org, 'bol_received', null, null, _event,
    jsonb_build_object('bol_id', v_bol_id, 'crate_count', v_count, 'pro_number', nullif(trim(_pro), '')), now());

  return (select jsonb_build_object(
    'bol_id', v_bol_id,
    'freight_ids', coalesce(jsonb_agg(f.id order by f.bol_crate_number), '[]'::jsonb)
  ) from public.freight_items f where f.bol_id = v_bol_id);
end $$;
revoke all on function public.receive_bill_of_lading(uuid, uuid, text, text, text, bigint, text, text, text, text, text, integer, text, numeric, text, jsonb, uuid) from public;
grant execute on function public.receive_bill_of_lading(uuid, uuid, text, text, text, bigint, text, text, text, text, text, integer, text, numeric, text, jsonb, uuid) to authenticated;

create policy "Staff view BOL files" on storage.objects for select to authenticated
  using (bucket_id = 'bol-documents' and public.is_org_staff(((storage.foldername(name))[1])::uuid));
create policy "Staff upload BOL files" on storage.objects for insert to authenticated
  with check (bucket_id = 'bol-documents' and public.is_org_staff(((storage.foldername(name))[1])::uuid));
create policy "Staff delete BOL files" on storage.objects for delete to authenticated
  using (bucket_id = 'bol-documents' and public.is_org_staff(((storage.foldername(name))[1])::uuid));