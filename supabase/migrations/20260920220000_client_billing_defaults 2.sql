-- Defaults de fechamento/pagamento por cliente (valor, dia, PIX).
-- Usados no lembrete de WhatsApp do calendário; só gestores atualizam via RLS.

alter table public.clients
  add column if not exists monthly_fee numeric(12, 2),
  add column if not exists payment_day smallint,
  add column if not exists pix_key text,
  add column if not exists pix_holder text;

alter table public.clients
  drop constraint if exists clients_payment_day_check;

alter table public.clients
  add constraint clients_payment_day_check
  check (payment_day is null or (payment_day >= 1 and payment_day <= 31));

comment on column public.clients.monthly_fee is
  'Valor mensal combinado com o cliente, em BRL. Prefill do fechamento no WhatsApp.';
comment on column public.clients.payment_day is
  'Dia do mês (1–31) combinado para pagamento. A data do ciclo é calculada no fechamento.';
comment on column public.clients.pix_key is
  'Chave PIX do favorecido para o lembrete de fechamento.';
comment on column public.clients.pix_holder is
  'Nome do favorecido da chave PIX.';

notify pgrst, 'reload schema';
