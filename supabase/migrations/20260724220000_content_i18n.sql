-- Multilingual user content: keep canonical text columns as source language,
-- store translations in i18n jsonb per row.

ALTER TABLE public.content_items
  ADD COLUMN IF NOT EXISTS i18n jsonb NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE public.content_versions
  ADD COLUMN IF NOT EXISTS i18n jsonb NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS i18n jsonb NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS i18n jsonb NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE public.calendar_blocks
  ADD COLUMN IF NOT EXISTS i18n jsonb NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE public.content_comments
  ADD COLUMN IF NOT EXISTS i18n jsonb NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE public.library_assets
  ADD COLUMN IF NOT EXISTS i18n jsonb NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE public.brand_briefings
  ADD COLUMN IF NOT EXISTS i18n jsonb NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE public.activity_events
  ADD COLUMN IF NOT EXISTS i18n jsonb NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS i18n jsonb NOT NULL DEFAULT '{}'::jsonb;
