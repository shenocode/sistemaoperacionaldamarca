-- Fix: INSERT ... RETURNING on clients fails RLS because the SELECT policy only
-- allows members, while membership is created in an AFTER INSERT trigger.
-- Allow the creator to read their own client row (needed for PostgREST .select()).

drop policy if exists "Members and admins can view clients" on public.clients;

create policy "Members and admins can view clients"
  on public.clients for select to authenticated
  using (
    public.can_access_client(id)
    or created_by = auth.uid()
  );

-- Also default created_by from the session so inserts remain valid even if the
-- client omits the column.
create or replace function public.set_client_created_by()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.created_by is null then
    new.created_by := auth.uid();
  end if;
  return new;
end;
$$;

drop trigger if exists clients_set_created_by on public.clients;

create trigger clients_set_created_by
  before insert on public.clients
  for each row execute function public.set_client_created_by();

revoke execute on function public.set_client_created_by() from public, anon, authenticated;
