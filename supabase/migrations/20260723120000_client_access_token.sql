-- Invite token on each client so WhatsApp review links can grant membership after auth.

alter table public.clients
  add column if not exists access_token uuid not null default gen_random_uuid();

create unique index if not exists clients_access_token_uidx
  on public.clients (access_token);

-- Prefer claim via RPC (token) over open self-insert into any client.
drop policy if exists "System can insert membership for self on create" on public.client_members;

create or replace function public.claim_client_access(_access_token uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  target_client_id uuid;
  actor uuid := auth.uid();
begin
  if actor is null then
    raise exception 'not authenticated';
  end if;

  if _access_token is null then
    raise exception 'invalid access token';
  end if;

  select id into target_client_id
  from public.clients
  where access_token = _access_token;

  if target_client_id is null then
    raise exception 'invalid access token';
  end if;

  -- Admins already have full access; no membership row required.
  if public.is_admin() then
    return target_client_id;
  end if;

  insert into public.client_members (client_id, user_id, role)
  values (target_client_id, actor, 'member')
  on conflict (client_id, user_id) do nothing;

  return target_client_id;
end;
$$;

revoke execute on function public.claim_client_access(uuid) from public, anon;
grant execute on function public.claim_client_access(uuid) to authenticated;
