-- Gestor commercial profile fields + commercial proposals + storage buckets

-- —— Profiles: company / website / logo for proposal letterhead ——
alter table public.profiles
  add column if not exists company_name text,
  add column if not exists website text,
  add column if not exists logo_url text;

-- —— Gestor logos bucket ——
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'gestor-logos',
  'gestor-logos',
  true,
  2097152,
  array[
    'image/jpeg',
    'image/png',
    'image/gif',
    'image/webp',
    'image/svg+xml'
  ]
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- Path layout: {user_id}/{uuid}-{filename}
create or replace function public.gestor_logo_storage_user_id(object_name text)
returns uuid
language plpgsql
immutable
as $$
begin
  return nullif(split_part(object_name, '/', 1), '')::uuid;
exception
  when invalid_text_representation then
    return null;
end;
$$;

revoke execute on function public.gestor_logo_storage_user_id(text) from public, anon;
grant execute on function public.gestor_logo_storage_user_id(text) to authenticated;

drop policy if exists "Public can view gestor logos" on storage.objects;
create policy "Public can view gestor logos"
  on storage.objects for select to public
  using (bucket_id = 'gestor-logos');

drop policy if exists "Users can upload own gestor logo" on storage.objects;
create policy "Users can upload own gestor logo"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'gestor-logos'
    and public.gestor_logo_storage_user_id(name) = auth.uid()
  );

drop policy if exists "Users can update own gestor logo" on storage.objects;
create policy "Users can update own gestor logo"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'gestor-logos'
    and public.gestor_logo_storage_user_id(name) = auth.uid()
  )
  with check (
    bucket_id = 'gestor-logos'
    and public.gestor_logo_storage_user_id(name) = auth.uid()
  );

drop policy if exists "Users can delete own gestor logo" on storage.objects;
create policy "Users can delete own gestor logo"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'gestor-logos'
    and public.gestor_logo_storage_user_id(name) = auth.uid()
  );

-- —— Proposal covers bucket ——
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'proposal-covers',
  'proposal-covers',
  true,
  5242880,
  array[
    'image/jpeg',
    'image/png',
    'image/gif',
    'image/webp'
  ]
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- Path layout: {user_id}/{proposal_id}/{uuid}-{filename}
create or replace function public.proposal_cover_storage_user_id(object_name text)
returns uuid
language plpgsql
immutable
as $$
begin
  return nullif(split_part(object_name, '/', 1), '')::uuid;
exception
  when invalid_text_representation then
    return null;
end;
$$;

revoke execute on function public.proposal_cover_storage_user_id(text) from public, anon;
grant execute on function public.proposal_cover_storage_user_id(text) to authenticated;

drop policy if exists "Public can view proposal covers" on storage.objects;
create policy "Public can view proposal covers"
  on storage.objects for select to public
  using (bucket_id = 'proposal-covers');

drop policy if exists "Users can upload own proposal covers" on storage.objects;
create policy "Users can upload own proposal covers"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'proposal-covers'
    and public.proposal_cover_storage_user_id(name) = auth.uid()
    and public.is_admin()
  );

drop policy if exists "Users can update own proposal covers" on storage.objects;
create policy "Users can update own proposal covers"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'proposal-covers'
    and public.proposal_cover_storage_user_id(name) = auth.uid()
  )
  with check (
    bucket_id = 'proposal-covers'
    and public.proposal_cover_storage_user_id(name) = auth.uid()
  );

drop policy if exists "Users can delete own proposal covers" on storage.objects;
create policy "Users can delete own proposal covers"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'proposal-covers'
    and public.proposal_cover_storage_user_id(name) = auth.uid()
  );

-- —— Commercial proposals ——
do $$
begin
  if not exists (
    select 1 from pg_type t
    join pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'public' and t.typname = 'commercial_proposal_status'
  ) then
    create type public.commercial_proposal_status as enum ('draft', 'ready');
  end if;
end $$;

create table if not exists public.commercial_proposals (
  id uuid primary key default gen_random_uuid(),
  created_by uuid not null references auth.users(id) on delete cascade,
  client_id uuid not null references public.clients(id) on delete cascade,
  title text not null default 'PROPOSTA COMERCIAL',
  subtitle text not null default '',
  scope_summary text not null default '',
  proposal_month text not null default '',
  cover_image_url text,
  sections jsonb not null default '[]'::jsonb,
  investment_items jsonb not null default '[]'::jsonb,
  commercial_terms jsonb not null default '{}'::jsonb,
  status public.commercial_proposal_status not null default 'draft',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists commercial_proposals_created_by_idx
  on public.commercial_proposals (created_by, updated_at desc);

create index if not exists commercial_proposals_client_id_idx
  on public.commercial_proposals (client_id, updated_at desc);

drop trigger if exists commercial_proposals_set_updated_at on public.commercial_proposals;
create trigger commercial_proposals_set_updated_at
  before update on public.commercial_proposals
  for each row execute function public.set_updated_at();

alter table public.commercial_proposals enable row level security;

revoke all on table public.commercial_proposals from anon, public;
grant select, insert, update, delete on table public.commercial_proposals to authenticated;
grant all on table public.commercial_proposals to service_role;

-- Access: creator, admin master, or client team member (not every gestor via is_admin)
create or replace function public.can_access_commercial_proposal(_proposal_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.commercial_proposals cp
    where cp.id = _proposal_id
      and (
        public.is_admin_master()
        or cp.created_by = auth.uid()
        or public.is_client_member(cp.client_id)
      )
  )
$$;

revoke execute on function public.can_access_commercial_proposal(uuid) from public, anon;
grant execute on function public.can_access_commercial_proposal(uuid) to authenticated;

drop policy if exists "Gestores can view accessible proposals" on public.commercial_proposals;
create policy "Gestores can view accessible proposals"
  on public.commercial_proposals for select to authenticated
  using (
    public.is_admin_master()
    or created_by = auth.uid()
    or public.is_client_member(client_id)
  );

drop policy if exists "Admins can insert proposals" on public.commercial_proposals;
create policy "Admins can insert proposals"
  on public.commercial_proposals for insert to authenticated
  with check (
    public.is_admin()
    and created_by = auth.uid()
    and (
      public.is_admin_master()
      or public.is_client_member(client_id)
      or exists (
        select 1 from public.clients c
        where c.id = client_id and c.created_by = auth.uid()
      )
    )
  );

drop policy if exists "Gestores can update accessible proposals" on public.commercial_proposals;
create policy "Gestores can update accessible proposals"
  on public.commercial_proposals for update to authenticated
  using (
    public.is_admin_master()
    or created_by = auth.uid()
    or public.is_client_member(client_id)
  )
  with check (
    public.is_admin_master()
    or created_by = auth.uid()
    or public.is_client_member(client_id)
  );

drop policy if exists "Gestores can delete own proposals" on public.commercial_proposals;
create policy "Gestores can delete own proposals"
  on public.commercial_proposals for delete to authenticated
  using (
    public.is_admin_master()
    or created_by = auth.uid()
  );

notify pgrst, 'reload schema';
