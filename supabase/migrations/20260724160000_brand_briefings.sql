-- Brand briefings: per-client form answers + generated Guia de marca

create type public.brand_briefing_status as enum ('draft', 'in_progress', 'completed');

create table public.brand_briefings (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null unique references public.clients (id) on delete cascade,
  template jsonb not null default '{"title":"","objective":"","sections":[]}'::jsonb,
  answers jsonb not null default '{}'::jsonb,
  status public.brand_briefing_status not null default 'draft',
  guide jsonb,
  guide_markdown text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz
);

create index brand_briefings_client_id_idx on public.brand_briefings (client_id);

create or replace function public.set_brand_briefings_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger brand_briefings_set_updated_at
before update on public.brand_briefings
for each row
execute function public.set_brand_briefings_updated_at();

alter table public.brand_briefings enable row level security;

create policy "brand_briefings_select"
  on public.brand_briefings for select to authenticated
  using (public.can_access_client(client_id));

create policy "brand_briefings_insert"
  on public.brand_briefings for insert to authenticated
  with check (public.can_access_client(client_id));

create policy "brand_briefings_update"
  on public.brand_briefings for update to authenticated
  using (public.can_access_client(client_id))
  with check (public.can_access_client(client_id));

create policy "brand_briefings_delete"
  on public.brand_briefings for delete to authenticated
  using (public.can_manage_client(client_id));
