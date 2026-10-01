-- Fix: is_client_member() is revoked from authenticated (see 20260725130550).
-- RLS must use can_access_client() (security definer) instead.

create or replace function public.can_access_commercial_proposal(_proposal_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.commercial_proposals cp
    where cp.id = _proposal_id
      and (
        public.is_admin_master()
        or cp.created_by = auth.uid()
        or public.can_access_client(cp.client_id)
      )
  )
$$;

revoke execute on function public.can_access_commercial_proposal(uuid) from public, anon;
grant execute on function public.can_access_commercial_proposal(uuid) to authenticated;

drop policy if exists "Gestores can view accessible proposals" on public.commercial_proposals;
create policy "Gestores can view accessible proposals"
  on public.commercial_proposals for select to authenticated
  using (
    public.is_admin_master()
    or created_by = auth.uid()
    or public.can_access_client(client_id)
  );

drop policy if exists "Admins can insert proposals" on public.commercial_proposals;
create policy "Admins can insert proposals"
  on public.commercial_proposals for insert to authenticated
  with check (
    public.is_admin()
    and created_by = auth.uid()
    and (
      public.is_admin_master()
      or public.can_access_client(client_id)
      or exists (
        select 1 from public.clients c
        where c.id = client_id and c.created_by = auth.uid()
      )
    )
  );

drop policy if exists "Gestores can update accessible proposals" on public.commercial_proposals;
create policy "Gestores can update accessible proposals"
  on public.commercial_proposals for update to authenticated
  using (
    public.is_admin_master()
    or created_by = auth.uid()
    or public.can_access_client(client_id)
  )
  with check (
    public.is_admin_master()
    or created_by = auth.uid()
    or public.can_access_client(client_id)
  );

notify pgrst, 'reload schema';
