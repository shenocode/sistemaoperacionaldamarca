-- Allow authenticated users to update activity i18n for events they can see
-- (needed for locale backfill of the recent-activity feed).

drop policy if exists "Members can update activity i18n" on public.activity_events;
create policy "Members can update activity i18n"
  on public.activity_events for update to authenticated
  using (
    public.is_admin_master()
    or (client_id is not null and public.can_access_client(client_id))
  )
  with check (
    public.is_admin_master()
    or (client_id is not null and public.can_access_client(client_id))
  );

grant update on public.activity_events to authenticated;

notify pgrst, 'reload schema';
