-- Ensure "changes_done" exists (idempotent).
-- Frontend already uses this status for "Ajustes concluídos"; some environments
-- never received the earlier 20260729180000 migration.

alter type public.content_status add value if not exists 'changes_done';
