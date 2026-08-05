-- In-app help requests (gestor → platform admin master; client → owning gestor)

do $$
begin
  if not exists (
    select 1 from pg_type t
    join pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'public' and t.typname = 'help_request_kind'
  ) then
    create type public.help_request_kind as enum ('gestor_platform', 'client_gestor');
  end if;
end $$;

create table if not exists public.help_requests (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  kind public.help_request_kind not null,
  sender_user_id uuid not null references auth.users(id) on delete cascade,
  sender_email text not null,
  recipient_user_id uuid not null references auth.users(id) on delete cascade,
  client_id uuid references public.clients(id) on delete set null,
  message text not null,
  locale text,
  attachment_storage_path text,
  attachment_file_name text,
  attachment_mime_type text
);

create index if not exists help_requests_recipient_created_idx
  on public.help_requests (recipient_user_id, created_at desc);

create index if not exists help_requests_kind_created_idx
  on public.help_requests (kind, created_at desc);

alter table public.help_requests enable row level security;

drop policy if exists "Recipients can read help requests" on public.help_requests;
create policy "Recipients can read help requests"
  on public.help_requests for select to authenticated
  using (recipient_user_id = auth.uid());

drop policy if exists "Senders can read own help requests" on public.help_requests;
create policy "Senders can read own help requests"
  on public.help_requests for select to authenticated
  using (sender_user_id = auth.uid());

-- Inserts via edge function (service role). Attachments in private bucket.
revoke all on table public.help_requests from anon, public;
grant select on table public.help_requests to authenticated;
grant all on table public.help_requests to service_role;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'help-attachments',
  'help-attachments',
  false,
  10485760,
  array[
    'image/jpeg',
    'image/png',
    'image/gif',
    'image/webp',
    'image/heic',
    'image/heif',
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'text/plain'
  ]
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

notify pgrst, 'reload schema';
