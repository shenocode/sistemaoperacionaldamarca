-- WhatsApp / Open Graph share preview needs token-gated public access again.
-- A prior hardening migration revoked EXECUTE from anon/authenticated and
-- dropped public SELECT on client logos, which broke og:image for share links.

grant execute on function public.get_share_preview(uuid, uuid, uuid) to anon, authenticated;
grant execute on function public.get_share_preview(uuid, uuid, uuid) to service_role;

drop policy if exists "Public can view client logos" on storage.objects;
create policy "Public can view client logos"
  on storage.objects
  for select
  using (bucket_id = 'client-logos');
