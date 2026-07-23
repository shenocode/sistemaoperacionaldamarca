-- Allow client members (and admins) to review/update contact fields only.
-- Does not expose logo_url, access_token, or other system columns.

create or replace function public.update_client_contact(
  _client_id uuid,
  _name text,
  _notes text default null,
  _email text default null,
  _phone text default null,
  _whatsapp text default null,
  _instagram text default null
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
    updated_at = now()
  where id = _client_id
  returning * into result_row;

  if not found then
    raise exception 'client not found';
  end if;

  return result_row;
end;
$$;

revoke execute on function public.update_client_contact(uuid, text, text, text, text, text, text)
  from public, anon;
grant execute on function public.update_client_contact(uuid, text, text, text, text, text, text)
  to authenticated;
