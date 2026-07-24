-- Clients (non-managers) must not read content still "Em produção" (status = draft).
-- Managers/admins keep full access via can_manage_client().

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
      and (public.is_admin() or public.is_client_member(p.client_id))
      and (
        ci.status is distinct from 'draft'
        or public.can_manage_client(p.client_id)
      )
  )
$$;

drop policy if exists "Members can view content" on public.content_items;

create policy "Members can view content"
  on public.content_items for select to authenticated
  using (
    public.can_access_project(project_id)
    and (
      status is distinct from 'draft'
      or exists (
        select 1
        from public.projects p
        where p.id = project_id
          and public.can_manage_client(p.client_id)
      )
    )
  );
