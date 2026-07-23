-- Fix RLS failures when saving content with media upload (Salvar / Salvar nova versão).
-- Policies that join public.projects/content_items under the caller's RLS can
-- deny inserts even when can_manage_client() is true via RPC. Use security
-- definer helpers so permission checks are consistent.

-- Ensure media buckets exist (upload fails with RLS-like errors if misconfigured)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'content-media',
  'content-media',
  true,
  104857600,
  array[
    'image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml',
    'image/heic', 'image/heif', 'video/mp4', 'video/webm', 'video/quicktime',
    'video/x-msvideo', 'application/pdf', 'text/plain', 'text/csv', 'text/markdown',
    'application/rtf', 'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.oasis.opendocument.text', 'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.oasis.opendocument.spreadsheet'
  ]
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'library-assets',
  'library-assets',
  true,
  104857600,
  array[
    'image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml',
    'image/heic', 'image/heif', 'video/mp4', 'video/webm', 'video/quicktime',
    'video/x-msvideo', 'application/pdf', 'text/plain', 'text/csv', 'text/markdown',
    'application/rtf', 'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.oasis.opendocument.text', 'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.oasis.opendocument.spreadsheet'
  ]
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create or replace function public.can_manage_project(_project_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.projects p
    where p.id = _project_id
      and public.can_manage_client(p.client_id)
  )
$$;

create or replace function public.can_manage_content(_content_id uuid)
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
      and public.can_manage_client(p.client_id)
  )
$$;

revoke execute on function public.can_manage_project(uuid) from public, anon;
grant execute on function public.can_manage_project(uuid) to authenticated;

revoke execute on function public.can_manage_content(uuid) from public, anon;
grant execute on function public.can_manage_content(uuid) to authenticated;

revoke execute on function public.content_storage_project_id(text) from public, anon;
grant execute on function public.content_storage_project_id(text) to authenticated;

revoke execute on function public.library_storage_project_id(text) from public, anon;
grant execute on function public.library_storage_project_id(text) to authenticated;

-- content_versions: managers insert via security definer check
drop policy if exists "Managers can insert versions" on public.content_versions;
create policy "Managers can insert versions"
  on public.content_versions for insert to authenticated
  with check (public.can_manage_content(content_id));

-- content-media storage
drop policy if exists "Managers can upload content media" on storage.objects;
create policy "Managers can upload content media"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'content-media'
    and public.can_manage_project(public.content_storage_project_id(name))
  );

drop policy if exists "Managers can update content media" on storage.objects;
create policy "Managers can update content media"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'content-media'
    and public.can_manage_project(public.content_storage_project_id(name))
  )
  with check (
    bucket_id = 'content-media'
    and public.can_manage_project(public.content_storage_project_id(name))
  );

drop policy if exists "Managers can delete content media" on storage.objects;
create policy "Managers can delete content media"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'content-media'
    and public.can_manage_project(public.content_storage_project_id(name))
  );

-- library-assets storage (same pattern)
drop policy if exists "Managers can upload library files" on storage.objects;
create policy "Managers can upload library files"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'library-assets'
    and public.can_manage_project(public.library_storage_project_id(name))
  );

drop policy if exists "Managers can update library files" on storage.objects;
create policy "Managers can update library files"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'library-assets'
    and public.can_manage_project(public.library_storage_project_id(name))
  )
  with check (
    bucket_id = 'library-assets'
    and public.can_manage_project(public.library_storage_project_id(name))
  );

drop policy if exists "Managers can delete library files" on storage.objects;
create policy "Managers can delete library files"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'library-assets'
    and public.can_manage_project(public.library_storage_project_id(name))
  );
