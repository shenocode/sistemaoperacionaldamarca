-- Scale: plan enforcement, billing events, AI quota, lighter portfolio queries,
-- atomic gestor versioning, and activity lookup by client.
-- Safe to re-run.

-- 0) Helpers: usable subscription (active/trialing, or past_due within 3-day grace)
create or replace function public.subscription_grants_access(_status text, _period_end timestamptz)
returns boolean
language sql
stable
as $$
  select
    _status in ('active', 'trialing')
    or (
      _status = 'past_due'
      and coalesce(_period_end, '-infinity'::timestamptz) > (now() - interval '3 days')
    )
$$;

revoke execute on function public.subscription_grants_access(text, timestamptz) from public, anon;
grant execute on function public.subscription_grants_access(text, timestamptz) to authenticated, service_role;

create or replace function public.active_subscription_plan(_user_id uuid default auth.uid())
returns public.subscription_plan
language sql
stable
security definer
set search_path = public
as $$
  select s.plan
  from public.subscriptions s
  where s.user_id = _user_id
    and public.subscription_grants_access(s.status, s.current_period_end)
  order by
    case when s.source = 'manual' then 0 else 1 end,
    s.updated_at desc
  limit 1
$$;

create or replace function public.is_team_owner()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    public.is_admin_master()
    or exists (
      select 1
      from public.subscriptions s
      where s.user_id = auth.uid()
        and public.subscription_grants_access(s.status, s.current_period_end)
    )
$$;

-- 1) Plan limits (keep in sync with src/lib/plan-entitlements.ts)
create or replace function public.plan_max_clients(_plan public.subscription_plan)
returns integer
language sql
immutable
as $$
  select case _plan
    when 'solo' then 1
    when 'studio' then 3
    when 'agency' then 5
    when 'courtesy' then null
    else 0
  end
$$;

create or replace function public.plan_max_users(_plan public.subscription_plan)
returns integer
language sql
immutable
as $$
  select case _plan
    when 'solo' then 1
    when 'studio' then 3
    when 'agency' then 10
    when 'courtesy' then null
    else 0
  end
$$;

revoke execute on function public.plan_max_clients(public.subscription_plan) from public, anon;
revoke execute on function public.plan_max_users(public.subscription_plan) from public, anon;
grant execute on function public.plan_max_clients(public.subscription_plan) to authenticated, service_role;
grant execute on function public.plan_max_users(public.subscription_plan) to authenticated, service_role;

create or replace function public.enforce_client_plan_limit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  owner uuid;
  plan public.subscription_plan;
  max_clients integer;
  used integer;
begin
  owner := coalesce(new.created_by, auth.uid());
  if owner is null then
    raise exception 'not authenticated';
  end if;

  if exists (
    select 1 from auth.users u
    where u.id = owner and lower(u.email) = 'sherocha03@gmail.com'
  ) then
    return new;
  end if;

  plan := public.active_subscription_plan(owner);
  if plan is null then
    raise exception 'Seu plano não permite criar clientes. Peça ao administrador para atribuir uma assinatura.';
  end if;

  max_clients := public.plan_max_clients(plan);
  if max_clients is null then
    return new;
  end if;

  select count(*)::integer into used
  from public.clients c
  where c.created_by = owner
    and (tg_op <> 'UPDATE' or c.id <> new.id);

  if used >= max_clients then
    raise exception 'Limite do plano atingido (% clientes). Atualize o plano para adicionar mais.', max_clients;
  end if;

  return new;
end;
$$;

drop trigger if exists clients_enforce_plan_limit on public.clients;
create trigger clients_enforce_plan_limit
  before insert on public.clients
  for each row execute function public.enforce_client_plan_limit();

create or replace function public.enforce_team_plan_limit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  plan public.subscription_plan;
  max_users integer;
  member_count integer;
begin
  if exists (
    select 1 from auth.users u
    where u.id = new.owner_user_id and lower(u.email) = 'sherocha03@gmail.com'
  ) then
    return new;
  end if;

  plan := public.active_subscription_plan(new.owner_user_id);
  if plan is null then
    raise exception 'Seu plano não permite gerenciar equipe.';
  end if;

  max_users := public.plan_max_users(plan);
  if max_users is null then
    return new;
  end if;
  if max_users <= 1 then
    raise exception 'Seu plano não permite gerenciar equipe.';
  end if;

  select count(*)::integer into member_count
  from public.team_memberships tm
  where tm.owner_user_id = new.owner_user_id
    and (tg_op <> 'UPDATE' or tm.id <> new.id);

  -- seats = owner (1) + existing members + this row
  if (1 + member_count + 1) > max_users then
    raise exception 'Limite de usuários do plano atingido (%).', max_users;
  end if;

  return new;
