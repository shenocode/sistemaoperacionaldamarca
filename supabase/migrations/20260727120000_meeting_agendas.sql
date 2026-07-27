-- Meeting agendas: per-project meeting history with topics (title + optional description).

alter type public.activity_type add value if not exists 'meeting_agenda_created';
alter type public.activity_type add value if not exists 'meeting_agenda_updated';
alter type public.activity_type add value if not exists 'meeting_agenda_deleted';

create table public.meeting_agendas (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  scheduled_at timestamptz,
  topics jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index meeting_agendas_project_scheduled_at_idx
  on public.meeting_agendas (project_id, scheduled_at desc nulls last);

create trigger meeting_agendas_set_updated_at
  before update on public.meeting_agendas
  for each row execute function public.set_updated_at();

grant select, insert, update, delete on public.meeting_agendas to authenticated;
grant all on public.meeting_agendas to service_role;

alter table public.meeting_agendas enable row level security;

create policy "Members can view meeting agendas"
  on public.meeting_agendas for select to authenticated
  using (public.can_access_project(project_id));

create policy "Members can create meeting agendas"
  on public.meeting_agendas for insert to authenticated
  with check (
    exists (
      select 1 from public.projects p
      where p.id = project_id and public.can_access_client(p.client_id)
    )
  );

create policy "Members can update meeting agendas"
  on public.meeting_agendas for update to authenticated
  using (
    exists (
      select 1 from public.projects p
      where p.id = project_id and public.can_access_client(p.client_id)
    )
  )
  with check (
    exists (
      select 1 from public.projects p
      where p.id = project_id and public.can_access_client(p.client_id)
    )
  );

create policy "Managers can delete meeting agendas"
  on public.meeting_agendas for delete to authenticated
  using (public.can_manage_project(project_id));
