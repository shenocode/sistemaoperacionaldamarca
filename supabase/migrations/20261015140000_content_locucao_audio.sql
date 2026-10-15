-- Teleprompter voiceover: one audio file per content item, saved by the client.

alter table public.content_items
  add column if not exists locucao_audio_url text,
  add column if not exists locucao_audio_storage_path text;

comment on column public.content_items.locucao_audio_url is
  'Public URL of the voiceover recorded in the teleprompter.';
comment on column public.content_items.locucao_audio_storage_path is
  'Storage path of the teleprompter voiceover in the locucao-audio bucket.';

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'locucao-audio',
  'locucao-audio',
  true,
  52428800,
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
create or replace function public.locucao_audio_project_id(object_name text)
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

create or replace function public.locucao_audio_user_id(object_name text)
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

revoke execute on function public.locucao_audio_project_id(text) from public, anon;
grant execute on function public.locucao_audio_project_id(text) to authenticated;

revoke execute on function public.locucao_audio_user_id(text) from public, anon;
grant execute on function public.locucao_audio_user_id(text) to authenticated;

drop policy if exists "Members can view locucao audio" on storage.objects;
create policy "Members can view locucao audio"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'locucao-audio'
    and public.can_access_project(public.locucao_audio_project_id(name))
  );

drop policy if exists "Public can view locucao audio" on storage.objects;
create policy "Public can view locucao audio"
  on storage.objects for select to public
  using (bucket_id = 'locucao-audio');

drop policy if exists "Members can upload locucao audio" on storage.objects;
create policy "Members can upload locucao audio"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'locucao-audio'
    and public.can_access_project(public.locucao_audio_project_id(name))
    and public.locucao_audio_user_id(name) = auth.uid()
  );

drop policy if exists "Members can delete locucao audio" on storage.objects;
create policy "Members can delete locucao audio"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'locucao-audio'
    and public.can_access_project(public.locucao_audio_project_id(name))
  );

notify pgrst, 'reload schema';
