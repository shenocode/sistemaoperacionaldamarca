-- Contact leads: niche (agency / social_media / brand_owner)

do $$
begin
  if not exists (
    select 1 from pg_type t
    join pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'public' and t.typname = 'contact_lead_niche'
  ) then
    create type public.contact_lead_niche as enum ('agency', 'social_media', 'brand_owner');
  end if;
end $$;

alter table public.contact_leads
  add column if not exists niche public.contact_lead_niche;

-- Backfill any rows created before niche was required (rare / empty in practice).
update public.contact_leads
set niche = 'brand_owner'
where niche is null;

alter table public.contact_leads
  alter column niche set not null;
