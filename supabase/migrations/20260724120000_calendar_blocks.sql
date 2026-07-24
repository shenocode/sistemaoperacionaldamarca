-- Blocos de calendário (períodos/meses) com título editável e itens vinculados.

create table if not exists public.calendar_blocks (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  title text not null default '',
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists calendar_blocks_project_sort_order_idx
  on public.calendar_blocks (project_id, sort_order);

create trigger calendar_blocks_set_updated_at
  before update on public.calendar_blocks
  for each row execute function public.set_updated_at();

grant select, insert, update, delete on public.calendar_blocks to authenticated;
grant all on public.calendar_blocks to service_role;

alter table public.calendar_blocks enable row level security;

create policy "Members can view calendar blocks"
  on public.calendar_blocks for select to authenticated
  using (public.can_access_project(project_id));

create policy "Members can create calendar blocks"
  on public.calendar_blocks for insert to authenticated
  with check (
    exists (
      select 1 from public.projects p
      where p.id = project_id and public.can_access_client(p.client_id)
    )
  );

create policy "Members can update calendar blocks"
  on public.calendar_blocks for update to authenticated
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

create policy "Managers can delete calendar blocks"
  on public.calendar_blocks for delete to authenticated
  using (public.can_manage_project(project_id));

alter table public.content_items
  add column if not exists calendar_block_id uuid references public.calendar_blocks(id) on delete set null;

create index if not exists content_items_calendar_block_id_idx
  on public.content_items (calendar_block_id);

-- Cria um bloco padrão por projeto que já tem conteúdos e associa os itens.
with projects_with_content as (
  select distinct project_id
  from public.content_items
),
inserted as (
  insert into public.calendar_blocks (project_id, title, sort_order)
  select pwc.project_id, '', 0
  from projects_with_content pwc
  where not exists (
    select 1 from public.calendar_blocks cb where cb.project_id = pwc.project_id
  )
  returning id, project_id
)
update public.content_items ci
set calendar_block_id = inserted.id
from inserted
where ci.project_id = inserted.project_id
  and ci.calendar_block_id is null;
