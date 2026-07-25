-- Tipo de projeto (um por cadastro): Instagram, artes gráficas ou vídeos.
-- Define abas, formatos e mockup disponíveis ao abrir o projeto.
alter table public.projects
  add column if not exists categories text[] not null default '{}';
