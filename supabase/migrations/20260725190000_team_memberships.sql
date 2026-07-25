-- Team seats under a plan owner (Studio / Agency).
-- Collaborators inherit access only via client_members on assigned clients.

create table if not exists public.team_memberships (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  member_user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (owner_user_id, member_user_id),
  check (owner_user_id <> member_user_id)
);

create index if not exists team_memberships_owner_user_id_idx
  on public.team_memberships (owner_user_id);

create index if not exists team_memberships_member_user_id_idx
  on public.team_memberships (member_user_id);

alter table public.team_memberships enable row level security;

revoke all on table public.team_memberships from anon, public;
grant select, insert, update, delete on table public.team_memberships to authenticated;
grant all on table public.team_memberships to service_role;

drop policy if exists "Team owners manage their team" on public.team_memberships;
create policy "Team owners manage their team"
  on public.team_memberships for all to authenticated
  using (
    public.is_admin_master()
    or owner_user_id = auth.uid()
  )
  with check (
    public.is_admin_master()
    or owner_user_id = auth.uid()
  );

drop policy if exists "Team members can read own membership" on public.team_memberships;
create policy "Team members can read own membership"
  on public.team_memberships for select to authenticated
  using (
    public.is_admin_master()
    or member_user_id = auth.uid()
    or owner_user_id = auth.uid()
  );

-- True when the current user owns a team seat pool (has own active subscription
-- or is admin master). Used by app-layer checks; membership writes still go
-- through service role / owner policies.
create or replace function public.is_team_owner()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    public.is_admin_master()
    or exists (
      select 1
      from public.subscriptions s
      where s.user_id = auth.uid()
        and s.status in ('active', 'trialing')
    )
$$;

revoke execute on function public.is_team_owner() from public, anon;
grant execute on function public.is_team_owner() to authenticated;

-- If the caller is a team collaborator, return their plan owner; otherwise
-- return their own uid when they have an active subscription (or master).
create or replace function public.get_team_owner_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (
      select tm.owner_user_id
      from public.team_memberships tm
      where tm.member_user_id = auth.uid()
      order by tm.created_at asc
      limit 1
    ),
    case
      when public.is_admin_master() then auth.uid()
      when exists (
        select 1
        from public.subscriptions s
        where s.user_id = auth.uid()
          and s.status in ('active', 'trialing')
      ) then auth.uid()
      else null
    end
  )
$$;

revoke execute on function public.get_team_owner_id() from public, anon;
grant execute on function public.get_team_owner_id() to authenticated;
