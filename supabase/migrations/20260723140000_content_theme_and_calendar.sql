-- Temas reutilizáveis por projeto + campo tema no conteúdo (calendário)

alter table public.projects
  add column if not exists theme_presets text[] not null default '{}';

alter table public.content_items
  add column if not exists theme text;

create index if not exists content_items_scheduled_at_idx
  on public.content_items (scheduled_at);
