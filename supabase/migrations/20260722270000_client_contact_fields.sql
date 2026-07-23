-- Contact / social fields for client settings on the clients list card
alter table public.clients
  add column if not exists email text,
  add column if not exists phone text,
  add column if not exists whatsapp text,
  add column if not exists instagram text;
