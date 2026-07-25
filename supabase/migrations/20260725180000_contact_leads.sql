-- Landing contact leads (trial / human support intents)

do $$
begin
  if not exists (
    select 1 from pg_type t
    join pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'public' and t.typname = 'contact_lead_intent'
  ) then
    create type public.contact_lead_intent as enum ('trial', 'human');
  end if;
end $$;

create table if not exists public.contact_leads (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  name text not null,
  email text not null,
  whatsapp text not null,
  intent public.contact_lead_intent not null,
  locale text,
  source text not null default 'landing'
);

create index if not exists contact_leads_created_at_idx
  on public.contact_leads (created_at desc);

alter table public.contact_leads enable row level security;

drop policy if exists "Admin master can read contact leads" on public.contact_leads;
create policy "Admin master can read contact leads"
  on public.contact_leads for select to authenticated
  using (public.is_admin_master());

-- Inserts go through the submit-contact-lead edge function (service role).
revoke all on table public.contact_leads from anon, public;
grant select on table public.contact_leads to authenticated;
grant all on table public.contact_leads to service_role;
