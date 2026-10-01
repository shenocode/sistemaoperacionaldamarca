-- Site project workspace: prototype URL, briefing answers, manager notes, PRD.

create table public.project_site (
  project_id uuid primary key references public.projects (id) on delete cascade,
  prototype_url text,
  briefing_template jsonb not null default '{"title":"","objective":"","sections":[]}'::jsonb,
  briefing_answers jsonb not null default '{}'::jsonb,
  manager_notes text,
  briefing_status text not null default 'draft'
    check (briefing_status in ('draft', 'in_progress', 'completed')),
  prd_markdown text,
  prd_generated_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger project_site_set_updated_at
  before update on public.project_site
  for each row execute function public.set_updated_at();

grant select, insert, update, delete on public.project_site to authenticated;
grant all on public.project_site to service_role;

alter table public.project_site enable row level security;

create policy "Members can view project site"
  on public.project_site for select to authenticated
  using (public.can_access_project(project_id));

create policy "Members can create project site"
  on public.project_site for insert to authenticated
  with check (
    exists (
      select 1 from public.projects p
      where p.id = project_id and public.can_access_client(p.client_id)
    )
  );

create policy "Members can update project site"
  on public.project_site for update to authenticated
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

create policy "Managers can delete project site"
  on public.project_site for delete to authenticated
  using (public.can_manage_project(project_id));

notify pgrst, 'reload schema';
