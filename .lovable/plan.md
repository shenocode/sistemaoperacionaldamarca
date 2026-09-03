# Diagnóstico: "This page didn't load"

## O que eu verifiquei agora

Conferi o formato de todas as chaves salvas no Cloud (sem exibir os valores):

| Chave | Situação |
|---|---|
| SUPABASE_URL | ok (https://..., sem espaços/aspas) |
| SUPABASE_SERVICE_ROLE_KEY | ok (`sb_secret_...`) |
| SITE_URL | ok |
| STRIPE_SECRET_KEY / WEBHOOK / 3 PRICES | ok (`sk_test_`, `whsec_`, `price_1...`) |
| OPENAI_API_KEY | ok (`sk-proj-...`) |
| GEMINI_API_KEY | ok |
| LOVABLE_API_KEY | ok |
| AI_KEYS_ENCRYPTION_SECRET | ok (64 caracteres) |

Nenhuma delas tem espaço em branco, quebra de linha ou aspas coladas por engano. Ou seja: **não há caractere errado nas chaves do Cloud.**

Também testei os endereços:

- `sistemaoperacionaldamarca.lovable.app/` → 200 (abre normal)
- `/auth` e `/dashboard` → 200
- preview do editor → 401 (esperado: exige login Lovable)

## Suspeita principal

A tela "This page didn't load" é a página de erro de servidor do app (erro 500 na renderização). Como o app publicado pelo Lovable está abrindo, o problema deve estar no **site do Netlify**, que usa variáveis de ambiente próprias — copiadas manualmente por você.

O código exige, no servidor, exatamente estes nomes:

- `SUPABASE_URL`
- `SUPABASE_PUBLISHABLE_KEY` (no singular)

No Cloud a listagem mostra `SUPABASE_PUBLISHABLE_KEYS` (plural) e `SUPABASE_ANON_KEY`. Se um desses nomes foi copiado para o Netlify, o app não encontra a variável e devolve exatamente essa tela de erro. Isso é uma hipótese — precisa ser confirmada com o log do Netlify antes de eu mexer em qualquer coisa.

## Plano

1. Confirmar onde o erro aparece (Netlify ou outro endereço) e ler a mensagem real do log da função SSR do Netlify.
2. Comparar os nomes das variáveis no Netlify com os que o código lê:
   - `SUPABASE_URL`
   - `SUPABASE_PUBLISHABLE_KEY` (singular, valor `sb_publishable_...`)
   - `VITE_SUPABASE_URL` e `VITE_SUPABASE_PUBLISHABLE_KEY` para o navegador
3. Corrigir os nomes/valores no Netlify e refazer o deploy.
4. Se o log apontar outra causa (erro de código na renderização), tratar essa causa específica no código — sem alterar regra de negócio.

## Detalhes técnicos

- `src/integrations/supabase/client.ts` e `auth-middleware.ts` lançam erro quando `SUPABASE_URL` ou `SUPABASE_PUBLISHABLE_KEY` faltam; o `errorMiddleware` em `src/start.ts` converte isso na página "This page didn't load".
- `SUPABASE_SERVICE_ROLE_KEY` não é mais necessária no Netlify: os fluxos privilegiados já passam por Edge Functions (`admin-team`, `admin-assinantes`, `admin-clients`).
