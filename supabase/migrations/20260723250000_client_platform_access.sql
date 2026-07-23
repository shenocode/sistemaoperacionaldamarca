-- Helpers for admin-provisioned client platform login (auth.users + client_members).

create or replace function public.admin_get_user_id_by_email(_email text)
returns uuid
language sql
stable
security definer
set search_path = auth, public
as $$
  select id
  from auth.users
  where lower(email) = lower(trim(_email))
  limit 1;
$$;

revoke all on function public.admin_get_user_id_by_email(text) from public;
grant execute on function public.admin_get_user_id_by_email(text) to service_role;

create or replace function public.get_client_platform_login(_client_id uuid)
returns text
language plpgsql
stable
security definer
set search_path = auth, public
as $$
declare
  login_email text;
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;

  if not (public.is_admin() or public.can_manage_client(_client_id)) then
    raise exception 'not authorized';
  end if;

  select u.email into login_email
  from public.client_members cm
  join auth.users u on u.id = cm.user_id
  where cm.client_id = _client_id
    and cm.role = 'member'
  order by cm.created_at asc
  limit 1;

  return login_email;
end;
$$;

revoke all on function public.get_client_platform_login(uuid) from public;
grant execute on function public.get_client_platform_login(uuid) to authenticated;
