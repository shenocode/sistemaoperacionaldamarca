-- Content approval workflow, versions, comments, and project management

-- Enums
create type public.content_status as enum (
  'draft',
  'review',
  'approved',
  'changes',
  'published'
);

create type public.client_member_role as enum ('owner', 'member');

create type public.library_category as enum (
  'brand',
  'pdfs',
  'images',
  'videos',
  'references'
);

create type public.activity_type as enum (
  'client_created',
  'project_created',
  'content_created',
  'content_updated',
  'version_created',
  'submitted_for_review',
  'approved',
  'changes_requested',
  'published',
  'comment_added'
);

-- Clients
create table public.clients (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  logo_url text,
  notes text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger clients_set_updated_at
  before update on public.clients
  for each row execute function public.set_updated_at();

grant select, insert, update, delete on public.clients to authenticated;
grant all on public.clients to service_role;
alter table public.clients enable row level security;

-- Client members
create table public.client_members (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.client_member_role not null default 'member',
  created_at timestamptz not null default now(),
  unique (client_id, user_id)
);

grant select, insert, update, delete on public.client_members to authenticated;
grant all on public.client_members to service_role;
alter table public.client_members enable row level security;

-- Projects
create table public.projects (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  name text not null,
  description text,
  status text not null default 'active' check (status in ('active', 'archived')),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index projects_client_id_idx on public.projects (client_id);

create trigger projects_set_updated_at
  before update on public.projects
  for each row execute function public.set_updated_at();

grant select, insert, update, delete on public.projects to authenticated;
grant all on public.projects to service_role;
alter table public.projects enable row level security;

-- Content items
create table public.content_items (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  title text not null,
  status public.content_status not null default 'draft',
  current_version integer not null default 1,
  caption text not null default '',
  cta text not null default '',
  hashtags text not null default '',
  media_url text,
  scheduled_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index content_items_project_id_idx on public.content_items (project_id);
create index content_items_status_idx on public.content_items (status);

create trigger content_items_set_updated_at
  before update on public.content_items
  for each row execute function public.set_updated_at();

grant select, insert, update, delete on public.content_items to authenticated;
grant all on public.content_items to service_role;
alter table public.content_items enable row level security;

-- Content versions (immutable snapshots)
create table public.content_versions (
  id uuid primary key default gen_random_uuid(),
  content_id uuid not null references public.content_items(id) on delete cascade,
  version_number integer not null,
  caption text not null default '',
  cta text not null default '',
  hashtags text not null default '',
  media_url text,
  change_note text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (content_id, version_number)
);

create index content_versions_content_id_idx on public.content_versions (content_id);

grant select, insert on public.content_versions to authenticated;
grant all on public.content_versions to service_role;
alter table public.content_versions enable row level security;

-- Comments
create table public.content_comments (
  id uuid primary key default gen_random_uuid(),
  content_id uuid not null references public.content_items(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  body text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index content_comments_content_id_idx on public.content_comments (content_id);

create trigger content_comments_set_updated_at
  before update on public.content_comments
  for each row execute function public.set_updated_at();

grant select, insert, update, delete on public.content_comments to authenticated;
grant all on public.content_comments to service_role;
alter table public.content_comments enable row level security;

-- Library assets
create table public.library_assets (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  name text not null,
  category public.library_category not null default 'references',
  file_url text,
  notes text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create index library_assets_project_id_idx on public.library_assets (project_id);

grant select, insert, update, delete on public.library_assets to authenticated;
grant all on public.library_assets to service_role;
alter table public.library_assets enable row level security;

-- Activity feed
create table public.activity_events (
  id uuid primary key default gen_random_uuid(),
  client_id uuid references public.clients(id) on delete cascade,
  project_id uuid references public.projects(id) on delete cascade,
  content_id uuid references public.content_items(id) on delete cascade,
  actor_id uuid references auth.users(id) on delete set null,
  type public.activity_type not null,
  summary text not null,
  created_at timestamptz not null default now()
);

create index activity_events_created_at_idx on public.activity_events (created_at desc);

grant select, insert on public.activity_events to authenticated;
grant all on public.activity_events to service_role;
alter table public.activity_events enable row level security;

-- Access helpers
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.has_role(auth.uid(), 'admin')
$$;

create or replace function public.is_client_member(_client_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.client_members
    where client_id = _client_id and user_id = auth.uid()
  )
$$;

create or replace function public.is_client_owner(_client_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.client_members
    where client_id = _client_id
      and user_id = auth.uid()
      and role = 'owner'
  )
$$;

create or replace function public.can_access_client(_client_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_admin() or public.is_client_member(_client_id)
$$;

create or replace function public.can_manage_client(_client_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_admin() or public.is_client_owner(_client_id)
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
      and (public.is_admin() or public.is_client_member(p.client_id))
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
      and (public.is_admin() or public.is_client_member(p.client_id))
  )
$$;

revoke execute on function public.is_admin() from public, anon;
grant execute on function public.is_admin() to authenticated;
revoke execute on function public.is_client_member(uuid) from public, anon;
grant execute on function public.is_client_member(uuid) to authenticated;
revoke execute on function public.is_client_owner(uuid) from public, anon;
grant execute on function public.is_client_owner(uuid) to authenticated;
revoke execute on function public.can_access_client(uuid) from public, anon;
grant execute on function public.can_access_client(uuid) to authenticated;
revoke execute on function public.can_manage_client(uuid) from public, anon;
grant execute on function public.can_manage_client(uuid) to authenticated;
revoke execute on function public.can_access_project(uuid) from public, anon;
grant execute on function public.can_access_project(uuid) to authenticated;
revoke execute on function public.can_access_content(uuid) from public, anon;
grant execute on function public.can_access_content(uuid) to authenticated;

-- Auto-add creator as owner when client is created
create or replace function public.handle_client_created()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.created_by is not null then
    insert into public.client_members (client_id, user_id, role)
    values (new.id, new.created_by, 'owner')
    on conflict do nothing;
  end if;
  return new;
end;
$$;

create trigger on_client_created
  after insert on public.clients
  for each row execute function public.handle_client_created();

revoke execute on function public.handle_client_created() from public, anon, authenticated;

-- Seed first version when content is created
create or replace function public.handle_content_created()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.content_versions (
    content_id, version_number, caption, cta, hashtags, media_url, change_note, created_by
  ) values (
    new.id, 1, new.caption, new.cta, new.hashtags, new.media_url, 'Versão inicial', new.created_by
  );
  return new;
end;
$$;

create trigger on_content_created
  after insert on public.content_items
  for each row execute function public.handle_content_created();

revoke execute on function public.handle_content_created() from public, anon, authenticated;

-- RLS policies

-- clients
create policy "Members and admins can view clients"
  on public.clients for select to authenticated
  using (public.can_access_client(id));

create policy "Authenticated users can create clients"
  on public.clients for insert to authenticated
  with check (created_by = auth.uid());

create policy "Owners and admins can update clients"
  on public.clients for update to authenticated
  using (public.can_manage_client(id)) with check (public.can_manage_client(id));

create policy "Owners and admins can delete clients"
  on public.clients for delete to authenticated
  using (public.can_manage_client(id));

-- client_members
create policy "Members can view client membership"
  on public.client_members for select to authenticated
  using (public.can_access_client(client_id) or user_id = auth.uid());

create policy "Owners and admins can manage client membership"
  on public.client_members for all to authenticated
  using (public.can_manage_client(client_id) or public.is_admin())
  with check (public.can_manage_client(client_id) or public.is_admin());

-- Allow trigger to insert owner membership on client create
create policy "System can insert membership for self on create"
  on public.client_members for insert to authenticated
  with check (user_id = auth.uid());

-- projects
create policy "Members can view projects"
  on public.projects for select to authenticated
  using (public.can_access_client(client_id));

create policy "Managers can create projects"
  on public.projects for insert to authenticated
  with check (public.can_manage_client(client_id));

create policy "Managers can update projects"
  on public.projects for update to authenticated
  using (public.can_manage_client(client_id)) with check (public.can_manage_client(client_id));

create policy "Managers can delete projects"
  on public.projects for delete to authenticated
  using (public.can_manage_client(client_id));

-- content_items
create policy "Members can view content"
  on public.content_items for select to authenticated
  using (public.can_access_project(project_id));

create policy "Managers can create content"
  on public.content_items for insert to authenticated
  with check (
    exists (
      select 1 from public.projects p
      where p.id = project_id and public.can_manage_client(p.client_id)
    )
  );

create policy "Members can update content"
  on public.content_items for update to authenticated
  using (public.can_access_project(project_id))
  with check (public.can_access_project(project_id));

create policy "Managers can delete content"
  on public.content_items for delete to authenticated
  using (
    exists (
      select 1 from public.projects p
      where p.id = project_id and public.can_manage_client(p.client_id)
    )
  );

-- content_versions
create policy "Members can view versions"
  on public.content_versions for select to authenticated
  using (public.can_access_content(content_id));

create policy "Managers can insert versions"
  on public.content_versions for insert to authenticated
  with check (
    exists (
      select 1
      from public.content_items ci
      join public.projects p on p.id = ci.project_id
      where ci.id = content_id and public.can_manage_client(p.client_id)
    )
  );

-- content_comments
create policy "Members can view comments"
  on public.content_comments for select to authenticated
  using (public.can_access_content(content_id));

create policy "Members can create comments"
  on public.content_comments for insert to authenticated
  with check (
    public.can_access_content(content_id)
    and user_id = auth.uid()
  );

create policy "Authors can update own comments"
  on public.content_comments for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "Authors or managers can delete comments"
  on public.content_comments for delete to authenticated
  using (
    user_id = auth.uid()
    or exists (
      select 1
      from public.content_items ci
      join public.projects p on p.id = ci.project_id
      where ci.id = content_id and public.can_manage_client(p.client_id)
    )
  );

-- library_assets
create policy "Members can view library"
  on public.library_assets for select to authenticated
  using (public.can_access_project(project_id));

create policy "Managers can manage library"
  on public.library_assets for all to authenticated
  using (
    exists (
      select 1 from public.projects p
      where p.id = project_id and public.can_manage_client(p.client_id)
    )
  )
  with check (
    exists (
      select 1 from public.projects p
      where p.id = project_id and public.can_manage_client(p.client_id)
    )
  );

-- activity_events
create policy "Members can view activity"
  on public.activity_events for select to authenticated
  using (
    public.is_admin()
    or (client_id is not null and public.can_access_client(client_id))
  );

create policy "Authenticated members can insert activity"
  on public.activity_events for insert to authenticated
  with check (
    actor_id = auth.uid()
    and (
      public.is_admin()
      or (client_id is not null and public.can_access_client(client_id))
    )
  );
