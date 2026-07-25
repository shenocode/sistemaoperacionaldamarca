-- SOM: subscriptions + courtesy + admin master + isolation
-- Safe to re-run. Does NOT delete client/gestor content.

-- 0) Admin master helper (required by policies below)
create or replace function public.is_admin_master()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from auth.users u
    where u.id = auth.uid()
      and lower(u.email) = 'sherocha03@gmail.com'
      and public.has_role(auth.uid(), 'admin')
  );
$$;

revoke execute on function public.is_admin_master() from public, anon;
grant execute on function public.is_admin_master() to authenticated;

drop policy if exists "Admins can manage roles" on public.user_roles;
drop policy if exists "Admin master can manage roles" on public.user_roles;
create policy "Admin master can manage roles"
  on public.user_roles for all to authenticated
  using (public.is_admin_master())
  with check (public.is_admin_master());

-- 1) Enum
do $$
begin
  if not exists (
    select 1 from pg_type t
    join pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'public' and t.typname = 'subscription_plan'
  ) then
    create type public.subscription_plan as enum ('solo', 'studio', 'agency', 'courtesy');
  else
    begin
      alter type public.subscription_plan add value if not exists 'courtesy';
    exception
      when duplicate_object then null;
    end;
  end if;
end $$;

-- 2) Table
create table if not exists public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users (id) on delete set null,
  email text not null,
  plan public.subscription_plan not null,
  status text not null default 'incomplete',
  source text not null default 'stripe',
  stripe_customer_id text,
  stripe_subscription_id text,
  stripe_price_id text,
  current_period_end timestamptz,
  cancel_at_period_end boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.subscriptions
  alter column stripe_customer_id drop not null;

alter table public.subscriptions
  alter column stripe_subscription_id drop not null;

alter table public.subscriptions
  add column if not exists source text not null default 'stripe';

alter table public.subscriptions
  drop constraint if exists subscriptions_source_check;

alter table public.subscriptions
  add constraint subscriptions_source_check
  check (source in ('stripe', 'manual'));

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'subscriptions_stripe_subscription_id_key'
  ) then
    alter table public.subscriptions
      add constraint subscriptions_stripe_subscription_id_key
      unique (stripe_subscription_id);
  end if;
end $$;

create unique index if not exists subscriptions_manual_user_uidx
  on public.subscriptions (user_id)
  where source = 'manual' and user_id is not null;

create index if not exists subscriptions_user_id_idx
  on public.subscriptions (user_id);

create index if not exists subscriptions_email_lower_idx
  on public.subscriptions (lower(email));

create index if not exists subscriptions_stripe_customer_id_idx
  on public.subscriptions (stripe_customer_id);

grant select on public.subscriptions to authenticated;
grant insert, update, delete on public.subscriptions to authenticated;
grant all on public.subscriptions to service_role;

alter table public.subscriptions enable row level security;

drop policy if exists "Users can read own subscription" on public.subscriptions;
create policy "Users can read own subscription"
  on public.subscriptions
  for select
  to authenticated
  using (auth.uid() = user_id or public.is_admin());

drop policy if exists "Admin master can manage subscriptions" on public.subscriptions;
create policy "Admin master can manage subscriptions"
  on public.subscriptions
  for all
  to authenticated
  using (public.is_admin_master())
  with check (public.is_admin_master());

create or replace function public.set_subscriptions_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists subscriptions_set_updated_at on public.subscriptions;
create trigger subscriptions_set_updated_at
  before update on public.subscriptions
  for each row
  execute function public.set_subscriptions_updated_at();

create or replace function public.active_subscription_plan(_user_id uuid default auth.uid())
returns public.subscription_plan
language sql
stable
security definer
set search_path = public
as $$
  select s.plan
  from public.subscriptions s
  where s.user_id = _user_id
    and s.status in ('active', 'trialing')
  order by
    case when s.source = 'manual' then 0 else 1 end,
    s.updated_at desc
  limit 1
$$;

revoke execute on function public.active_subscription_plan(uuid) from public, anon;
grant execute on function public.active_subscription_plan(uuid) to authenticated;

create or replace function public.can_access_client(_client_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_admin_master() or public.is_client_member(_client_id)
$$;

create or replace function public.can_manage_client(_client_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_admin_master() or public.is_client_owner(_client_id)
$$;

create or replace function public.can_access_project(_project_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.projects p
    where p.id = _project_id
      and (
        public.is_admin_master()
        or public.is_client_member(p.client_id)
      )
  )
$$;

create or replace function public.can_access_content(_content_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.content_items ci
    join public.projects p on p.id = ci.project_id
    where ci.id = _content_id
      and (
        public.is_admin_master()
        or public.is_client_member(p.client_id)
      )
  )
$$;
