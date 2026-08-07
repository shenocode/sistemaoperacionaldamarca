-- Client website contact field + RPC for clients to view their gestor contact

alter table public.clients
  add column if not exists website text;

-- Extend contact RPC with website (admins + client members)
drop function if exists public.update_client_contact(uuid, text, text, text, text, text, text, text, jsonb, jsonb);

create or replace function public.update_client_contact(
  _client_id uuid,
  _name text,
  _notes text default null,
  _email text default null,
  _phone text default null,
  _whatsapp text default null,
  _instagram text default null,
  _website text default null,
  _logo_url text default null,
  _brand_colors jsonb default null,
  _brand_fonts jsonb default null
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
    website = nullif(trim(coalesce(_website, '')), ''),
    logo_url = case
      when _logo_url is null then logo_url
      else nullif(trim(_logo_url), '')
    end,
    brand_colors = case
      when _brand_colors is null then brand_colors
      else coalesce(_brand_colors, '[]'::jsonb)
    end,
    brand_fonts = case
      when _brand_fonts is null then brand_fonts
      else coalesce(_brand_fonts, '{}'::jsonb)
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

revoke execute on function public.update_client_contact(uuid, text, text, text, text, text, text, text, text, jsonb, jsonb)
  from public, anon;
grant execute on function public.update_client_contact(uuid, text, text, text, text, text, text, text, text, jsonb, jsonb)
  to authenticated;

-- Client (or any member with access) can read their gestor contact card
create or replace function public.get_client_gestor_contact(_client_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  actor uuid := auth.uid();
  created_by_id uuid;
  owner_ids uuid[];
  preferred_id uuid;
  result jsonb;
begin
  if actor is null then
    raise exception 'not authenticated';
  end if;

  if not public.can_access_client(_client_id) then
    raise exception 'not allowed';
  end if;

  select c.created_by into created_by_id
  from public.clients c
  where c.id = _client_id;

  if not found then
    raise exception 'client not found';
  end if;

  select coalesce(array_agg(cm.user_id), '{}'::uuid[])
  into owner_ids
  from public.client_members cm
  where cm.client_id = _client_id
    and cm.role = 'owner';

  preferred_id := case
    when created_by_id is not null and created_by_id = any (owner_ids) then created_by_id
    when created_by_id is not null then created_by_id
    when cardinality(owner_ids) >= 1 then owner_ids[1]
    else null
  end;

  if preferred_id is null then
    return null;
  end if;

  select jsonb_build_object(
    'userId', preferred_id,
    'fullName', nullif(trim(coalesce(p.full_name, '')), ''),
    'whatsapp', nullif(trim(coalesce(p.whatsapp, '')), ''),
    'website', nullif(trim(coalesce(p.website, '')), ''),
    'email', nullif(trim(coalesce(u.email, '')), '')
  )
  into result
  from auth.users u
  left join public.profiles p on p.id = u.id
  where u.id = preferred_id;

  return result;
end;
$$;

revoke execute on function public.get_client_gestor_contact(uuid) from public, anon;
grant execute on function public.get_client_gestor_contact(uuid) to authenticated;

notify pgrst, 'reload schema';
