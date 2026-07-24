-- Only the platform Administrador (master email) may manage user_roles.
-- Gestores (other admins) keep read access and client provisioning via is_admin().

create or replace function public.is_admin_master()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from auth.users u
    where u.id = auth.uid()
      and lower(u.email) = 'sherocha03@gmail.com'
      and public.has_role(auth.uid(), 'admin')
  );
$$;

revoke execute on function public.is_admin_master() from public, anon;
grant execute on function public.is_admin_master() to authenticated;

drop policy if exists "Admins can manage roles" on public.user_roles;

create policy "Admin master can manage roles"
  on public.user_roles for all to authenticated
  using (public.is_admin_master())
  with check (public.is_admin_master());
