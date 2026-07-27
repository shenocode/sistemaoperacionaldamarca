-- Previously, duplicated calendar blocks were inserted at sort_order 0
-- (newest on top). Reverse existing orders so older periods stay above
-- and new duplicates append below.
WITH ranked AS (
  SELECT
    id,
    sort_order,
    MAX(sort_order) OVER (PARTITION BY project_id) AS max_sort
  FROM public.calendar_blocks
)
UPDATE public.calendar_blocks AS cb
SET sort_order = ranked.max_sort - ranked.sort_order
FROM ranked
WHERE cb.id = ranked.id;
