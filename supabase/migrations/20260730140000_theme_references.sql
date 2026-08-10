-- Theme references: per-project theme briefs with recommendations and social links.

create table public.theme_references (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  theme text not null default '',
  recommendations text not null default '',
  links text[] not null default '{}',
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index theme_references_project_sort_idx
  on public.theme_references (project_id, sort_order asc, created_at desc);

create trigger theme_references_set_updated_at
  before update on public.theme_references
  for each row execute function public.set_updated_at();

grant select, insert, update, delete on public.theme_references to authenticated;
grant all on public.theme_references to service_role;

alter table public.theme_references enable row level security;

create policy "Members can view theme references"
  on public.theme_references for select to authenticated
  using (public.can_access_project(project_id));

create policy "Members can create theme references"
  on public.theme_references for insert to authenticated
  with check (
    exists (
      select 1 from public.projects p
      where p.id = project_id and public.can_access_client(p.client_id)
    )
  );

create policy "Members can update theme references"
  on public.theme_references for update to authenticated
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

create policy "Members can delete theme references"
  on public.theme_references for delete to authenticated
  using (
    exists (
      select 1 from public.projects p
      where p.id = project_id and public.can_access_client(p.client_id)
    )
  );
