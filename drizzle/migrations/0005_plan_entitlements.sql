alter table public.subscriptions add column if not exists pending_price_id text, add column if not exists pending_change_at timestamptz;
alter table public.sales_requests add column if not exists status text not null default 'pending';

create table public.pilot_grants (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  sales_request_id uuid references public.sales_requests(id) on delete set null,
  starts_at timestamptz not null default now(),
  ends_at timestamptz not null default now() + interval '30 days',
  max_events integer not null default 1,
  granted_by uuid,
  created_at timestamptz not null default now()
);
GRANT SELECT ON public.pilot_grants TO authenticated;
GRANT ALL ON public.pilot_grants TO service_role;
alter table public.pilot_grants enable row level security;
create policy "Org members view own pilot" on public.pilot_grants for select to authenticated
  using (public.is_org_member(organization_id) or public.is_super_admin());

create policy "Super admins view sales requests" on public.sales_requests for select to authenticated using (public.is_super_admin());
GRANT UPDATE ON public.sales_requests TO authenticated;
create policy "Super admins update sales requests" on public.sales_requests for update to authenticated using (public.is_super_admin()) with check (public.is_super_admin());

-- What a company may do right now: plan, yearly event limit, source.
create or replace function public.org_entitlement(_org uuid)
returns table(plan text, event_limit integer, source text, ends_at timestamptz)
language sql stable security definer set search_path = public as $$
  with subs as (
    select split_part(s.price_id, '_', 1) as tier, s.current_period_end
    from public.subscriptions s
    where s.organization_id = _org
      and (
        (s.status in ('active','trialing') and (s.current_period_end is null or s.current_period_end > now()))
        or (s.status = 'past_due' and (s.current_period_end is null or s.current_period_end + interval '7 days' > now()))
        or (s.status = 'canceled' and s.current_period_end > now())
      )
  ), ranked as (
    select tier as plan,
      case tier when 'starter' then 3 when 'growth' then 10 when 'professional' then 25 else 0 end as event_limit,
      'subscription'::text as source, current_period_end as ends_at
    from subs
    union all
    select 'pilot', max_events, 'pilot', g.ends_at from public.pilot_grants g
    where g.organization_id = _org and now() between g.starts_at and g.ends_at
  )
  select plan, event_limit, source, ends_at from ranked order by event_limit desc limit 1
$$;
GRANT EXECUTE ON FUNCTION public.org_entitlement(uuid) TO authenticated, service_role;

create or replace function public.plan_gate_before_insert() returns trigger
language plpgsql security definer set search_path = public as $$
declare ent record; used integer;
begin
  if auth.uid() is null or public.is_super_admin() then return new; end if;
  select * into ent from public.org_entitlement(new.organization_id);
  if ent.plan is null then
    raise exception 'Your company has no active ExpoHaul plan. Choose a plan on the Plans & Billing page to add new records.' using errcode = 'P0001';
  end if;
  if tg_table_name = 'events' then
    select count(*) into used from public.events
      where organization_id = new.organization_id
        and extract(year from start_date) = extract(year from new.start_date);
    if used >= ent.event_limit then
      raise exception 'Your % plan allows % events per year and you have used them all for %. Upgrade on the Plans & Billing page.',
        initcap(ent.plan), ent.event_limit, extract(year from new.start_date)::int using errcode = 'P0001';
    end if;
  end if;
  return new;
end $$;

create trigger zz_plan_gate before insert on public.events for each row execute function public.plan_gate_before_insert();
create trigger zz_plan_gate before insert on public.exhibitors for each row execute function public.plan_gate_before_insert();
create trigger zz_plan_gate before insert on public.event_exhibitors for each row execute function public.plan_gate_before_insert();
create trigger zz_plan_gate before insert on public.freight_items for each row execute function public.plan_gate_before_insert();
create trigger zz_plan_gate before insert on public.tickets for each row execute function public.plan_gate_before_insert();
create trigger zz_plan_gate before insert on public.rate_cards for each row execute function public.plan_gate_before_insert();
create trigger zz_plan_gate before insert on public.service_rates for each row execute function public.plan_gate_before_insert();