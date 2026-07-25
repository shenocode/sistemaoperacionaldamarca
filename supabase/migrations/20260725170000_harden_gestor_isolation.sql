-- Harden gestor isolation: remove blanket is_admin() shortcuts
-- that could let a gestor touch another gestor's client membership / activity.
-- Does NOT delete content.

-- Membership: only master or the client owner can manage members
drop policy if exists "Owners and admins can manage client membership" on public.client_members;
create policy "Owners and admin master can manage client membership"
  on public.client_members for all to authenticated
  using (public.is_admin_master() or public.is_client_owner(client_id))
  with check (public.is_admin_master() or public.is_client_owner(client_id));

-- Activity feed: gestores only see activity of clients they can access
drop policy if exists "Members can view activity" on public.activity_events;
create policy "Members can view activity"
  on public.activity_events for select to authenticated
  using (
    public.is_admin_master()
    or (client_id is not null and public.can_access_client(client_id))
  );

drop policy if exists "Authenticated members can insert activity" on public.activity_events;
create policy "Authenticated members can insert activity"
  on public.activity_events for insert to authenticated
  with check (
    actor_id = auth.uid()
    and (
      public.is_admin_master()
      or (client_id is not null and public.can_access_client(client_id))
    )
  );

-- Content access: master OR member; drafts only for managers/owners
create or replace function public.can_access_content(_content_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.content_items ci
    join public.projects p on p.id = ci.project_id
    where ci.id = _content_id
      and (
        public.is_admin_master()
        or public.is_client_member(p.client_id)
      )
      and (
        ci.status is distinct from 'draft'
        or public.can_manage_client(p.client_id)
      )
  )
$$;

-- Platform login helper: owner/master only (not every gestor)
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

  if not (public.is_admin_master() or public.can_manage_client(_client_id)) then
    raise exception 'not authorized';
  end if;

  select u.email into login_email
  from public.client_members cm
  join auth.users u on u.id = cm.user_id
  where cm.client_id = _client_id
    and cm.role = 'member'
  order by cm.created_at asc nulls last
  limit 1;

  return login_email;
end;
$$;