end;
$$;

drop trigger if exists team_memberships_enforce_plan_limit on public.team_memberships;
create trigger team_memberships_enforce_plan_limit
  before insert on public.team_memberships
  for each row execute function public.enforce_team_plan_limit();

-- 2) Lookup auth user by email (service role / definer; not granted to authenticated)
create or replace function public.auth_user_id_by_email(_email text)
returns uuid
language sql
stable
security definer
set search_path = auth, public
as $$
  select u.id
  from auth.users u
  where lower(u.email) = lower(trim(_email))
  limit 1
$$;

revoke all on function public.auth_user_id_by_email(text) from public, anon, authenticated;
grant execute on function public.auth_user_id_by_email(text) to service_role;

-- 3) Stripe event idempotency + rate limits + AI quota
create table if not exists public.stripe_webhook_events (
  id text primary key,
  event_type text not null,
  processed_at timestamptz not null default now()
);

alter table public.stripe_webhook_events enable row level security;
revoke all on table public.stripe_webhook_events from public, anon, authenticated;
grant all on table public.stripe_webhook_events to service_role;

create table if not exists public.edge_rate_limits (
  rate_key text primary key,
  window_started_at timestamptz not null default now(),
  hit_count integer not null default 0
);

alter table public.edge_rate_limits enable row level security;
revoke all on table public.edge_rate_limits from public, anon, authenticated;
grant all on table public.edge_rate_limits to service_role;

