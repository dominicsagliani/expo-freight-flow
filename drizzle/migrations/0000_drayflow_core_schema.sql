
-- ============ ENUMS ============
create type public.app_role as enum ('super_admin','company_admin','dispatcher','operator','exhibitor');
create type public.event_status as enum ('planning','move_in','live','move_out','closed');
create type public.freight_type as enum ('crate','pallet','skid','carton','loose','other');
create type public.arrival_status as enum ('expected','received','in_storage','delivered_to_booth','outbound','shipped');
create type public.ticket_status as enum ('requested','assigned','in_progress','completed','cancelled');
create type public.ticket_priority as enum ('low','normal','high','urgent');
create type public.service_type as enum ('inbound_delivery','outbound_pickup','empty_crate_return','storage_move','equipment_lift','rigging_assist');
create type public.operator_status as enum ('available','on_job','off_shift');
create type public.equipment_status as enum ('available','in_use','maintenance');
create type public.rate_unit as enum ('per_cwt','per_piece','per_hour','flat');

-- ============ TABLES ============
create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text unique,
  created_at timestamptz not null default now()
);

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  full_name text,
  phone text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  venue text not null,
  city text,
  address text,
  start_date date not null,
  end_date date not null,
  move_in_date date,
  move_out_date date,
  status public.event_status not null default 'planning',
  notes text,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.exhibitors (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  company_name text not null,
  contact_name text,
  contact_email text,
  contact_phone text,
  billing_address text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.event_exhibitors (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  event_id uuid not null references public.events(id) on delete cascade,
  exhibitor_id uuid not null references public.exhibitors(id) on delete cascade,
  booth_number text not null,
  created_at timestamptz not null default now(),
  unique (event_id, exhibitor_id)
);

create table public.operators (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid,
  full_name text not null,
  phone text,
  certification_number text,
  certification_expires date,
  status public.operator_status not null default 'available',
  created_at timestamptz not null default now()
);

create table public.equipment (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  unit_number text not null,
  description text,
  capacity_lbs integer,
  status public.equipment_status not null default 'available',
  created_at timestamptz not null default now()
);

create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  organization_id uuid references public.organizations(id) on delete cascade,
  role public.app_role not null,
  exhibitor_id uuid references public.exhibitors(id) on delete cascade,
  operator_id uuid references public.operators(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (user_id, organization_id, role)
);

create table public.freight_items (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  event_id uuid not null references public.events(id) on delete cascade,
  exhibitor_id uuid not null references public.exhibitors(id) on delete cascade,
  freight_code text not null unique,
  qr_token text not null unique default (replace(gen_random_uuid()::text,'-','') || replace(gen_random_uuid()::text,'-','')),
  freight_type public.freight_type not null default 'pallet',
  description text not null,
  pieces integer not null default 1,
  weight_lbs numeric(10,2) not null default 0,
  length_in numeric(8,2),
  width_in numeric(8,2),
  height_in numeric(8,2),
  booth_number text,
  arrival_status public.arrival_status not null default 'expected',
  storage_location text,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create sequence public.ticket_number_seq start 10001;

create table public.tickets (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  ticket_number text not null unique,
  event_id uuid not null references public.events(id) on delete cascade,
  exhibitor_id uuid not null references public.exhibitors(id) on delete cascade,
  booth_number text,
  service_type public.service_type not null,
  priority public.ticket_priority not null default 'normal',
  destination text,
  special_instructions text,
  status public.ticket_status not null default 'requested',
  requested_at timestamptz not null default now(),
  requested_by uuid,
  assigned_operator_id uuid references public.operators(id) on delete set null,
  assigned_equipment_id uuid references public.equipment(id) on delete set null,
  assigned_at timestamptz,
  started_at timestamptz,
  completed_at timestamptz,
  completion_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.ticket_freight (
  ticket_id uuid not null references public.tickets(id) on delete cascade,
  freight_id uuid not null references public.freight_items(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  scanned_at timestamptz,
  scanned_by uuid,
  created_at timestamptz not null default now(),
  primary key (ticket_id, freight_id)
);

create table public.rate_cards (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  event_id uuid references public.events(id) on delete cascade,
  name text not null,
  is_default boolean not null default false,
  created_at timestamptz not null default now()
);

create table public.service_rates (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  rate_card_id uuid not null references public.rate_cards(id) on delete cascade,
  service_type public.service_type not null,
  unit public.rate_unit not null,
  rate numeric(10,2) not null,
  minimum_charge numeric(10,2) not null default 0,
  created_at timestamptz not null default now(),
  unique (rate_card_id, service_type)
);

create table public.activity_log (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  action text not null,
  ticket_id uuid references public.tickets(id) on delete cascade,
  freight_id uuid references public.freight_items(id) on delete cascade,
  event_id uuid references public.events(id) on delete cascade,
  details jsonb not null default '{}'::jsonb,
  actor_id uuid,
  actor_name text,
  created_at timestamptz not null default now()
);

create index on public.events (organization_id);
create index on public.exhibitors (organization_id);
create index on public.event_exhibitors (event_id);
create index on public.freight_items (event_id);
create index on public.freight_items (exhibitor_id);
create index on public.tickets (organization_id, status);
create index on public.tickets (assigned_operator_id);
create index on public.tickets (exhibitor_id);
create index on public.activity_log (organization_id, created_at desc);
create index on public.activity_log (ticket_id);
create index on public.user_roles (user_id);

-- ============ GRANTS ============
grant select, insert, update, delete on public.organizations, public.profiles, public.events, public.exhibitors,
  public.event_exhibitors, public.operators, public.equipment, public.user_roles, public.freight_items,
  public.tickets, public.ticket_freight, public.rate_cards, public.service_rates to authenticated;
grant select on public.activity_log to authenticated;
grant all on public.organizations, public.profiles, public.events, public.exhibitors, public.event_exhibitors,
  public.operators, public.equipment, public.user_roles, public.freight_items, public.tickets,
  public.ticket_freight, public.rate_cards, public.service_rates, public.activity_log to service_role;
grant usage on sequence public.ticket_number_seq to authenticated, service_role;

-- ============ RLS ENABLE ============
alter table public.organizations enable row level security;
alter table public.profiles enable row level security;
alter table public.events enable row level security;
alter table public.exhibitors enable row level security;
alter table public.event_exhibitors enable row level security;
alter table public.operators enable row level security;
alter table public.equipment enable row level security;
alter table public.user_roles enable row level security;
alter table public.freight_items enable row level security;
alter table public.tickets enable row level security;
alter table public.ticket_freight enable row level security;
alter table public.rate_cards enable row level security;
alter table public.service_rates enable row level security;
alter table public.activity_log enable row level security;

-- ============ ACCESS HELPERS (security definer, avoid RLS recursion) ============
create or replace function public.is_super_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.user_roles where user_id = auth.uid() and role = 'super_admin')
$$;

create or replace function public.has_org_role(_org uuid, _role public.app_role) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.user_roles where user_id = auth.uid() and organization_id = _org and role = _role)
$$;

create or replace function public.is_org_admin(_org uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select public.is_super_admin() or exists (
    select 1 from public.user_roles where user_id = auth.uid() and organization_id = _org and role = 'company_admin')
$$;

create or replace function public.is_org_staff(_org uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select public.is_super_admin() or exists (
    select 1 from public.user_roles where user_id = auth.uid() and organization_id = _org
      and role in ('company_admin','dispatcher'))
$$;

create or replace function public.is_org_member(_org uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select public.is_super_admin() or exists (
    select 1 from public.user_roles where user_id = auth.uid() and organization_id = _org)
$$;

create or replace function public.user_exhibitor_ids() returns setof uuid
language sql stable security definer set search_path = public as $$
  select exhibitor_id from public.user_roles
  where user_id = auth.uid() and role = 'exhibitor' and exhibitor_id is not null
$$;

create or replace function public.user_operator_ids() returns setof uuid
language sql stable security definer set search_path = public as $$
  select operator_id from public.user_roles
  where user_id = auth.uid() and role = 'operator' and operator_id is not null
$$;

create or replace function public.exhibitor_event_ids() returns setof uuid
language sql stable security definer set search_path = public as $$
  select event_id from public.event_exhibitors
  where exhibitor_id in (select public.user_exhibitor_ids())
$$;

create or replace function public.operator_ticket_ids() returns setof uuid
language sql stable security definer set search_path = public as $$
  select id from public.tickets where assigned_operator_id in (select public.user_operator_ids())
$$;

create or replace function public.operator_freight_ids() returns setof uuid
language sql stable security definer set search_path = public as $$
  select freight_id from public.ticket_freight where ticket_id in (select public.operator_ticket_ids())
$$;

create or replace function public.operator_exhibitor_ids() returns setof uuid
language sql stable security definer set search_path = public as $$
  select exhibitor_id from public.tickets where assigned_operator_id in (select public.user_operator_ids())
$$;

create or replace function public.can_view_ticket(_ticket uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.tickets t where t.id = _ticket and (
      public.is_org_staff(t.organization_id)
      or t.exhibitor_id in (select public.user_exhibitor_ids())
      or t.assigned_operator_id in (select public.user_operator_ids())))
$$;

-- ============ POLICIES ============
-- organizations
create policy "Members view their organization" on public.organizations for select to authenticated
  using (public.is_org_member(id));
create policy "Admins update their organization" on public.organizations for update to authenticated
  using (public.is_org_admin(id)) with check (public.is_org_admin(id));
create policy "Super admins create organizations" on public.organizations for insert to authenticated
  with check (public.is_super_admin());
create policy "Super admins delete organizations" on public.organizations for delete to authenticated
  using (public.is_super_admin());

-- profiles
create policy "Users view own profile or staff view org members" on public.profiles for select to authenticated
  using (id = auth.uid() or exists (
    select 1 from public.user_roles ur where ur.user_id = profiles.id and public.is_org_staff(ur.organization_id)));
create policy "Users update own profile" on public.profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());
create policy "Users insert own profile" on public.profiles for insert to authenticated
  with check (id = auth.uid());

-- user_roles
create policy "View own roles or org roles as staff" on public.user_roles for select to authenticated
  using (user_id = auth.uid() or public.is_org_staff(organization_id));
create policy "Admins grant roles" on public.user_roles for insert to authenticated
  with check (public.is_org_admin(organization_id) and (role <> 'super_admin' or public.is_super_admin()));
create policy "Admins change roles" on public.user_roles for update to authenticated
  using (public.is_org_admin(organization_id))
  with check (public.is_org_admin(organization_id) and (role <> 'super_admin' or public.is_super_admin()));
create policy "Admins revoke roles" on public.user_roles for delete to authenticated
  using (public.is_org_admin(organization_id) and (role <> 'super_admin' or public.is_super_admin()));

-- events
create policy "View events" on public.events for select to authenticated
  using (public.is_org_staff(organization_id) or public.has_org_role(organization_id, 'operator')
    or id in (select public.exhibitor_event_ids()));
create policy "Admins create events" on public.events for insert to authenticated
  with check (public.is_org_admin(organization_id));
create policy "Admins update events" on public.events for update to authenticated
  using (public.is_org_admin(organization_id)) with check (public.is_org_admin(organization_id));
create policy "Admins delete events" on public.events for delete to authenticated
  using (public.is_org_admin(organization_id));

-- exhibitors
create policy "View exhibitors" on public.exhibitors for select to authenticated
  using (public.is_org_staff(organization_id) or id in (select public.user_exhibitor_ids())
    or id in (select public.operator_exhibitor_ids()));
create policy "Staff create exhibitors" on public.exhibitors for insert to authenticated
  with check (public.is_org_staff(organization_id));
create policy "Staff update exhibitors" on public.exhibitors for update to authenticated
  using (public.is_org_staff(organization_id)) with check (public.is_org_staff(organization_id));
create policy "Admins delete exhibitors" on public.exhibitors for delete to authenticated
  using (public.is_org_admin(organization_id));

-- event_exhibitors
create policy "View booth assignments" on public.event_exhibitors for select to authenticated
  using (public.is_org_staff(organization_id) or public.has_org_role(organization_id, 'operator')
    or exhibitor_id in (select public.user_exhibitor_ids()));
create policy "Staff assign booths" on public.event_exhibitors for insert to authenticated
  with check (public.is_org_staff(organization_id));
create policy "Staff update booths" on public.event_exhibitors for update to authenticated
  using (public.is_org_staff(organization_id)) with check (public.is_org_staff(organization_id));
create policy "Staff remove booths" on public.event_exhibitors for delete to authenticated
  using (public.is_org_staff(organization_id));

-- operators
create policy "Staff and operators view operators" on public.operators for select to authenticated
  using (public.is_org_staff(organization_id) or id in (select public.user_operator_ids()));
create policy "Staff manage operators" on public.operators for insert to authenticated
  with check (public.is_org_staff(organization_id));
create policy "Staff update operators" on public.operators for update to authenticated
  using (public.is_org_staff(organization_id)) with check (public.is_org_staff(organization_id));
create policy "Admins delete operators" on public.operators for delete to authenticated
  using (public.is_org_admin(organization_id));

-- equipment
create policy "Staff and operators view equipment" on public.equipment for select to authenticated
  using (public.is_org_staff(organization_id) or public.has_org_role(organization_id, 'operator'));
create policy "Staff add equipment" on public.equipment for insert to authenticated
  with check (public.is_org_staff(organization_id));
create policy "Staff update equipment" on public.equipment for update to authenticated
  using (public.is_org_staff(organization_id)) with check (public.is_org_staff(organization_id));
create policy "Admins delete equipment" on public.equipment for delete to authenticated
  using (public.is_org_admin(organization_id));

-- freight_items
create policy "View freight" on public.freight_items for select to authenticated
  using (public.is_org_staff(organization_id) or exhibitor_id in (select public.user_exhibitor_ids())
    or id in (select public.operator_freight_ids()));
create policy "Staff or owning exhibitor register freight" on public.freight_items for insert to authenticated
  with check (public.is_org_staff(organization_id) or exhibitor_id in (select public.user_exhibitor_ids()));
create policy "Staff update freight" on public.freight_items for update to authenticated
  using (public.is_org_staff(organization_id)) with check (public.is_org_staff(organization_id));
create policy "Exhibitors edit own expected freight" on public.freight_items for update to authenticated
  using (exhibitor_id in (select public.user_exhibitor_ids()) and arrival_status = 'expected')
  with check (exhibitor_id in (select public.user_exhibitor_ids()) and arrival_status = 'expected');
create policy "Staff delete freight" on public.freight_items for delete to authenticated
  using (public.is_org_staff(organization_id));

-- tickets
create policy "View tickets" on public.tickets for select to authenticated
  using (public.is_org_staff(organization_id) or exhibitor_id in (select public.user_exhibitor_ids())
    or assigned_operator_id in (select public.user_operator_ids()));
create policy "Staff create tickets" on public.tickets for insert to authenticated
  with check (public.is_org_staff(organization_id));
create policy "Exhibitors request own tickets" on public.tickets for insert to authenticated
  with check (exhibitor_id in (select public.user_exhibitor_ids()) and status = 'requested'
    and assigned_operator_id is null and assigned_equipment_id is null);
create policy "Staff update tickets" on public.tickets for update to authenticated
  using (public.is_org_staff(organization_id)) with check (public.is_org_staff(organization_id));
create policy "Admins delete tickets" on public.tickets for delete to authenticated
  using (public.is_org_admin(organization_id));

-- ticket_freight
create policy "View ticket freight" on public.ticket_freight for select to authenticated
  using (public.can_view_ticket(ticket_id));
create policy "Staff or owning exhibitor attach freight" on public.ticket_freight for insert to authenticated
  with check (public.is_org_staff(organization_id) or (
    exists (select 1 from public.tickets t where t.id = ticket_id and t.exhibitor_id in (select public.user_exhibitor_ids()) and t.status = 'requested')
    and exists (select 1 from public.freight_items f where f.id = freight_id and f.exhibitor_id in (select public.user_exhibitor_ids()))));
create policy "Staff update ticket freight" on public.ticket_freight for update to authenticated
  using (public.is_org_staff(organization_id)) with check (public.is_org_staff(organization_id));
create policy "Staff detach freight" on public.ticket_freight for delete to authenticated
  using (public.is_org_staff(organization_id));

-- rate cards & rates
create policy "Staff view rate cards" on public.rate_cards for select to authenticated
  using (public.is_org_staff(organization_id));
create policy "Admins manage rate cards" on public.rate_cards for insert to authenticated
  with check (public.is_org_admin(organization_id));
create policy "Admins update rate cards" on public.rate_cards for update to authenticated
  using (public.is_org_admin(organization_id)) with check (public.is_org_admin(organization_id));
create policy "Admins delete rate cards" on public.rate_cards for delete to authenticated
  using (public.is_org_admin(organization_id));
create policy "Staff view rates" on public.service_rates for select to authenticated
  using (public.is_org_staff(organization_id));
create policy "Admins add rates" on public.service_rates for insert to authenticated
  with check (public.is_org_admin(organization_id));
create policy "Admins update rates" on public.service_rates for update to authenticated
  using (public.is_org_admin(organization_id)) with check (public.is_org_admin(organization_id));
create policy "Admins delete rates" on public.service_rates for delete to authenticated
  using (public.is_org_admin(organization_id));

-- activity_log (read only for clients; writes come from triggers)
create policy "View activity" on public.activity_log for select to authenticated
  using (public.is_org_staff(organization_id)
    or (ticket_id is not null and public.can_view_ticket(ticket_id)));

-- ============ ACTIVITY LOGGING ============
create or replace function public.log_activity(_org uuid, _action text, _ticket uuid, _freight uuid, _event uuid,
  _details jsonb, _at timestamptz default now()) returns void
language plpgsql security definer set search_path = public as $$
begin
  insert into public.activity_log (organization_id, action, ticket_id, freight_id, event_id, details, actor_id, actor_name, created_at)
  values (_org, _action, _ticket, _freight, _event, coalesce(_details, '{}'::jsonb), auth.uid(),
    coalesce((select coalesce(nullif(full_name, ''), email) from public.profiles where id = auth.uid()), 'System'), _at);
end $$;
revoke execute on function public.log_activity(uuid, text, uuid, uuid, uuid, jsonb, timestamptz) from public, anon, authenticated;

create or replace function public.touch_updated_at() returns trigger
language plpgsql set search_path = public as $$
begin new.updated_at := now(); return new; end $$;

create trigger trg_events_touch before update on public.events for each row execute function public.touch_updated_at();
create trigger trg_exhibitors_touch before update on public.exhibitors for each row execute function public.touch_updated_at();
create trigger trg_profiles_touch before update on public.profiles for each row execute function public.touch_updated_at();

-- event_exhibitors: org derived from event; exhibitor must match org
create or replace function public.event_exhibitors_before_write() returns trigger
language plpgsql security definer set search_path = public as $$
declare ev_org uuid;
begin
  select organization_id into ev_org from public.events where id = new.event_id;
  if ev_org is null then raise exception 'Event not found'; end if;
  if not exists (select 1 from public.exhibitors where id = new.exhibitor_id and organization_id = ev_org) then
    raise exception 'Exhibitor does not belong to this company';
  end if;
  new.organization_id := ev_org;
  return new;
end $$;
create trigger trg_event_exhibitors_before before insert or update on public.event_exhibitors
  for each row execute function public.event_exhibitors_before_write();

-- freight
create or replace function public.freight_before_insert() returns trigger
language plpgsql security definer set search_path = public as $$
declare ev_org uuid; booth text;
begin
  select organization_id into ev_org from public.events where id = new.event_id;
  if ev_org is null then raise exception 'Event not found'; end if;
  if not exists (select 1 from public.exhibitors where id = new.exhibitor_id and organization_id = ev_org) then
    raise exception 'Exhibitor does not belong to this company';
  end if;
  new.organization_id := ev_org;
  if new.freight_code is null or new.freight_code = '' then
    new.freight_code := 'FRT-' || upper(substr(md5(gen_random_uuid()::text), 1, 8));
  end if;
  if new.booth_number is null or new.booth_number = '' then
    select booth_number into booth from public.event_exhibitors where event_id = new.event_id and exhibitor_id = new.exhibitor_id;
    new.booth_number := booth;
  end if;
  if new.created_by is null then new.created_by := auth.uid(); end if;
  return new;
end $$;
create trigger trg_freight_before_insert before insert on public.freight_items
  for each row execute function public.freight_before_insert();

create or replace function public.freight_before_update() returns trigger
language plpgsql set search_path = public as $$
begin
  new.updated_at := now();
  new.qr_token := old.qr_token;           -- QR identifiers are immutable
  new.freight_code := old.freight_code;
  new.organization_id := old.organization_id;
  return new;
end $$;
create trigger trg_freight_before_update before update on public.freight_items
  for each row execute function public.freight_before_update();

create or replace function public.freight_after_write() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    perform public.log_activity(new.organization_id, 'freight_registered', null, new.id, new.event_id,
      jsonb_build_object('freight_code', new.freight_code, 'description', new.description), new.created_at);
  else
    if new.arrival_status is distinct from old.arrival_status or new.storage_location is distinct from old.storage_location then
      perform public.log_activity(new.organization_id, 'freight_status_changed', null, new.id, new.event_id,
        jsonb_build_object('freight_code', new.freight_code, 'from', old.arrival_status, 'to', new.arrival_status,
          'storage_location', new.storage_location));
    end if;
  end if;
  return new;
end $$;
create trigger trg_freight_after_write after insert or update on public.freight_items
  for each row execute function public.freight_after_write();

-- tickets
create or replace function public.tickets_before_insert() returns trigger
language plpgsql security definer set search_path = public as $$
declare ev_org uuid; booth text;
begin
  select organization_id into ev_org from public.events where id = new.event_id;
  if ev_org is null then raise exception 'Event not found'; end if;
  if not exists (select 1 from public.exhibitors where id = new.exhibitor_id and organization_id = ev_org) then
    raise exception 'Exhibitor does not belong to this company';
  end if;
  new.organization_id := ev_org;
  if new.ticket_number is null or new.ticket_number = '' then
    new.ticket_number := 'MH-' || nextval('public.ticket_number_seq');
  end if;
  if new.requested_by is null then new.requested_by := auth.uid(); end if;
  if new.booth_number is null or new.booth_number = '' then
    select booth_number into booth from public.event_exhibitors where event_id = new.event_id and exhibitor_id = new.exhibitor_id;
    new.booth_number := booth;
  end if;
  if new.assigned_operator_id is not null and new.assigned_at is null then new.assigned_at := now(); end if;
  return new;
end $$;
create trigger trg_tickets_before_insert before insert on public.tickets
  for each row execute function public.tickets_before_insert();

create or replace function public.tickets_before_update() returns trigger
language plpgsql set search_path = public as $$
begin
  new.updated_at := now();
  new.organization_id := old.organization_id;
  new.ticket_number := old.ticket_number;
  if new.assigned_operator_id is distinct from old.assigned_operator_id and new.assigned_operator_id is not null then
    new.assigned_at := now();
  end if;
  if new.status is distinct from old.status then
    if new.status = 'in_progress' and new.started_at is null then new.started_at := now(); end if;
    if new.status = 'completed' and new.completed_at is null then new.completed_at := now(); end if;
  end if;
  return new;
end $$;
create trigger trg_tickets_before_update before update on public.tickets
  for each row execute function public.tickets_before_update();

create or replace function public.tickets_after_write() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    perform public.log_activity(new.organization_id, 'ticket_created', new.id, null, new.event_id,
      jsonb_build_object('ticket_number', new.ticket_number, 'service_type', new.service_type, 'status', new.status),
      new.requested_at);
  else
    if new.status is distinct from old.status then
      perform public.log_activity(new.organization_id, 'status_changed', new.id, null, new.event_id,
        jsonb_build_object('ticket_number', new.ticket_number, 'from', old.status, 'to', new.status));
    end if;
    if new.assigned_operator_id is distinct from old.assigned_operator_id
       or new.assigned_equipment_id is distinct from old.assigned_equipment_id then
      perform public.log_activity(new.organization_id, 'assigned', new.id, null, new.event_id,
        jsonb_build_object('ticket_number', new.ticket_number,
          'operator', (select full_name from public.operators where id = new.assigned_operator_id),
          'equipment', (select unit_number from public.equipment where id = new.assigned_equipment_id)));
    end if;
  end if;
  return new;
end $$;
create trigger trg_tickets_after_write after insert or update on public.tickets
  for each row execute function public.tickets_after_write();

-- ticket_freight
create or replace function public.ticket_freight_before_insert() returns trigger
language plpgsql security definer set search_path = public as $$
declare t_org uuid; t_exh uuid; f_org uuid; f_exh uuid;
begin
  select organization_id, exhibitor_id into t_org, t_exh from public.tickets where id = new.ticket_id;
  select organization_id, exhibitor_id into f_org, f_exh from public.freight_items where id = new.freight_id;
  if t_org is null or f_org is null or t_org <> f_org then raise exception 'Ticket and freight must belong to the same company'; end if;
  if t_exh <> f_exh then raise exception 'Freight must belong to the ticket''s exhibitor'; end if;
  new.organization_id := t_org;
  return new;
end $$;
create trigger trg_ticket_freight_before_insert before insert on public.ticket_freight
  for each row execute function public.ticket_freight_before_insert();

create or replace function public.ticket_freight_after_write() returns trigger
language plpgsql security definer set search_path = public as $$
declare f record;
begin
  select freight_code, event_id into f from public.freight_items where id = new.freight_id;
  if tg_op = 'INSERT' then
    perform public.log_activity(new.organization_id, 'freight_attached', new.ticket_id, new.freight_id, f.event_id,
      jsonb_build_object('freight_code', f.freight_code));
  elsif new.scanned_at is distinct from old.scanned_at and new.scanned_at is not null then
    perform public.log_activity(new.organization_id, 'freight_scanned', new.ticket_id, new.freight_id, f.event_id,
      jsonb_build_object('freight_code', f.freight_code));
  end if;
  return new;
end $$;
create trigger trg_ticket_freight_after_write after insert or update on public.ticket_freight
  for each row execute function public.ticket_freight_after_write();

-- ============ DEMO ORGANIZATION + SIGNUP ============
insert into public.organizations (id, name, slug)
values ('d0000000-0000-4000-8000-000000000001', 'Apex Expo Services', 'apex-expo');

create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, full_name)
  values (new.id, new.email, coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)))
  on conflict (id) do nothing;
  -- Demo environment: every new account joins the demo company as a company admin.
  insert into public.user_roles (user_id, organization_id, role)
  values (new.id, 'd0000000-0000-4000-8000-000000000001', 'company_admin')
  on conflict do nothing;
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- ============ DEMO DATA ============
insert into public.events (id, organization_id, name, venue, city, address, start_date, end_date, move_in_date, move_out_date, status, notes) values
('30000000-0000-4000-8000-000000000001', 'd0000000-0000-4000-8000-000000000001',
 'Pacific Manufacturing & Automation Expo 2026', 'Long Beach Convention Center', 'Long Beach, CA',
 '300 E Ocean Blvd, Long Beach, CA 90802', '2026-11-14', '2026-11-17', '2026-11-10', '2026-11-19', 'move_in',
 'Halls A–C. Marshaling yard on Pine Ave. Targeted move-in by booth range.');

insert into public.exhibitors (id, organization_id, company_name, contact_name, contact_email, contact_phone, billing_address) values
('20000000-0000-4000-8000-000000000001','d0000000-0000-4000-8000-000000000001','Northwind Robotics','Elena Marsh','elena.marsh@northwind-robotics.example','(503) 555-0142','1200 NW Marshall St, Portland, OR'),
('20000000-0000-4000-8000-000000000002','d0000000-0000-4000-8000-000000000001','Cascade Hydraulics','Victor Huang','v.huang@cascadehydraulics.example','(206) 555-0177','88 Harbor Way, Tacoma, WA'),
('20000000-0000-4000-8000-000000000003','d0000000-0000-4000-8000-000000000001','Helix Packaging Systems','Dana Whitaker','dana@helixpack.example','(480) 555-0110','4510 E Broadway Rd, Phoenix, AZ'),
('20000000-0000-4000-8000-000000000004','d0000000-0000-4000-8000-000000000001','Summit Conveyor Co.','Jorge Alvarez','jalvarez@summitconveyor.example','(303) 555-0193','777 Industrial Pkwy, Denver, CO'),
('20000000-0000-4000-8000-000000000005','d0000000-0000-4000-8000-000000000001','Ironclad Safety Gear','Priscilla Grant','pgrant@ironcladsafety.example','(702) 555-0126','2100 W Sahara Ave, Las Vegas, NV');

insert into public.event_exhibitors (organization_id, event_id, exhibitor_id, booth_number) values
('d0000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001','1214'),
('d0000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000002','842'),
('d0000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000003','2301'),
('d0000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000004','1507'),
('d0000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000005','618');

insert into public.operators (id, organization_id, full_name, phone, certification_number, certification_expires, status) values
('40000000-0000-4000-8000-000000000001','d0000000-0000-4000-8000-000000000001','Marcus Delgado','(562) 555-0101','OSHA-PIT-44821','2027-06-30','available'),
('40000000-0000-4000-8000-000000000002','d0000000-0000-4000-8000-000000000001','Tanya Okafor','(562) 555-0102','OSHA-PIT-45108','2027-02-15','on_job'),
('40000000-0000-4000-8000-000000000003','d0000000-0000-4000-8000-000000000001','Ray Whitfield','(562) 555-0103','OSHA-PIT-39976','2026-12-31','on_job'),
('40000000-0000-4000-8000-000000000004','d0000000-0000-4000-8000-000000000001','Priya Raman','(562) 555-0104','OSHA-PIT-47233','2028-01-20','available');

insert into public.equipment (id, organization_id, unit_number, description, capacity_lbs, status) values
('50000000-0000-4000-8000-000000000001','d0000000-0000-4000-8000-000000000001','FL-01','Toyota 8FGU25 — LP forklift',5000,'in_use'),
('50000000-0000-4000-8000-000000000002','d0000000-0000-4000-8000-000000000001','FL-02','Toyota 8FGU32 — LP forklift',6500,'available'),
('50000000-0000-4000-8000-000000000003','d0000000-0000-4000-8000-000000000001','FL-03','Hyster H155FT — heavy forklift',15500,'in_use'),
('50000000-0000-4000-8000-000000000004','d0000000-0000-4000-8000-000000000001','FL-04','Toyota 8FGU25 — LP forklift',5000,'available'),
('50000000-0000-4000-8000-000000000005','d0000000-0000-4000-8000-000000000001','PJ-01','Crown WP 3000 — electric pallet jack',4500,'available');

insert into public.freight_items (id, organization_id, event_id, exhibitor_id, freight_code, freight_type, description, pieces, weight_lbs, length_in, width_in, height_in, arrival_status, storage_location, created_at) values
('10000000-0000-4000-8000-000000000001','d0000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001','FRT-7K3M9Q2A','crate','Robotic arm assembly — crated',1,1850,96,60,72,'received','Dock B · Bay 4', now() - interval '30 hours'),
('10000000-0000-4000-8000-000000000002','d0000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001','FRT-R82XH4LD','pallet','Control cabinets and cabling',2,640,48,40,52,'delivered_to_booth','Booth 1214', now() - interval '40 hours'),
('10000000-0000-4000-8000-000000000003','d0000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000002','FRT-C4N7TZ1P','crate','Hydraulic press demo unit',1,3200,120,72,84,'in_storage','Marshaling Yard · Row C', now() - interval '28 hours'),
('10000000-0000-4000-8000-000000000004','d0000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000002','FRT-9VQ2MB6E','pallet','Literature and booth graphics',1,380,48,40,40,'received','Dock A · Bay 2', now() - interval '20 hours'),
('10000000-0000-4000-8000-000000000005','d0000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000003','FRT-H5W8JK3S','skid','Case erector machine',1,2750,110,64,78,'expected',null, now() - interval '18 hours'),
('10000000-0000-4000-8000-000000000006','d0000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000003','FRT-L2D6YF8R','pallet','Packaging film rolls',3,920,48,48,60,'received','Dock B · Bay 1', now() - interval '16 hours'),
('10000000-0000-4000-8000-000000000007','d0000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000004','FRT-P6T3QC9N','crate','Modular conveyor sections (6)',6,2100,144,48,40,'delivered_to_booth','Booth 1507', now() - interval '44 hours'),
('10000000-0000-4000-8000-000000000008','d0000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000004','FRT-B1Z5UG7W','carton','Spare drive motors',4,260,36,24,24,'in_storage','Cage 3 · Shelf B', now() - interval '26 hours'),
('10000000-0000-4000-8000-000000000009','d0000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000005','FRT-E7G4RN2K','pallet','PPE display fixtures',2,540,48,40,66,'expected',null, now() - interval '12 hours'),
('10000000-0000-4000-8000-000000000010','d0000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000005','FRT-S3J9VA5M','crate','Booth build crates (to empty storage)',3,310,72,48,48,'in_storage','Empty Storage · Lot E', now() - interval '22 hours');

insert into public.tickets (id, organization_id, event_id, exhibitor_id, service_type, priority, destination, special_instructions, status, requested_at, assigned_operator_id, assigned_equipment_id, assigned_at, started_at, completed_at, completion_notes) values
('60000000-0000-4000-8000-000000000001','d0000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001','inbound_delivery','high','Booth 1214','Crate is top-heavy. Use fork extensions; exhibitor rep on site after 10:00.','assigned', now() - interval '3 hours','40000000-0000-4000-8000-000000000001','50000000-0000-4000-8000-000000000002', now() - interval '2 hours', null, null, null),
('60000000-0000-4000-8000-000000000002','d0000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001','inbound_delivery','normal','Booth 1214',null,'completed', now() - interval '26 hours','40000000-0000-4000-8000-000000000002','50000000-0000-4000-8000-000000000001', now() - interval '25 hours', now() - interval '24 hours', now() - interval '23 hours 30 minutes','Delivered to rear of booth, signed by E. Marsh.'),
('60000000-0000-4000-8000-000000000003','d0000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000002','inbound_delivery','urgent','Booth 842','Requires 15K lift. Rigging crew meeting operator at booth.','in_progress', now() - interval '2 hours','40000000-0000-4000-8000-000000000003','50000000-0000-4000-8000-000000000003', now() - interval '90 minutes', now() - interval '40 minutes', null, null),
('60000000-0000-4000-8000-000000000004','d0000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000002','inbound_delivery','normal','Booth 842',null,'requested', now() - interval '75 minutes', null, null, null, null, null, null),
('60000000-0000-4000-8000-000000000005','d0000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000003','inbound_delivery','normal','Booth 2301','Carrier ETA 14:00 at Dock A.','requested', now() - interval '50 minutes', null, null, null, null, null, null),
('60000000-0000-4000-8000-000000000006','d0000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000003','inbound_delivery','normal','Booth 2301',null,'assigned', now() - interval '4 hours','40000000-0000-4000-8000-000000000004','50000000-0000-4000-8000-000000000004', now() - interval '3 hours', null, null, null),
('60000000-0000-4000-8000-000000000007','d0000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000004','inbound_delivery','high','Booth 1507',null,'completed', now() - interval '30 hours','40000000-0000-4000-8000-000000000001','50000000-0000-4000-8000-000000000002', now() - interval '29 hours', now() - interval '28 hours', now() - interval '27 hours','All six sections staged along aisle 1500.'),
('60000000-0000-4000-8000-000000000008','d0000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000004','storage_move','normal','Booth 1507','Pull from Cage 3 once aisle carpet is down.','requested', now() - interval '35 minutes', null, null, null, null, null, null),
('60000000-0000-4000-8000-000000000009','d0000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000005','equipment_lift','high','Booth 618','Lift 12 ft hanging sign for rigging. Approx. 1 hour.','requested', now() - interval '20 minutes', null, null, null, null, null, null),
('60000000-0000-4000-8000-000000000010','d0000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000005','empty_crate_return','low','Empty Storage · Lot E',null,'in_progress', now() - interval '5 hours','40000000-0000-4000-8000-000000000002','50000000-0000-4000-8000-000000000001', now() - interval '4 hours', now() - interval '25 minutes', null, null);

insert into public.ticket_freight (ticket_id, freight_id, organization_id, scanned_at) values
('60000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001','d0000000-0000-4000-8000-000000000001', null),
('60000000-0000-4000-8000-000000000002','10000000-0000-4000-8000-000000000002','d0000000-0000-4000-8000-000000000001', now() - interval '24 hours'),
('60000000-0000-4000-8000-000000000003','10000000-0000-4000-8000-000000000003','d0000000-0000-4000-8000-000000000001', now() - interval '40 minutes'),
('60000000-0000-4000-8000-000000000004','10000000-0000-4000-8000-000000000004','d0000000-0000-4000-8000-000000000001', null),
('60000000-0000-4000-8000-000000000005','10000000-0000-4000-8000-000000000005','d0000000-0000-4000-8000-000000000001', null),
('60000000-0000-4000-8000-000000000006','10000000-0000-4000-8000-000000000006','d0000000-0000-4000-8000-000000000001', null),
('60000000-0000-4000-8000-000000000007','10000000-0000-4000-8000-000000000007','d0000000-0000-4000-8000-000000000001', now() - interval '28 hours'),
('60000000-0000-4000-8000-000000000008','10000000-0000-4000-8000-000000000008','d0000000-0000-4000-8000-000000000001', null),
('60000000-0000-4000-8000-000000000010','10000000-0000-4000-8000-000000000010','d0000000-0000-4000-8000-000000000001', now() - interval '25 minutes');

insert into public.rate_cards (id, organization_id, event_id, name, is_default) values
('70000000-0000-4000-8000-000000000001','d0000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000001','PMAE 2026 Standard Rates', true);

insert into public.service_rates (organization_id, rate_card_id, service_type, unit, rate, minimum_charge) values
('d0000000-0000-4000-8000-000000000001','70000000-0000-4000-8000-000000000001','inbound_delivery','per_cwt',98.50,197.00),
('d0000000-0000-4000-8000-000000000001','70000000-0000-4000-8000-000000000001','outbound_pickup','per_cwt',98.50,197.00),
('d0000000-0000-4000-8000-000000000001','70000000-0000-4000-8000-000000000001','empty_crate_return','per_piece',45.00,90.00),
('d0000000-0000-4000-8000-000000000001','70000000-0000-4000-8000-000000000001','storage_move','per_cwt',42.00,126.00),
('d0000000-0000-4000-8000-000000000001','70000000-0000-4000-8000-000000000001','equipment_lift','per_hour',165.00,165.00),
('d0000000-0000-4000-8000-000000000001','70000000-0000-4000-8000-000000000001','rigging_assist','per_hour',210.00,210.00);
