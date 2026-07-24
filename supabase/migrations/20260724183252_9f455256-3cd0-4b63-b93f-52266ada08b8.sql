create or replace function public.get_client_platform_login(_client_id uuid)
returns text
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  login_email text;
begin
  if auth.uid() is null then
    return null;
  end if;

  if not public.can_access_client(_client_id) then
    raise exception 'not allowed';
  end if;

  select u.email into login_email
  from public.client_members cm
  join auth.users u on u.id = cm.user_id
  where cm.client_id = _client_id
  order by cm.created_at asc nulls last
  limit 1;

  return login_email;
end;
$$;

revoke all on function public.get_client_platform_login(uuid) from public, anon;
grant execute on function public.get_client_platform_login(uuid) to authenticated;