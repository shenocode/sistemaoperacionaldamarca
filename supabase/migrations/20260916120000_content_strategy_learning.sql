-- Mix estratégico, funil, criadores de referência e aprendizado pós-publicação.

alter table public.calendar_blocks
  add column if not exists content_mix jsonb not null default '{"tofu":50,"mofu":30,"bofu":20}'::jsonb;

alter table public.content_items
  add column if not exists funnel_stage text,
  add column if not exists performance_reach text not null default '',
  add column if not exists performance_retention text not null default '',
  add column if not exists performance_note text not null default '',
  add column if not exists repeat_format boolean not null default false;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'content_items_funnel_stage_check'
  ) then
    alter table public.content_items
      add constraint content_items_funnel_stage_check
      check (funnel_stage is null or funnel_stage in ('tofu', 'mofu', 'bofu'));
  end if;
end
$$;

create index if not exists content_items_project_repeat_format_idx
  on public.content_items (project_id)
  where repeat_format is true;

create table if not exists public.brand_reference_creators (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients (id) on delete cascade,
  name text not null default '',
  url text not null default '',
  notes text not null default '',
  pattern_summary text not null default '',
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists brand_reference_creators_client_sort_idx
  on public.brand_reference_creators (client_id, sort_order asc, created_at desc);

drop trigger if exists brand_reference_creators_set_updated_at on public.brand_reference_creators;
create trigger brand_reference_creators_set_updated_at
  before update on public.brand_reference_creators
  for each row execute function public.set_updated_at();

grant select, insert, update, delete on public.brand_reference_creators to authenticated;
grant all on public.brand_reference_creators to service_role;

alter table public.brand_reference_creators enable row level security;

drop policy if exists "Members can view brand reference creators" on public.brand_reference_creators;
create policy "Members can view brand reference creators"
  on public.brand_reference_creators for select to authenticated
  using (public.can_access_client(client_id));

drop policy if exists "Members can create brand reference creators" on public.brand_reference_creators;
create policy "Members can create brand reference creators"
  on public.brand_reference_creators for insert to authenticated
  with check (public.can_access_client(client_id));

drop policy if exists "Members can update brand reference creators" on public.brand_reference_creators;
create policy "Members can update brand reference creators"
  on public.brand_reference_creators for update to authenticated
  using (public.can_access_client(client_id))
  with check (public.can_access_client(client_id));

drop policy if exists "Members can delete brand reference creators" on public.brand_reference_creators;
create policy "Members can delete brand reference creators"
  on public.brand_reference_creators for delete to authenticated
  using (public.can_access_client(client_id));

notify pgrst, 'reload schema';
