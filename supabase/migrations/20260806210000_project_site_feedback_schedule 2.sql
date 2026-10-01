-- Prototype feedback fields + editable schedule for Site projects.

alter table public.project_site
  add column if not exists prototype_notes text,
  add column if not exists prototype_change_requests text,
  add column if not exists schedule jsonb not null default '[]'::jsonb;

notify pgrst, 'reload schema';
