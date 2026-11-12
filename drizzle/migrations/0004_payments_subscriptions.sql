create table public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  organization_id uuid,
  stripe_subscription_id text not null unique,
  stripe_customer_id text not null,
  product_id text not null,
  price_id text not null,
  status text not null default 'active',
  current_period_start timestamptz,
  current_period_end timestamptz,
  cancel_at_period_end boolean default false,
  environment text not null default 'sandbox',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index idx_subscriptions_user_id on public.subscriptions(user_id);
create index idx_subscriptions_org_id on public.subscriptions(organization_id);
create index idx_subscriptions_stripe_id on public.subscriptions(stripe_subscription_id);

GRANT SELECT ON public.subscriptions TO authenticated;
GRANT ALL ON public.subscriptions TO service_role;

alter table public.subscriptions enable row level security;

create policy "Users can view own subscription"
  on public.subscriptions for select
  to authenticated
  using (auth.uid() = user_id);

create policy "Org admins can view org subscription"
  on public.subscriptions for select
  to authenticated
  using (organization_id is not null and public.is_org_admin(organization_id));

create policy "Service role can manage subscriptions"
  on public.subscriptions for all
  to service_role
  using (true)
  with check (true);

create or replace function public.has_active_subscription(user_uuid uuid, check_env text default 'live')
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.subscriptions
    where user_id = user_uuid
    and environment = check_env
    and (
      (status in ('active', 'trialing') and (current_period_end is null or current_period_end > now()))
      or (status = 'canceled' and current_period_end > now())
    )
  );
$$;

create or replace function public.org_has_active_subscription(_org uuid, check_env text default 'live')
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.subscriptions
    where organization_id = _org
    and environment = check_env
    and (
      (status in ('active', 'trialing') and (current_period_end is null or current_period_end > now()))
      or (status = 'canceled' and current_period_end > now())
    )
  );
$$;

GRANT EXECUTE ON FUNCTION public.has_active_subscription(uuid, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.org_has_active_subscription(uuid, text) TO authenticated, service_role;

create table public.sales_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  organization_id uuid,
  kind text not null check (kind in ('pilot', 'enterprise')),
  company_name text not null default '',
  contact_email text not null default '',
  message text not null default '',
  created_at timestamptz default now()
);

GRANT SELECT, INSERT ON public.sales_requests TO authenticated;
GRANT ALL ON public.sales_requests TO service_role;

alter table public.sales_requests enable row level security;

create policy "Users insert own sales requests"
  on public.sales_requests for insert
  to authenticated
  with check (auth.uid() = user_id);

create policy "Users view own sales requests"
  on public.sales_requests for select
  to authenticated
  using (auth.uid() = user_id);

create policy "Org staff view org sales requests"
  on public.sales_requests for select
  to authenticated
  using (organization_id is not null and public.is_org_staff(organization_id));