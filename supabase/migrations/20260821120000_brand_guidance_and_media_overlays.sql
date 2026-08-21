-- Brand kit: persistent generation guidance + editable text overlays on content media.

alter table public.clients
  add column if not exists brand_guidance text;

comment on column public.clients.brand_guidance is
  'Regras gerais da marca injetadas em toda geração de texto e imagem.';

alter table public.content_items
  add column if not exists media_overlays jsonb not null default '[]'::jsonb;

comment on column public.content_items.media_overlays is
  'Camadas de texto editáveis alinhadas a media_urls (baseUrl + layers).';

drop function if exists public.update_client_contact(
  uuid, text, text, text, text, text, text, text, text, jsonb, jsonb
);

create or replace function public.update_client_contact(
  _client_id uuid,
  _name text,
  _notes text default null,
  _email text default null,
  _phone text default null,
  _whatsapp text default null,
  _instagram text default null,
  _website text default null,
  _logo_url text default null,
  _brand_colors jsonb default null,
  _brand_fonts jsonb default null,
  _brand_guidance text default null
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
    website = nullif(trim(coalesce(_website, '')), ''),
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
    brand_guidance = case
      when _brand_guidance is null then brand_guidance
      else nullif(trim(_brand_guidance), '')
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

revoke execute on function public.update_client_contact(
  uuid, text, text, text, text, text, text, text, text, jsonb, jsonb, text
) from public, anon;
grant execute on function public.update_client_contact(
  uuid, text, text, text, text, text, text, text, text, jsonb, jsonb, text
) to authenticated;

notify pgrst, 'reload schema';
