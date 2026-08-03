-- Artes gráficas: formato print_material + tipo de material e dimensões em cm.

alter type public.content_format add value if not exists 'print_material';

alter table public.content_items
  add column if not exists material_type text,
  add column if not exists width_cm numeric,
  add column if not exists height_cm numeric,
  add column if not exists production_notes text not null default '';

alter table public.content_versions
  add column if not exists material_type text,
  add column if not exists width_cm numeric,
  add column if not exists height_cm numeric,
  add column if not exists production_notes text not null default '';

create or replace function public.handle_content_created()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.content_versions (
    content_id,
    version_number,
    caption,
    cta,
    hashtags,
    locucao,
    roteiro,
    media_url,
    media_urls,
    format,
    material_type,
    width_cm,
    height_cm,
    production_notes,
    change_note,
    created_by
  ) values (
    new.id,
    1,
    new.caption,
    new.cta,
    new.hashtags,
    coalesce(new.locucao, ''),
    coalesce(new.roteiro, ''),
    new.media_url,
    coalesce(new.media_urls, '{}'),
    coalesce(new.format, 'static_feed'),
    new.material_type,
    new.width_cm,
    new.height_cm,
    coalesce(new.production_notes, ''),
    'Versão inicial',
    new.created_by
  );
  return new;
end;
$$;

notify pgrst, 'reload schema';
