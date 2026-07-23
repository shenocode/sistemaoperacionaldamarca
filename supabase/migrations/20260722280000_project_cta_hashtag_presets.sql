-- Presets de CTA e hashtags por projeto (selecionáveis no formulário de conteúdo)
alter table public.projects
  add column if not exists cta_presets text[] not null default '{}',
  add column if not exists hashtag_presets text[] not null default '{}';
