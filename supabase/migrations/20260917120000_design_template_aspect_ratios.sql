-- Design assistant: all content formats + canvas aspect ratios (4:5, 9:16, 16:9, 1:1, 3:4)

ALTER TYPE public.design_template_format ADD VALUE IF NOT EXISTS 'stories';
ALTER TYPE public.design_template_format ADD VALUE IF NOT EXISTS 'reels';
ALTER TYPE public.design_template_format ADD VALUE IF NOT EXISTS 'recorded_video';
ALTER TYPE public.design_template_format ADD VALUE IF NOT EXISTS 'youtube_short';
ALTER TYPE public.design_template_format ADD VALUE IF NOT EXISTS 'print_material';

alter table public.design_templates
  add column if not exists aspect_ratio text not null default '4:5';

alter table public.design_templates
  drop constraint if exists design_templates_aspect_ratio_check;

alter table public.design_templates
  add constraint design_templates_aspect_ratio_check
  check (aspect_ratio in ('4:5', '9:16', '16:9', '1:1', '3:4'));

comment on column public.design_templates.aspect_ratio is
  'Canvas aspect ratio for the design assistant: 4:5, 9:16, 16:9, 1:1, 3:4';

update public.design_templates
set aspect_ratio = case format::text
  when 'stories' then '9:16'
  when 'reels' then '9:16'
  when 'youtube_short' then '9:16'
  when 'recorded_video' then '16:9'
  when 'print_material' then '3:4'
  else coalesce(nullif(aspect_ratio, ''), '4:5')
end
where aspect_ratio is distinct from case format::text
  when 'stories' then '9:16'
  when 'reels' then '9:16'
  when 'youtube_short' then '9:16'
  when 'recorded_video' then '16:9'
  when 'print_material' then '3:4'
  else '4:5'
end;

notify pgrst, 'reload schema';
