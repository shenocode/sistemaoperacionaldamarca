-- Per-admin AI API credentials (ciphertext only; plaintext never returned via RLS)

create table if not exists public.admin_ai_credentials (
  user_id uuid primary key references auth.users (id) on delete cascade,
  openai_key_ciphertext text,
  gemini_key_ciphertext text,
  openai_key_last4 text,
  gemini_key_last4 text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.admin_ai_credentials is
  'Encrypted OpenAI/Gemini API keys per admin. Read/decrypt only via edge functions.';

grant select, insert, update, delete on public.admin_ai_credentials to authenticated;
grant all on public.admin_ai_credentials to service_role;

alter table public.admin_ai_credentials enable row level security;

-- Authenticated users can only see their own last4 metadata (ciphertext still present but
-- client apps must use the manage-admin-ai-keys edge function and never display ciphertext).
create policy "Admins manage own ai credentials"
  on public.admin_ai_credentials for all to authenticated
  using (user_id = auth.uid() and public.is_admin())
  with check (user_id = auth.uid() and public.is_admin());
