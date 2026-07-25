-- 1) Remove public (anon-readable) SELECT policies on storage objects
DROP POLICY IF EXISTS "Public can view content media" ON storage.objects;
DROP POLICY IF EXISTS "Public can view library files" ON storage.objects;
DROP POLICY IF EXISTS "Public can view client logos" ON storage.objects;

-- 2) Pin search_path on functions missing it
ALTER FUNCTION public.content_storage_project_id(text) SET search_path = public;
ALTER FUNCTION public.library_storage_project_id(text) SET search_path = public;
ALTER FUNCTION public.client_logo_storage_client_id(text) SET search_path = public;
ALTER FUNCTION public.set_brand_briefings_updated_at() SET search_path = public;

-- 3) Revoke direct EXECUTE on functions that must not be called from the API
REVOKE ALL ON FUNCTION public.set_brand_briefings_updated_at() FROM anon, authenticated;
REVOKE ALL ON FUNCTION public.is_client_member(uuid) FROM anon, authenticated;
REVOKE ALL ON FUNCTION public.is_client_owner(uuid) FROM anon, authenticated;
REVOKE ALL ON FUNCTION public.get_share_preview(uuid, uuid, uuid) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_share_preview(uuid, uuid, uuid) TO service_role;