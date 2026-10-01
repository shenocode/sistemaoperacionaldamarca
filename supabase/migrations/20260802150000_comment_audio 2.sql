-- Audio comments: store playable recordings without transcription.

ALTER TABLE public.content_comments
  ADD COLUMN IF NOT EXISTS audio_url text,
  ADD COLUMN IF NOT EXISTS audio_storage_path text;

ALTER TABLE public.content_comments
  ALTER COLUMN body SET DEFAULT '';

-- Allow empty body when an audio attachment is present.
ALTER TABLE public.content_comments
  DROP CONSTRAINT IF EXISTS content_comments_body_or_audio_chk;

ALTER TABLE public.content_comments
  ADD CONSTRAINT content_comments_body_or_audio_chk
  CHECK (
    length(trim(body)) > 0
    OR (audio_url is not null AND length(trim(audio_url)) > 0)
  );

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'comment-audio',
  'comment-audio',
  true,
  10485760, -- 10 MB
  array[
    'audio/webm',
    'audio/ogg',
    'audio/mp4',
    'audio/mpeg',
    'audio/wav',
    'audio/x-wav',
    'audio/aac',
    'audio/m4a'
  ]
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- Path: {projectId}/{contentId}/{userId}/{uuid}.ext
create or replace function public.comment_audio_project_id(object_name text)
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

create or replace function public.comment_audio_user_id(object_name text)
returns uuid
language plpgsql
immutable
set search_path = public
as $$
begin
  return nullif(split_part(object_name, '/', 3), '')::uuid;
exception
  when invalid_text_representation then
    return null;
end;
$$;

revoke execute on function public.comment_audio_project_id(text) from public, anon;
grant execute on function public.comment_audio_project_id(text) to authenticated;

revoke execute on function public.comment_audio_user_id(text) from public, anon;
grant execute on function public.comment_audio_user_id(text) to authenticated;

drop policy if exists "Members can view comment audio" on storage.objects;
create policy "Members can view comment audio"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'comment-audio'
    and public.can_access_project(public.comment_audio_project_id(name))
  );

drop policy if exists "Public can view comment audio" on storage.objects;
create policy "Public can view comment audio"
  on storage.objects for select to public
  using (bucket_id = 'comment-audio');

drop policy if exists "Members can upload comment audio" on storage.objects;
create policy "Members can upload comment audio"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'comment-audio'
    and public.can_access_project(public.comment_audio_project_id(name))
    and public.comment_audio_user_id(name) = auth.uid()
  );

drop policy if exists "Authors can delete own comment audio" on storage.objects;
create policy "Authors can delete own comment audio"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'comment-audio'
    and (
      public.comment_audio_user_id(name) = auth.uid()
      or public.can_manage_project(public.comment_audio_project_id(name))
    )
  );

notify pgrst, 'reload schema';
