-- Roteiro de textos por slide para carrosséis (brief ao designer).

alter table public.content_items
  add column if not exists roteiro text not null default '';

alter table public.content_versions
  add column if not exists roteiro text not null default '';

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
    'Versão inicial',
    new.created_by
  );
  return new;
end;
$$;

create or replace function public.save_client_content_version(
  _content_id uuid,
  _caption text,
  _cta text,
  _hashtags text,
  _change_note text default null
)
returns public.content_items
language plpgsql
security definer
set search_path = public
as $$
declare
  current_row public.content_items%rowtype;
  next_version integer;
  actor uuid := auth.uid();
  note text;
  result_row public.content_items%rowtype;
begin
  if actor is null then
    raise exception 'not authenticated';
  end if;

  if not public.can_access_content(_content_id) then
    raise exception 'not allowed';
  end if;

  select * into current_row
  from public.content_items
  where id = _content_id
  for update;

  if not found then
    raise exception 'content not found';
  end if;

  next_version := current_row.current_version + 1;
  note := nullif(trim(coalesce(_change_note, '')), '');
  if note is null then
    note := format('Versão %s', next_version);
  end if;

  update public.content_items
  set
    caption = coalesce(_caption, ''),
    cta = coalesce(_cta, ''),
    hashtags = coalesce(_hashtags, ''),
    current_version = next_version,
    updated_at = now()
  where id = _content_id
  returning * into result_row;

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
    change_note,
    created_by
  ) values (
    _content_id,
    next_version,
    result_row.caption,
    result_row.cta,
    result_row.hashtags,
    result_row.locucao,
    result_row.roteiro,
    result_row.media_url,
    result_row.media_urls,
    result_row.format,
    note,
    actor
  );

  insert into public.activity_events (
    type,
    summary,
    client_id,
    project_id,
    content_id,
    actor_id
  )
  select
    'version_created'::public.activity_type,
    result_row.title || ' — v' || next_version,
    p.client_id,
    result_row.project_id,
    result_row.id,
    actor
  from public.projects p
  where p.id = result_row.project_id;

  return result_row;
end;
$$;

revoke execute on function public.save_client_content_version(uuid, text, text, text, text) from public, anon;
grant execute on function public.save_client_content_version(uuid, text, text, text, text) to authenticated;
