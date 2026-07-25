# Fluxos WhatsApp — SOM

Roteiro para configurar no bot (ManyChat, WhatsApp Business API, Z-API + n8n, etc.).

**Gatilhos disparados pela landing:**

| Keyword | Intent |
|---------|--------|
| `#TESTE_GRATUITO` | Teste gratuito |
| `#ATENDIMENTO_HUMANO` | Atendimento humano |

A mensagem inicial já traz **Nome**, **E-mail**, **WhatsApp** e **Nicho**. O bot deve **confirmar**, não perguntar do zero.

**Placeholders (substitua pelos seus links):**

- `{{CALENDAR_URL}}` — link público do Cal.com (evento “Chamada SOM 15–20 min”)
- `{{VIDEO_URL}}` — vídeo explicativo
- `{{SLA_HORAS}}` — ex.: `4`

No SOM, os mesmos links ficam em `VITE_CONTACT_CALENDAR_URL` / `VITE_CONTACT_VIDEO_URL` e na tela `/leads` (para copiar).

---

## Setup Cal.com (recomendado)

1. Crie conta em [cal.com](https://cal.com).
2. Crie um evento: **Chamada SOM** · 15–20 min · telefone ou Google Meet.
3. Copie o link público e cole no bot + no `.env` do SOM.

---

## Bloco comum (após qualquer gatilho)

**1. Saudação + nome**

```
Oi, {{nome}}! 👋 Sou o assistente do SOM.
Confirmei seu nome como *{{nome}}*. Está correto?
```

Botões: `Sim` | `Corrigir nome`  
(Se corrigir: pedir nome completo em texto livre e seguir.)

**2. Nicho**

Se a mensagem já trouxe nicho:

```
Vi que você é *{{nicho_label}}*. Certo?
```

Botões: `Sim` | `Corrigir`

Se corrigir (ou se não veio nicho), botões:

- `Agência`
- `Social media`
- `Dono(a) de marca`

Salvar tag: `niche:agency` | `niche:social_media` | `niche:brand_owner`.

---

## Fluxo `#TESTE_GRATUITO`

Tags iniciais: `intent:trial`

**3. Confirmar e-mail**

```
Para liberar o teste, uso este e-mail?
*{{email}}*
```

Botões: `Sim, este e-mail` | `Usar outro`  
(Se outro: pedir e-mail válido.)

**4. Qualificação — tamanho**

```
Quantas marcas ou clientes você atende hoje?
```

Botões: `1` | `2–5` | `6+`  
Tags: `size:1` | `size:2_5` | `size:6_plus`

**5. Mensagem de valor por nicho (escolha 1)**

- **Agência:** “O SOM centraliza briefing, produção e aprovação dos clientes da agência num só lugar.”
- **Social media:** “Você organiza calendário, artes e feedback do cliente sem perder o fio no WhatsApp.”
- **Dono(a) de marca:** “Você e quem produz conteúdo ficam alinhados no feed de aprovação, com histórico.”

**6. Fechamento**

```
Perfeito. Vamos liberar o período de teste.
Em breve você recebe o acesso neste WhatsApp e/ou no e-mail confirmado.
Se precisar de algo agora, é só responder aqui.
```

Notificar o admin (handoff). **Não** provisionar acesso automático nesta fase.

---

## Fluxo `#ATENDIMENTO_HUMANO`

Tags iniciais: `intent:human`

Após bloco comum (nome + nicho):

**3. Escolha de canal**

```
Como prefere seguir?
```

Botões:

1. `Agendar chamada`
2. `Continuar no WhatsApp`
3. `Ver vídeo primeiro`

### 3a. Agendar chamada

Tag: `channel:call`

```
Ótimo. Escolha um horário na agenda:
{{CALENDAR_URL}}

Este WhatsApp (*{{whatsapp}}*) é o melhor número para retorno da chamada?
```

Botões: `Sim` | `Outro número`  
(Se outro: pedir telefone com DDI.)

```
Assim que o horário for confirmado, eu (ou a equipe) falo com você.
```

### 3b. Continuar no WhatsApp

Tag: `channel:whatsapp`

```
O que você precisa resolver agora? (pode ser bem direto)
```

(Aguardar texto livre.)

```
Recebi, obrigado.
Retorno em até *{{SLA_HORAS}} horas úteis* por aqui.
```

Handoff para atendimento humano.

### 3c. Ver vídeo primeiro

Tag: `channel:video`

```
Segue um vídeo rápido explicando o SOM:
{{VIDEO_URL}}
```

Botões:

- `Prosseguir atendimento` → voltar ao menu do passo 3 (chamada / WhatsApp), **sem** repetir nome/nicho.
- `Finalizar por agora` → tag `channel:video_only` + mensagem:

```
Sem problema. Quando quiser continuar, é só mandar uma mensagem.
```

---

## Tags sugeridas (resumo)

| Tag | Uso |
|-----|-----|
| `intent:trial` / `intent:human` | Origem do gatilho |
| `niche:agency` / `social_media` / `brand_owner` | Nicho |
| `size:1` / `2_5` / `6_plus` | Só trial |
| `channel:call` / `whatsapp` / `video` / `video_only` | Só human |

---

## Checklist de configuração no bot

- [ ] Keyword `#TESTE_GRATUITO` → fluxo trial
- [ ] Keyword `#ATENDIMENTO_HUMANO` → fluxo human
- [ ] Extrair nome/e-mail/WhatsApp/nicho da primeira mensagem (regex ou campos)
- [ ] Colar `{{CALENDAR_URL}}` e `{{VIDEO_URL}}`
- [ ] Definir `{{SLA_HORAS}}`
- [ ] Notificação interna (você) em handoff trial e em canal WhatsApp/chamada
