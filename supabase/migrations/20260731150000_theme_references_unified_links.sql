-- Consolidate platform-specific link columns into a single links array.
-- Safe if the table was created with `links` already, or with youtube/instagram columns.

do $$
begin
  if to_regclass('public.theme_references') is null then
    return;
  end if;

  alter table public.theme_references
    add column if not exists links text[] not null default '{}';

  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'theme_references'
      and column_name = 'youtube_links'
  ) then
    update public.theme_references
    set links = (
      select coalesce(array_agg(link), '{}'::text[])
      from (
        select unnest(coalesce(youtube_links, '{}'::text[])) as link
        union all
        select unnest(coalesce(instagram_links, '{}'::text[])) as link
      ) merged
      where nullif(trim(link), '') is not null
    )
    where coalesce(array_length(links, 1), 0) = 0
      and (
        coalesce(array_length(youtube_links, 1), 0) > 0
        or coalesce(array_length(instagram_links, 1), 0) > 0
      );

    alter table public.theme_references drop column if exists youtube_links;
    alter table public.theme_references drop column if exists instagram_links;
  end if;
end $$;
