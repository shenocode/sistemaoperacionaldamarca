-- Move library_assets and design_templates from project scope to client (brand) scope.
-- Storage paths: new uploads use {client_id}/…; legacy {project_id}/… remain readable.

-- —— library_assets ——

alter table public.library_assets
  add column if not exists client_id uuid references public.clients (id) on delete cascade;

update public.library_assets la
set client_id = p.client_id
from public.projects p
where p.id = la.project_id
  and la.client_id is null;

delete from public.library_assets where client_id is null;

alter table public.library_assets
  alter column client_id set not null;

alter table public.library_assets
  drop constraint if exists library_assets_project_id_fkey;

drop index if exists public.library_assets_project_id_idx;

alter table public.library_assets
  drop column if exists project_id;

create index if not exists library_assets_client_id_idx
  on public.library_assets (client_id);

drop policy if exists "Members can view library" on public.library_assets;
drop policy if exists "Managers can manage library" on public.library_assets;

create policy "Members can view library"
  on public.library_assets for select to authenticated
  using (public.can_access_client(client_id));

create policy "Managers can manage library"
  on public.library_assets for all to authenticated
  using (public.can_manage_client(client_id))
  with check (public.can_manage_client(client_id));

-- —— design_templates ——

alter table public.design_templates
  add column if not exists client_id uuid references public.clients (id) on delete cascade;

update public.design_templates dt
set client_id = p.client_id
from public.projects p
where p.id = dt.project_id
  and dt.client_id is null;

delete from public.design_templates where client_id is null;

alter table public.design_templates
  alter column client_id set not null;

alter table public.design_templates
  drop constraint if exists design_templates_project_id_fkey;

drop index if exists public.design_templates_project_id_idx;
drop index if exists public.design_templates_project_format_idx;

alter table public.design_templates
  drop column if exists project_id;

create index if not exists design_templates_client_id_idx
  on public.design_templates (client_id);

create index if not exists design_templates_client_format_idx
  on public.design_templates (client_id, format);

drop policy if exists "Members can view design templates" on public.design_templates;
drop policy if exists "Managers can manage design templates" on public.design_templates;

create policy "Members can view design templates"
  on public.design_templates for select to authenticated
  using (public.can_access_client(client_id));

create policy "Managers can manage design templates"
  on public.design_templates for all to authenticated
  using (public.can_manage_client(client_id))
  with check (public.can_manage_client(client_id));

-- —— storage: dual-path (client_id OR legacy project_id as first segment) ——

create or replace function public.library_storage_scope_id(object_name text)
returns uuid
language plpgsql
immutable
set search_path = public
as $$
begin
  return nullif(split_part(object_name, '/', 1), '')::uuid;
exception
  when invalid_text_representation then
    return null;
end;
$$;

-- Keep old helper name as alias for any leftover references
create or replace function public.library_storage_project_id(object_name text)
returns uuid
language sql
immutable
set search_path = public
as $$
  select public.library_storage_scope_id(object_name);
$$;

create or replace function public.can_access_library_storage(object_name text)
returns boolean
language sql
stable
set search_path = public
as $$
  select
    public.can_access_client(public.library_storage_scope_id(object_name))
    or public.can_access_project(public.library_storage_scope_id(object_name));
$$;

create or replace function public.can_manage_library_storage(object_name text)
returns boolean
language sql
stable
set search_path = public
as $$
  select
    public.can_manage_client(public.library_storage_scope_id(object_name))
    or public.can_manage_project(public.library_storage_scope_id(object_name));
$$;

revoke all on function public.library_storage_scope_id(text) from public, anon;
grant execute on function public.library_storage_scope_id(text) to authenticated;

revoke all on function public.can_access_library_storage(text) from public, anon;
grant execute on function public.can_access_library_storage(text) to authenticated;

revoke all on function public.can_manage_library_storage(text) from public, anon;
grant execute on function public.can_manage_library_storage(text) to authenticated;

drop policy if exists "Members can view library files" on storage.objects;
create policy "Members can view library files"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'library-assets'
    and public.can_access_library_storage(name)
  );

drop policy if exists "Managers can upload library files" on storage.objects;
create policy "Managers can upload library files"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'library-assets'
    and public.can_manage_library_storage(name)
  );

drop policy if exists "Managers can update library files" on storage.objects;
create policy "Managers can update library files"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'library-assets'
    and public.can_manage_library_storage(name)
  )
  with check (
    bucket_id = 'library-assets'
    and public.can_manage_library_storage(name)
  );

drop policy if exists "Managers can delete library files" on storage.objects;
create policy "Managers can delete library files"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'library-assets'
    and public.can_manage_library_storage(name)
  );
