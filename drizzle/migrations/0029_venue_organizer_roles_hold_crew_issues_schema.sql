alter type public.app_role add value if not exists 'venue';
alter type public.app_role add value if not exists 'organizer';
alter table public.user_roles add column if not exists event_id uuid references public.events(id) on delete cascade;
alter table public.invitations add column if not exists event_id uuid references public.events(id) on delete cascade;
alter table public.tickets add column if not exists held_at timestamptz, add column if not exists hold_reason text, add column if not exists held_by uuid;
alter table public.ticket_crew add column if not exists equipment_id uuid references public.equipment(id);
create unique index if not exists ticket_crew_ticket_equipment_uq on public.ticket_crew(ticket_id, equipment_id) where equipment_id is not null;

create table if not exists public.freight_issues (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  freight_id uuid not null references public.freight_items(id) on delete cascade,
  event_id uuid references public.events(id) on delete cascade,
  kind text not null check (kind in ('damaged','wet','missing_pieces','wrong_booth','other')),
  note text,
  photo_path text,
  created_by uuid,
  created_at timestamptz not null default now(),
  resolved_at timestamptz,
  resolved_by uuid
);
grant select, insert, update on public.freight_issues to authenticated;
grant all on public.freight_issues to service_role;
alter table public.freight_issues enable row level security;

create or replace function public.freight_issues_before_insert() returns trigger language plpgsql security definer set search_path to 'public' as $$
begin
  select organization_id, event_id into new.organization_id, new.event_id from public.freight_items where id=new.freight_id;
  if new.organization_id is null then raise exception 'Freight not found'; end if;
  if not (public.is_org_staff(new.organization_id) or public.has_org_role(new.organization_id,'operator')) then
    raise exception 'Only company staff and drivers can report freight issues'; end if;
  if new.photo_path is not null and split_part(new.photo_path,'/',1) <> new.organization_id::text then raise exception 'Invalid photo path'; end if;
  new.created_by:=auth.uid(); new.created_at:=now(); new.resolved_at:=null; new.resolved_by:=null;
  perform public.log_activity(new.organization_id,'freight_issue_reported',null,new.freight_id,new.event_id,jsonb_build_object('kind',new.kind,'note',new.note));
  return new;
end $$;
create trigger freight_issues_before_insert before insert on public.freight_issues for each row execute function public.freight_issues_before_insert();

create or replace function public.freight_issues_before_update() returns trigger language plpgsql security definer set search_path to 'public' as $$
begin
  if not public.is_org_staff(old.organization_id) then raise exception 'Only staff can resolve issues'; end if;
  new.id:=old.id; new.organization_id:=old.organization_id; new.freight_id:=old.freight_id; new.event_id:=old.event_id;
  new.kind:=old.kind; new.note:=old.note; new.photo_path:=old.photo_path; new.created_by:=old.created_by; new.created_at:=old.created_at;
  if new.resolved_at is not null and old.resolved_at is null then new.resolved_at:=now(); new.resolved_by:=auth.uid();
    perform public.log_activity(old.organization_id,'freight_issue_resolved',null,old.freight_id,old.event_id,jsonb_build_object('kind',old.kind));
  end if;
  return new;
end $$;
create trigger freight_issues_before_update before update on public.freight_issues for each row execute function public.freight_issues_before_update();

create policy "freight issues view" on public.freight_issues for select to authenticated
  using (public.is_org_staff(organization_id) or public.has_org_role(organization_id,'operator'));
create policy "freight issues report" on public.freight_issues for insert to authenticated
  with check (public.is_org_staff(organization_id) or public.has_org_role(organization_id,'operator'));
create policy "freight issues resolve" on public.freight_issues for update to authenticated
  using (public.is_org_staff(organization_id)) with check (public.is_org_staff(organization_id));

create policy "Freight issue photos view" on storage.objects for select to authenticated
  using (bucket_id='freight-issue-photos' and (public.is_org_staff(((storage.foldername(name))[1])::uuid) or public.has_org_role(((storage.foldername(name))[1])::uuid,'operator')));
create policy "Freight issue photos upload" on storage.objects for insert to authenticated
  with check (bucket_id='freight-issue-photos' and (public.is_org_staff(((storage.foldername(name))[1])::uuid) or public.has_org_role(((storage.foldername(name))[1])::uuid,'operator')));