-- Content formats, multi-media URLs, and content media storage

create type public.content_format as enum (
  'static_feed',
  'reels',
  'stories',
  'carousel'
);

alter table public.content_items
  add column if not exists format public.content_format not null default 'static_feed',
  add column if not exists media_urls text[] not null default '{}';

alter table public.content_versions
  add column if not exists format public.content_format not null default 'static_feed',
  add column if not exists media_urls text[] not null default '{}';

-- Backfill media_urls from legacy media_url
update public.content_items
set media_urls = array[media_url]
where media_url is not null
  and media_url <> ''
  and (media_urls is null or cardinality(media_urls) = 0);

update public.content_versions
set media_urls = array[media_url]
where media_url is not null
  and media_url <> ''
  and (media_urls is null or cardinality(media_urls) = 0);

create or replace function public.handle_content_created()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.content_versions (
    content_id,
    version_number,
    caption,
    cta,
    hashtags,
    media_url,
    media_urls,
    format,
    change_note,
    created_by
  ) values (
    new.id,
    1,
    new.caption,
    new.cta,
    new.hashtags,
    new.media_url,
    coalesce(new.media_urls, '{}'),
    coalesce(new.format, 'static_feed'),
    'Versão inicial',
    new.created_by
  );
  return new;
end;
$$;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'content-media',
  'content-media',
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

create or replace function public.content_storage_project_id(object_name text)
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

drop policy if exists "Members can view content media" on storage.objects;
create policy "Members can view content media"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'content-media'
    and public.can_access_project(public.content_storage_project_id(name))
  );

drop policy if exists "Public can view content media" on storage.objects;
create policy "Public can view content media"
  on storage.objects for select to public
  using (bucket_id = 'content-media');

drop policy if exists "Managers can upload content media" on storage.objects;
create policy "Managers can upload content media"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'content-media'
    and exists (
      select 1 from public.projects p
      where p.id = public.content_storage_project_id(name)
        and public.can_manage_client(p.client_id)
    )
  );

drop policy if exists "Managers can update content media" on storage.objects;
create policy "Managers can update content media"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'content-media'
    and exists (
      select 1 from public.projects p
      where p.id = public.content_storage_project_id(name)
        and public.can_manage_client(p.client_id)
    )
  )
  with check (
    bucket_id = 'content-media'
    and exists (
      select 1 from public.projects p
      where p.id = public.content_storage_project_id(name)
        and public.can_manage_client(p.client_id)
    )
  );

drop policy if exists "Managers can delete content media" on storage.objects;
create policy "Managers can delete content media"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'content-media'
    and exists (
      select 1 from public.projects p
      where p.id = public.content_storage_project_id(name)
        and public.can_manage_client(p.client_id)
    )
  );
