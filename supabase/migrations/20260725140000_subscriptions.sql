-- Stripe subscription billing for SOM plans (solo / studio / agency).

create type public.subscription_plan as enum ('solo', 'studio', 'agency');

create table public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users (id) on delete set null,
  email text not null,
  plan public.subscription_plan not null,
  status text not null default 'incomplete',
  stripe_customer_id text not null,
  stripe_subscription_id text not null,
  stripe_price_id text,
  current_period_end timestamptz,
  cancel_at_period_end boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint subscriptions_stripe_subscription_id_key unique (stripe_subscription_id)
);

create index subscriptions_user_id_idx on public.subscriptions (user_id);
create index subscriptions_email_lower_idx on public.subscriptions (lower(email));
create index subscriptions_stripe_customer_id_idx on public.subscriptions (stripe_customer_id);

grant select on public.subscriptions to authenticated;
grant all on public.subscriptions to service_role;

alter table public.subscriptions enable row level security;

create policy "Users can read own subscription"
  on public.subscriptions
  for select
  to authenticated
  using (auth.uid() = user_id or public.is_admin());

create or replace function public.set_subscriptions_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger subscriptions_set_updated_at
  before update on public.subscriptions
  for each row
  execute function public.set_subscriptions_updated_at();
