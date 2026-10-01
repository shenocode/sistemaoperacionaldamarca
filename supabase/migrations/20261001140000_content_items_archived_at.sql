-- Soft-archive for content items: keep drafts/unused posts without hard-deleting.
alter table public.content_items
  add column if not exists archived_at timestamptz null;

create index if not exists content_items_project_archived_at_idx
  on public.content_items (project_id, archived_at);

comment on column public.content_items.archived_at is
  'When set, the item is archived (hidden from active calendar periods; reusable later).';

notify pgrst, 'reload schema';
