-- Manual ordering for content items (calendar / feed list).
alter table public.content_items
  add column if not exists sort_order integer not null default 0;

with ordered as (
  select
    id,
    row_number() over (
      partition by project_id
      order by scheduled_at asc nulls last, title asc, created_at asc
    ) - 1 as rn
  from public.content_items
)
update public.content_items ci
set sort_order = ordered.rn
from ordered
where ci.id = ordered.id;

create index if not exists content_items_project_sort_order_idx
  on public.content_items (project_id, sort_order);
