create table public.floor_plans (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  event_id uuid not null references public.events(id) on delete cascade,
  name text not null,
  storage_path text not null,
  mime_type text not null,
  created_by uuid,
  created_at timestamptz not null default now()
);
grant select on public.floor_plans to authenticated;
grant insert, update, delete on public.floor_plans to authenticated;
grant all on public.floor_plans to service_role;
alter table public.floor_plans enable row level security;
create policy "Staff view floor plans" on public.floor_plans for select to authenticated using (public.is_org_staff(organization_id));
create policy "Admins add floor plans" on public.floor_plans for insert to authenticated with check (public.is_org_admin(organization_id));
create policy "Admins update floor plans" on public.floor_plans for update to authenticated using (public.is_org_admin(organization_id));
create policy "Admins delete floor plans" on public.floor_plans for delete to authenticated using (public.is_org_admin(organization_id));

create table public.booth_markers (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  floor_plan_id uuid not null references public.floor_plans(id) on delete cascade,
  exhibitor_id uuid references public.exhibitors(id),
  booth_number text not null,
  hall text,
  x_pct numeric not null,
  y_pct numeric not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select on public.booth_markers to authenticated;
grant insert, update, delete on public.booth_markers to authenticated;
grant all on public.booth_markers to service_role;
alter table public.booth_markers enable row level security;
create policy "Staff view booth markers" on public.booth_markers for select to authenticated using (public.is_org_staff(organization_id));
create policy "Admins add booth markers" on public.booth_markers for insert to authenticated with check (public.is_org_admin(organization_id));
create policy "Admins update booth markers" on public.booth_markers for update to authenticated using (public.is_org_admin(organization_id));
create policy "Admins delete booth markers" on public.booth_markers for delete to authenticated using (public.is_org_admin(organization_id));

create or replace function public.floor_plans_before_insert()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  select e.organization_id into new.organization_id from public.events e where e.id = new.event_id;
  if new.organization_id is null then raise exception 'unknown event'; end if;
  new.created_by := auth.uid();
  return new;
end $$;
create trigger floor_plans_before_insert before insert on public.floor_plans for each row execute function public.floor_plans_before_insert();

create or replace function public.booth_markers_before_insert()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  select fp.organization_id into new.organization_id from public.floor_plans fp where fp.id = new.floor_plan_id;
  if new.organization_id is null then raise exception 'unknown floor plan'; end if;
  return new;
end $$;
create trigger booth_markers_before_insert before insert on public.booth_markers for each row execute function public.booth_markers_before_insert();
create trigger booth_markers_touch before update on public.booth_markers for each row execute function public.touch_updated_at();

create policy "Staff view floor plan files" on storage.objects for select to authenticated using (bucket_id = 'floor-plans' and public.is_org_staff(((storage.foldername(name))[1])::uuid));
create policy "Admins upload floor plan files" on storage.objects for insert to authenticated with check (bucket_id = 'floor-plans' and public.is_org_admin(((storage.foldername(name))[1])::uuid));
create policy "Admins delete floor plan files" on storage.objects for delete to authenticated using (bucket_id = 'floor-plans' and public.is_org_admin(((storage.foldername(name))[1])::uuid));

alter publication supabase_realtime add table public.booth_markers;