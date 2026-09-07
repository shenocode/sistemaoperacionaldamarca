import type { ResolvedKey } from "./admin-ai-keys.ts";

export type ChatMessage = { role: string; content: string };
export type ChatProvider = "openai" | "lovable";
export type KeySource = ResolvedKey["source"];

type ChatJson = {
  choices?: Array<{ message?: { content?: string } }>;
};

export type ChatCompletionOk = {
  ok: true;
  provider: ChatProvider;
  json: ChatJson;
};

export type ChatCompletionFail = {
  ok: false;
  provider: ChatProvider | null;
  status: number;
  error: string;
};

const OPENAI_RETRIES = 3;
const MAX_RETRY_WAIT_MS = 8000;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function retryAfterMs(res: Response, fallback: number): number {
  const header = res.headers.get("retry-after");
  if (!header) return fallback;
  const seconds = Number(header);
  if (Number.isFinite(seconds) && seconds >= 0) {
    return Math.min(seconds * 1000, MAX_RETRY_WAIT_MS);
  }
  return fallback;
}

function uniqueModels(models: Array<string | null | undefined>): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const model of models) {
    const value = model?.trim();
    if (!value || seen.has(value)) continue;
    seen.add(value);
    out.push(value);
  }
  return out;
}

function looksLikeQuotaExhausted(status: number, body: string): boolean {
  if (status === 402) return true;
  const lower = body.toLowerCase();
  return (
    lower.includes("insufficient_quota") ||
    lower.includes("insufficient_credits") ||
    (lower.includes("credit") && (lower.includes("exhaust") || lower.includes("esgot")))
  );
}

export function classifyChatError(
  status: number,
  body: string,
  provider: ChatProvider | null,
  source: KeySource,
  fallbackMessage: string,
): { status: number; error: string } {
  const usingPlatform = provider === "lovable" || source === "platform" || source === "none";

  if (looksLikeQuotaExhausted(status, body)) {
    if (usingPlatform) {
      return {
        status: 402,
        error:
          "Créditos de IA da plataforma esgotados. Salve sua própria chave OpenAI em Configurações → Chaves de IA para continuar.",
      };
    }
    return {
      status: 402,
      error:
        "Os créditos da sua chave OpenAI acabaram. Verifique o billing em platform.openai.com ou atualize a chave em Configurações → Chaves de IA.",
    };
  }

  if (status === 429) {
    if (usingPlatform) {
      return {
        status: 429,
        error:
          "A IA compartilhada da plataforma está saturada no momento — esse limite é do workspace, não do seu uso no SOM. Aguarde cerca de 1 minuto ou salve sua chave OpenAI em Configurações → Chaves de IA.",
      };
    }
    return {
      status: 429,
      error:
        "A OpenAI limitou esta chave no momento (não é um contador de uso do SOM). Aguarde cerca de 1 minuto e tente de novo.",
    };
  }

  return { status: 502, error: fallbackMessage };
}

async function fetchOpenAI(
  messages: ChatMessage[],
  openaiKey: string,
  temperature: number,
): Promise<Response> {
  return await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${openaiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: Deno.env.get("OPENAI_MODEL") || "gpt-4o-mini",
      temperature,
      response_format: { type: "json_object" },
      messages,
    }),
  });
}

async function fetchLovable(
  messages: ChatMessage[],
  lovableKey: string,
  model: string,
  temperature: number,
): Promise<Response> {
  return await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      "Lovable-API-Key": lovableKey,
      "X-Lovable-AIG-SDK": "vercel-ai-sdk",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      temperature,
      response_format: { type: "json_object" },
      messages,
    }),
  });
}

async function readFailed(
  res: Response,
  provider: ChatProvider,
  source: KeySource,
  fallbackMessage: string,
): Promise<ChatCompletionFail> {
  const errText = await res.text();
  console.error(`${provider} AI error:`, res.status, errText);
  const classified = classifyChatError(res.status, errText, provider, source, fallbackMessage);
  return { ok: false, provider, status: classified.status, error: classified.error };
}

/**
 * Chat completions with 429 retries, cheaper Lovable model fallback,
 * and platform OpenAI → Lovable fallback. BYOK (admin) never leaves OpenAI.
 */
export async function completeChatJson(
  messages: ChatMessage[],
  openaiKey: string | null,
  source: KeySource,
  options: { temperature: number; fallbackMessage: string },
): Promise<ChatCompletionOk | ChatCompletionFail> {
  const lovableKey = Deno.env.get("LOVABLE_API_KEY");
  const { temperature, fallbackMessage } = options;

  if (openaiKey) {
    let delay = 1000;
    let last: Response | null = null;
    for (let attempt = 0; attempt < OPENAI_RETRIES; attempt++) {
      last = await fetchOpenAI(messages, openaiKey, temperature);
      if (last.ok) {
        return { ok: true, provider: "openai", json: (await last.json()) as ChatJson };
      }
      if (last.status !== 429 || attempt === OPENAI_RETRIES - 1) break;
      await last.text().catch(() => undefined);
      await sleep(retryAfterMs(last, delay));
      delay *= 2;
    }

    const failed = last
      ? await readFailed(last, "openai", source, fallbackMessage)
      : {
          ok: false as const,
          provider: "openai" as const,
          status: 502,
          error: fallbackMessage,
        };

    // Own key stays on OpenAI. Platform key may fall through to Lovable.
    if (source === "admin" || !lovableKey) return failed;
    console.error("platform OpenAI failed; falling back to Lovable:", failed.status, failed.error);
  }

  if (!lovableKey) {
    return {
      ok: false,
      provider: null,
      status: 400,
      error: "Configure sua OPENAI API key em Configurações → Chaves de IA, ou use o fallback da plataforma.",
    };
  }

  const models = uniqueModels([
    Deno.env.get("AI_MODEL") || Deno.env.get("LOVABLE_AI_MODEL") || "openai/gpt-5.4-mini",
    "google/gemini-2.5-flash",
    "openai/gpt-5.4-nano",
  ]);

  let lastFail: ChatCompletionFail | null = null;
  for (let i = 0; i < models.length; i++) {
    const model = models[i];
    const res = await fetchLovable(messages, lovableKey, model, temperature);
    if (res.ok) {
      return { ok: true, provider: "lovable", json: (await res.json()) as ChatJson };
    }
    lastFail = await readFailed(res, "lovable", source, fallbackMessage);
    const retryable = res.status === 429 || res.status === 503;
    if (!retryable) return lastFail;
    if (i < models.length - 1) {
      await sleep(retryAfterMs(res, 800));
    }
  }

  return (
    lastFail ?? {
      ok: false,
      provider: "lovable",
      status: 502,
      error: fallbackMessage,
    }
  );
}
