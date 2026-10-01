-- Claude (Anthropic) API key alongside OpenAI / Gemini BYOK

alter table public.admin_ai_credentials
  add column if not exists claude_key_ciphertext text,
  add column if not exists claude_key_last4 text;

comment on table public.admin_ai_credentials is
  'Encrypted OpenAI/Gemini/Claude API keys per admin. Read/decrypt only via edge functions.';

notify pgrst, 'reload schema';
