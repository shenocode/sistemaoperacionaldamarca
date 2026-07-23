-- Library file uploads: extra categories, file metadata, and storage bucket

alter type public.library_category add value if not exists 'documents';
alter type public.library_category add value if not exists 'spreadsheets';

alter table public.library_assets
  add column if not exists storage_path text,
  add column if not exists mime_type text,
  add column if not exists file_size bigint,
  add column if not exists file_name text;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'library-assets',
  'library-assets',
  true,
  104857600,
  array[
    'image/jpeg',
    'image/png',
    'image/gif',
    'image/webp',
    'image/svg+xml',
    'image/heic',
    'image/heif',
    'video/mp4',
    'video/webm',
    'video/quicktime',
    'video/x-msvideo',
    'application/pdf',
    'text/plain',
    'text/csv',
    'text/markdown',
    'application/rtf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.oasis.opendocument.text',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.oasis.opendocument.spreadsheet'
  ]
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- Path layout: {project_id}/{uuid}-{filename}
create or replace function public.library_storage_project_id(object_name text)
returns uuid
language plpgsql
immutable
as $$
begin
  return nullif(split_part(object_name, '/', 1), '')::uuid;
exception
  when invalid_text_representation then
    return null;
end;
$$;

drop policy if exists "Members can view library files" on storage.objects;
create policy "Members can view library files"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'library-assets'
    and public.can_access_project(public.library_storage_project_id(name))
  );

drop policy if exists "Public can view library files" on storage.objects;
create policy "Public can view library files"
  on storage.objects for select to public
  using (bucket_id = 'library-assets');

drop policy if exists "Managers can upload library files" on storage.objects;
create policy "Managers can upload library files"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'library-assets'
    and exists (
      select 1 from public.projects p
      where p.id = public.library_storage_project_id(name)
        and public.can_manage_client(p.client_id)
    )
  );

drop policy if exists "Managers can update library files" on storage.objects;
create policy "Managers can update library files"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'library-assets'
    and exists (
      select 1 from public.projects p
      where p.id = public.library_storage_project_id(name)
        and public.can_manage_client(p.client_id)
    )
  )
  with check (
    bucket_id = 'library-assets'
    and exists (
      select 1 from public.projects p
      where p.id = public.library_storage_project_id(name)
        and public.can_manage_client(p.client_id)
    )
  );

drop policy if exists "Managers can delete library files" on storage.objects;
create policy "Managers can delete library files"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'library-assets'
    and exists (
      select 1 from public.projects p
      where p.id = public.library_storage_project_id(name)
        and public.can_manage_client(p.client_id)
    )
  );
