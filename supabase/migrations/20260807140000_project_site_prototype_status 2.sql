-- Prototype review workflow status for Site projects.

alter table public.project_site
  add column if not exists prototype_status text not null default 'review'
    check (prototype_status in ('review', 'changes', 'changes_done', 'approved'));

notify pgrst, 'reload schema';
