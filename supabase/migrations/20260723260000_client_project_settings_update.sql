-- Allow client members (not only owners/admins) to update project settings
-- such as CTA, hashtag and theme presets.
drop policy if exists "Managers can update projects" on public.projects;

create policy "Members can update projects"
  on public.projects for update to authenticated
  using (public.can_access_client(client_id))
  with check (public.can_access_client(client_id));