create or replace function public.consume_edge_rate_limit(
  _key text,
  _max_hits integer,
  _window_seconds integer
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  rec public.edge_rate_limits%rowtype;
  window_start timestamptz;
begin
  loop
    select * into rec
    from public.edge_rate_limits
    where rate_key = _key
    for update;

    if not found then
      begin
        insert into public.edge_rate_limits (rate_key, window_started_at, hit_count)
        values (_key, now(), 1);
        return true;
      exception
        when unique_violation then
          continue;
      end;
    end if;

    window_start := rec.window_started_at;
    if window_start <= now() - make_interval(secs => _window_seconds) then
      update public.edge_rate_limits
      set window_started_at = now(), hit_count = 1
      where rate_key = _key;
      return true;
    end if;

    if rec.hit_count >= _max_hits then
      return false;
    end if;

    update public.edge_rate_limits
    set hit_count = hit_count + 1
    where rate_key = _key;
    return true;
  end loop;
end;
$$;

revoke all on function public.consume_edge_rate_limit(text, integer, integer) from public, anon, authenticated;
grant execute on function public.consume_edge_rate_limit(text, integer, integer) to service_role;

create table if not exists public.ai_usage_daily (
  user_id uuid not null references auth.users (id) on delete cascade,
  usage_date date not null default ((timezone('utc', now()))::date),
  platform_units integer not null default 0,
  primary key (user_id, usage_date)
);

alter table public.ai_usage_daily enable row level security;
revoke all on table public.ai_usage_daily from public, anon, authenticated;
grant all on table public.ai_usage_daily to service_role;

create or replace function public.try_consume_platform_ai_quota(
  _user_id uuid,
  _units integer default 1,
  _daily_max integer default 40
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  current_units integer;
  day date := (timezone('utc', now()))::date;
begin
  if _user_id is null or _units < 1 then
    return false;
  end if;

  insert into public.ai_usage_daily (user_id, usage_date, platform_units)
  values (_user_id, day, 0)
  on conflict (user_id, usage_date) do nothing;

  select platform_units into current_units
  from public.ai_usage_daily
  where user_id = _user_id and usage_date = day
  for update;

  if current_units + _units > _daily_max then
    return false;
  end if;

  update public.ai_usage_daily
  set platform_units = platform_units + _units
  where user_id = _user_id and usage_date = day;

  return true;
end;
$$;

revoke all on function public.try_consume_platform_ai_quota(uuid, integer, integer) from public, anon, authenticated;
grant execute on function public.try_consume_platform_ai_quota(uuid, integer, integer) to service_role;

-- 4) Portfolio: bump project.updated_at when content changes (no nested content_items needed)
create or replace function public.touch_project_updated_at_from_content()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.projects
  set updated_at = now()
  where id = coalesce(new.project_id, old.project_id);
  return coalesce(new, old);
end;
$$;

drop trigger if exists content_items_touch_project on public.content_items;
create trigger content_items_touch_project
  after insert or update or delete on public.content_items
  for each row execute function public.touch_project_updated_at_from_content();

create index if not exists activity_events_client_id_created_at_idx
  on public.activity_events (client_id, created_at desc);

create or replace function public.latest_client_updates(_client_ids uuid[])
returns table (client_id uuid, created_at timestamptz)
language sql
stable
security definer
set search_path = public
as $$
  select distinct on (e.client_id)
    e.client_id,
    e.created_at
  from public.activity_events e
  where e.client_id = any (_client_ids)
    and public.can_access_client(e.client_id)
    and e.type in ('approved', 'changes_requested', 'comment_added', 'version_created')
    and e.actor_id is not null
    and not exists (
      select 1
      from public.user_roles ur
      where ur.user_id = e.actor_id
        and ur.role = 'admin'
    )
  order by e.client_id, e.created_at desc
$$;

revoke execute on function public.latest_client_updates(uuid[]) from public, anon;
grant execute on function public.latest_client_updates(uuid[]) to authenticated;

-- 5) Atomic gestor version save (FOR UPDATE)
create or replace function public.save_gestor_content_version(
  _content_id uuid,
  _patch jsonb,
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
  patch jsonb := coalesce(_patch, '{}'::jsonb);
begin
  if actor is null then
    raise exception 'not authenticated';
  end if;

  if not public.can_manage_content(_content_id) then
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
    title = case
      when patch ? 'title' then coalesce(nullif(trim(patch->>'title'), ''), current_row.title)
      else current_row.title
    end,
    caption = case when patch ? 'caption' then coalesce(patch->>'caption', '') else current_row.caption end,
    cta = case when patch ? 'cta' then coalesce(patch->>'cta', '') else current_row.cta end,
    hashtags = case when patch ? 'hashtags' then coalesce(patch->>'hashtags', '') else current_row.hashtags end,
    locucao = case when patch ? 'locucao' then coalesce(patch->>'locucao', '') else current_row.locucao end,
    roteiro = case when patch ? 'roteiro' then coalesce(patch->>'roteiro', '') else current_row.roteiro end,
    media_url = case
      when patch ? 'media_url' then nullif(trim(patch->>'media_url'), '')
      else current_row.media_url
    end,
    media_urls = case
      when patch ? 'media_urls' then coalesce(
        array(select jsonb_array_elements_text(patch->'media_urls')),
        '{}'::text[]
      )
      else current_row.media_urls
    end,
    thumbnail_url = case
      when patch ? 'thumbnail_url' then nullif(trim(patch->>'thumbnail_url'), '')
      else current_row.thumbnail_url
    end,
    format = case
      when patch ? 'format' then (patch->>'format')::public.content_format
      else current_row.format
    end,
    theme = case
      when patch ? 'theme' then nullif(trim(patch->>'theme'), '')
      else current_row.theme
    end,
    material_type = case
      when patch ? 'material_type' then nullif(trim(patch->>'material_type'), '')
      else current_row.material_type
    end,
    width_cm = case
      when patch ? 'width_cm' then (patch->>'width_cm')::numeric
      else current_row.width_cm
    end,
    height_cm = case
      when patch ? 'height_cm' then (patch->>'height_cm')::numeric
      else current_row.height_cm
    end,
    production_notes = case
      when patch ? 'production_notes' then coalesce(patch->>'production_notes', '')
      else current_row.production_notes
    end,
    status = case
      when patch ? 'status' then (patch->>'status')::public.content_status
      else current_row.status
    end,
    i18n = case when patch ? 'i18n' then patch->'i18n' else current_row.i18n end,
    media_overlays = case
      when patch ? 'media_overlays' then patch->'media_overlays'
      else current_row.media_overlays
    end,
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
    thumbnail_url,
    format,
    material_type,
    width_cm,
    height_cm,
    production_notes,
    change_note,
    created_by,
    i18n
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
    result_row.thumbnail_url,
    result_row.format,
    result_row.material_type,
    result_row.width_cm,
    result_row.height_cm,
    result_row.production_notes,
    note,
    actor,
    result_row.i18n
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

revoke execute on function public.save_gestor_content_version(uuid, jsonb, text) from public, anon;
grant execute on function public.save_gestor_content_version(uuid, jsonb, text) to authenticated;

notify pgrst, 'reload schema';
