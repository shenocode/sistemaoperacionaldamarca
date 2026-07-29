-- Status after production finishes client-requested adjustments:
-- client should review again and approve or request new changes.

alter type public.content_status add value if not exists 'changes_done';
