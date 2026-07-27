-- Meeting notes field on agendas (free-form notes below topics).

alter table public.meeting_agendas
  add column if not exists notes text;
