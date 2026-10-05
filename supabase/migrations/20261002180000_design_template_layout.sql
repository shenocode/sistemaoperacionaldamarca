-- Templates de design em camadas: fundo limpo + layout de texto editável.
-- file_url continua sendo a prévia (pode ter tipografia); background_url é o fundo sem texto.

alter table public.design_templates
  add column if not exists background_url text,
  add column if not exists layout jsonb not null default '{}'::jsonb;

comment on column public.design_templates.background_url is
  'URL do fundo sem tipografia (camada de foto editável). Se null, usa file_url.';

comment on column public.design_templates.layout is
  'Projeto editável: { layers: MediaTextLayer[], adjustments?: MediaImageAdjustments }. Sem baseUrl.';

notify pgrst, 'reload schema';
