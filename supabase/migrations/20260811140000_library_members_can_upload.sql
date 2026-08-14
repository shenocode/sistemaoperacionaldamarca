-- Allow any client member (cliente ou gestor com acesso) to add library files.
-- Templates, brand kit and deletes remain manager/owner-only.
-- Idempotent: safe to re-run if a previous attempt partially applied.

drop policy if exists "Managers can manage library" on public.library_assets;
drop policy if exists "Members can add library" on public.library_assets;
drop policy if exists "Managers can update library" on public.library_assets;
drop policy if exists "Managers can delete library" on public.library_assets;

create policy "Members can add library"
  on public.library_assets for insert to authenticated
  with check (public.can_access_client(client_id));

create policy "Managers can update library"
  on public.library_assets for update to authenticated
  using (public.can_manage_client(client_id))
  with check (public.can_manage_client(client_id));

create policy "Managers can delete library"
  on public.library_assets for delete to authenticated
  using (public.can_manage_client(client_id));

drop policy if exists "Managers can upload library files" on storage.objects;
drop policy if exists "Members can upload library files" on storage.objects;

create policy "Members can upload library files"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'library-assets'
    and public.can_access_library_storage(name)
  );
