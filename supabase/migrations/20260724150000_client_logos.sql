-- Client logo uploads: storage bucket + allow logo_url via update_client_contact

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'client-logos',
  'client-logos',
  true,
  2097152,
  array[
    'image/jpeg',
    'image/png',
    'image/gif',
    'image/webp',
    'image/svg+xml'
  ]
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- Path layout: {client_id}/{uuid}-{filename}
create or replace function public.client_logo_storage_client_id(object_name text)
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

revoke execute on function public.client_logo_storage_client_id(text) from public, anon;
grant execute on function public.client_logo_storage_client_id(text) to authenticated;

drop policy if exists "Members can view client logos" on storage.objects;
create policy "Members can view client logos"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'client-logos'
    and public.can_access_client(public.client_logo_storage_client_id(name))
  );

drop policy if exists "Public can view client logos" on storage.objects;
create policy "Public can view client logos"
  on storage.objects for select to public
  using (bucket_id = 'client-logos');

drop policy if exists "Members can upload client logos" on storage.objects;
create policy "Members can upload client logos"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'client-logos'
    and public.can_access_client(public.client_logo_storage_client_id(name))
  );

drop policy if exists "Members can update client logos" on storage.objects;
create policy "Members can update client logos"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'client-logos'
    and public.can_access_client(public.client_logo_storage_client_id(name))
  )
  with check (
    bucket_id = 'client-logos'
    and public.can_access_client(public.client_logo_storage_client_id(name))
  );

drop policy if exists "Members can delete client logos" on storage.objects;
create policy "Members can delete client logos"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'client-logos'
    and public.can_access_client(public.client_logo_storage_client_id(name))
  );

-- Extend contact RPC to persist logo_url (admins + client members)
drop function if exists public.update_client_contact(uuid, text, text, text, text, text, text);

create or replace function public.update_client_contact(
  _client_id uuid,
  _name text,
  _notes text default null,
  _email text default null,
  _phone text default null,
  _whatsapp text default null,
  _instagram text default null,
  _logo_url text default null
)
returns public.clients
language plpgsql
security definer
set search_path = public
as $$
declare
  actor uuid := auth.uid();
  result_row public.clients%rowtype;
begin
  if actor is null then
    raise exception 'not authenticated';
  end if;

  if not public.can_access_client(_client_id) then
    raise exception 'not allowed';
  end if;

  if nullif(trim(coalesce(_name, '')), '') is null then
    raise exception 'name is required';
  end if;

  update public.clients
  set
    name = trim(_name),
    notes = nullif(trim(coalesce(_notes, '')), ''),
    email = nullif(trim(coalesce(_email, '')), ''),
    phone = nullif(trim(coalesce(_phone, '')), ''),
    whatsapp = nullif(trim(coalesce(_whatsapp, '')), ''),
    instagram = nullif(trim(coalesce(_instagram, '')), ''),
    -- null keeps existing logo; empty string clears; otherwise sets URL
    logo_url = case
      when _logo_url is null then logo_url
      else nullif(trim(_logo_url), '')
    end,
    updated_at = now()
  where id = _client_id
  returning * into result_row;

  if not found then
    raise exception 'client not found';
  end if;

  return result_row;
end;
$$;

revoke execute on function public.update_client_contact(uuid, text, text, text, text, text, text, text)
  from public, anon;
grant execute on function public.update_client_contact(uuid, text, text, text, text, text, text, text)
  to authenticated;
