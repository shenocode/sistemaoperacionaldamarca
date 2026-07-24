-- Brand kit (structured colors/fonts) + design templates library

alter table public.clients
  add column if not exists brand_colors jsonb not null default '[]'::jsonb,
  add column if not exists brand_fonts jsonb not null default '{}'::jsonb;

comment on column public.clients.brand_colors is
  'Brand color tokens: [{ "name": "Primária", "hex": "#1A1A1A" }, ...]';
comment on column public.clients.brand_fonts is
  'Brand fonts: { "primary": "...", "secondary": "...", "notes": "..." }';

create type public.design_template_format as enum ('static_feed', 'carousel');

create table public.design_templates (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  name text not null,
  format public.design_template_format not null,
  file_url text not null,
  storage_path text,
  mime_type text,
  file_size bigint,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users (id) on delete set null
);

create index design_templates_project_id_idx on public.design_templates (project_id);
create index design_templates_project_format_idx on public.design_templates (project_id, format);

grant select, insert, update, delete on public.design_templates to authenticated;
grant all on public.design_templates to service_role;
alter table public.design_templates enable row level security;

create policy "Members can view design templates"
  on public.design_templates for select to authenticated
  using (public.can_access_project(project_id));

create policy "Managers can manage design templates"
  on public.design_templates for all to authenticated
  using (
    exists (
      select 1 from public.projects p
      where p.id = project_id and public.can_manage_client(p.client_id)
    )
  )
  with check (
    exists (
      select 1 from public.projects p
      where p.id = project_id and public.can_manage_client(p.client_id)
    )
  );

-- Extend contact RPC to persist brand kit (admins + client members)
drop function if exists public.update_client_contact(uuid, text, text, text, text, text, text, text);

create or replace function public.update_client_contact(
  _client_id uuid,
  _name text,
  _notes text default null,
  _email text default null,
  _phone text default null,
  _whatsapp text default null,
  _instagram text default null,
  _logo_url text default null,
  _brand_colors jsonb default null,
  _brand_fonts jsonb default null
)
returns public.clients
language plpgsql
security definer
set search_path = public
as $$
declare
  actor uuid := auth.uid();
  result_row public.clients%rowtype;
begin
  if actor is null then
    raise exception 'not authenticated';
  end if;

  if not public.can_access_client(_client_id) then
    raise exception 'not allowed';
  end if;

  if nullif(trim(coalesce(_name, '')), '') is null then
    raise exception 'name is required';
  end if;

  update public.clients
  set
    name = trim(_name),
    notes = nullif(trim(coalesce(_notes, '')), ''),
    email = nullif(trim(coalesce(_email, '')), ''),
    phone = nullif(trim(coalesce(_phone, '')), ''),
    whatsapp = nullif(trim(coalesce(_whatsapp, '')), ''),
    instagram = nullif(trim(coalesce(_instagram, '')), ''),
    logo_url = case
      when _logo_url is null then logo_url
      else nullif(trim(_logo_url), '')
    end,
    brand_colors = case
      when _brand_colors is null then brand_colors
      else coalesce(_brand_colors, '[]'::jsonb)
    end,
    brand_fonts = case
      when _brand_fonts is null then brand_fonts
      else coalesce(_brand_fonts, '{}'::jsonb)
    end,
    updated_at = now()
  where id = _client_id
  returning * into result_row;

  if not found then
    raise exception 'client not found';
  end if;

  return result_row;
end;
$$;

revoke execute on function public.update_client_contact(uuid, text, text, text, text, text, text, text, jsonb, jsonb)
  from public, anon;
grant execute on function public.update_client_contact(uuid, text, text, text, text, text, text, text, jsonb, jsonb)
  to authenticated;
