-- Public share preview for WhatsApp/Open Graph: expose only name + logo when token is valid.

create or replace function public.get_share_preview(
  _access_token uuid,
  _client_id uuid,
  _project_id uuid
)
returns table (
  client_id uuid,
  client_name text,
  logo_url text,
  project_id uuid,
  project_name text
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if _access_token is null or _client_id is null or _project_id is null then
    return;
  end if;

  return query
  select
    c.id,
    c.name,
    c.logo_url,
    p.id,
    p.name
  from public.clients c
  inner join public.projects p on p.client_id = c.id
  where c.access_token = _access_token
    and c.id = _client_id
    and p.id = _project_id;
end;
$$;

revoke all on function public.get_share_preview(uuid, uuid, uuid) from public;
grant execute on function public.get_share_preview(uuid, uuid, uuid) to anon, authenticated;
