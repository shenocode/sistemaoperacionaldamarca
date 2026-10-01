-- Raise video/media upload limit from 100 MB to 150 MB
-- (library assets / "ativos" and content media).

update storage.buckets
set file_size_limit = 157286400
where id in ('library-assets', 'content-media');
