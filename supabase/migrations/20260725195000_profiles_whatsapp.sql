-- WhatsApp contact for invited gestores / team members
alter table public.profiles
  add column if not exists whatsapp text;
