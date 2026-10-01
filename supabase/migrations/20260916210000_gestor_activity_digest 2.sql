-- Digest de atividade da cliente para o gestor (e-mail a cada 30 min).
-- Eventos já existentes são marcados como enviados para não disparar histórico antigo.

create table if not exists public.activity_digest_receipts (
  activity_event_id uuid primary key references public.activity_events(id) on delete cascade,
  sent_at timestamptz not null default now()
);

create index if not exists activity_digest_receipts_sent_at_idx
  on public.activity_digest_receipts (sent_at desc);

alter table public.activity_digest_receipts enable row level security;
revoke all on table public.activity_digest_receipts from public, anon, authenticated;
grant all on table public.activity_digest_receipts to service_role;

create table if not exists public.gestor_digest_settings (
  id boolean primary key default true check (id),
  enabled boolean not null default true,
  function_url text not null
    default 'https://swhjyntcyxdgfcwbwcyi.supabase.co/functions/v1/send-gestor-digest',
  cron_secret text
);

alter table public.gestor_digest_settings enable row level security;
revoke all on table public.gestor_digest_settings from public, anon, authenticated;
grant all on table public.gestor_digest_settings to service_role;

insert into public.gestor_digest_settings (id, enabled)
values (true, true)
on conflict (id) do nothing;

insert into public.activity_digest_receipts (activity_event_id)
select e.id
from public.activity_events e
where e.type in (
  'approved'::public.activity_type,
  'changes_requested'::public.activity_type,
  'comment_added'::public.activity_type,
  'version_created'::public.activity_type
)
on conflict (activity_event_id) do nothing;

create or replace function public.list_pending_gestor_activity_digest()
returns table (
  event_id uuid,
  client_id uuid,
  client_name text,
  project_id uuid,
  project_name text,
  content_id uuid,
  content_title text,
  event_type public.activity_type,
  created_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select
    e.id,
    e.client_id,
    c.name,
    e.project_id,
    p.name,
    e.content_id,
    coalesce(nullif(trim(ci.title), ''), e.summary),
    e.type,
    e.created_at
  from public.activity_events e
  join public.clients c on c.id = e.client_id
  left join public.projects p on p.id = e.project_id
  left join public.content_items ci on ci.id = e.content_id
  join public.client_members cm
    on cm.client_id = e.client_id
   and cm.user_id = e.actor_id
   and cm.role = 'member'
  where e.client_id is not null
    and e.type in (
      'approved'::public.activity_type,
      'changes_requested'::public.activity_type,
      'comment_added'::public.activity_type,
      'version_created'::public.activity_type
    )
    and not exists (
      select 1
      from public.activity_digest_receipts r
      where r.activity_event_id = e.id
    )
  order by e.client_id, e.created_at;
$$;

revoke execute on function public.list_pending_gestor_activity_digest() from public, anon, authenticated;
grant execute on function public.list_pending_gestor_activity_digest() to service_role;

create or replace function public.list_client_gestor_emails(_client_id uuid)
returns table (
  user_id uuid,
  email text,
  full_name text
)
language sql
stable
security definer
set search_path = public
as $$
  select
    u.id,
    u.email::text,
    nullif(trim(coalesce(pr.full_name, '')), '')
  from public.client_members cm
  join auth.users u on u.id = cm.user_id
  left join public.profiles pr on pr.id = u.id
  where cm.client_id = _client_id
    and cm.role = 'owner'
    and u.email is not null
    and position('@' in u.email) > 1;
$$;

revoke execute on function public.list_client_gestor_emails(uuid) from public, anon, authenticated;
grant execute on function public.list_client_gestor_emails(uuid) to service_role;

create or replace function public.mark_gestor_activity_digest_sent(_event_ids uuid[])
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if _event_ids is null or cardinality(_event_ids) = 0 then
    return;
  end if;

  insert into public.activity_digest_receipts (activity_event_id)
  select distinct unnest(_event_ids)
  on conflict (activity_event_id) do nothing;
end;
$$;

revoke execute on function public.mark_gestor_activity_digest_sent(uuid[]) from public, anon, authenticated;
grant execute on function public.mark_gestor_activity_digest_sent(uuid[]) to service_role;

notify pgrst, 'reload schema';
