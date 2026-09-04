# Redeploy das Edge Functions após sincronização do repositório

Você escolheu sincronizar o código primeiro (o `_shared/caller-entitlements.ts` e a herança cliente→gestor ainda não estão no repositório atual). O plano abaixo roda depois que o sync estiver feito.

## Passos

1. **Verificar o código sincronizado**
   - Confirmar que `supabase/functions/_shared/caller-entitlements.ts` existe.
   - Confirmar que `admin-assinantes` (action `myEntitlements`) e/ou `briefing-coach` e `generate-brand-guide` importam o helper novo e que a herança de plano do gestor para o cliente está presente no código.

2. **Redeploy das 3 funções (sem alterar lógica)**
   - `admin-assinantes` (verify_jwt = true — já configurado em `supabase/config.toml`)
   - `briefing-coach` (verify_jwt = true)
   - `generate-brand-guide` (verify_jwt = true)
   - Os arquivos `_shared` são empacotados automaticamente no deploy de cada função; não há deploy separado para eles.

3. **Confirmação**
   - Validar que o deploy das três funções retornou sucesso.
   - Confirmar que a action `myEntitlements` de `admin-assinantes` está no código deployado (checagem do import/uso do helper no fonte sincronizado).

4. **Correção silenciosa incluída: erro de hidratação na landing**
   - A landing renderiza "BOS" no servidor e "SOM" no cliente (`src/components/landing-page.tsx`, logo do header), causando erro de hidratação no preview. Corrijo para um único valor fixo, sem mudar aparência.

## Fora de escopo
- Nenhuma alteração de lógica de negócio, schema/SQL ou frontend além do item 4.
- Nenhum redeploy de outras funções.
