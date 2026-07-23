-- Add content status "waiting_material" and format "recorded_video"

alter type public.content_status add value if not exists 'waiting_material';

alter type public.content_format add value if not exists 'recorded_video';
