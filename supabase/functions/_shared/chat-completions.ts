import type { ResolvedKey } from "./admin-ai-keys.ts";

export type ChatMessage = { role: string; content: string };
export type ChatProvider = "openai" | "lovable" | "gemini";
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
    lower.includes("resource_exhausted") ||
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
    if (provider === "gemini") {
      return {
        status: 402,
        error:
          "Os créditos da sua chave Gemini acabaram. Verifique o billing no Google AI Studio ou atualize a chave em Configurações → Chaves de IA.",
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
          "O assistente não usou a sua conta OpenAI (por isso o painel da OpenAI continua em $0). A IA compartilhada da plataforma está saturada. Salve sua chave em Configurações → Chaves de IA e gere de novo.",
      };
    }
    if (provider === "gemini") {
      return {
        status: 429,
        error:
          "O Gemini limitou esta chave no momento (não é um contador de uso do SOM). Aguarde cerca de 1 minuto e tente de novo.",
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

async function fetchGemini(
  messages: ChatMessage[],
  geminiKey: string,
  temperature: number,
): Promise<Response> {
  const model = Deno.env.get("GEMINI_CHAT_MODEL") || Deno.env.get("GEMINI_MODEL") || "gemini-2.5-flash";
  const url =
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(geminiKey)}`;
  const system = messages
    .filter((message) => message.role === "system")
    .map((message) => message.content)
    .join("\n\n");
  const user = messages
    .filter((message) => message.role !== "system")
    .map((message) => message.content)
    .join("\n\n");
  return await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      ...(system ? { systemInstruction: { parts: [{ text: system }] } } : {}),
      contents: [{ role: "user", parts: [{ text: user }] }],
      generationConfig: {
        temperature,
        responseMimeType: "application/json",
      },
    }),
  });
}

function geminiToChatJson(payload: unknown): ChatJson {
  const json = payload as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
  };
  const text =
    json.candidates?.[0]?.content?.parts?.map((part) => part.text ?? "").join("") ?? "";
  return { choices: [{ message: { content: text } }] };
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

async function tryOpenAI(
  messages: ChatMessage[],
  openaiKey: string,
  source: KeySource,
  temperature: number,
  fallbackMessage: string,
): Promise<ChatCompletionOk | ChatCompletionFail> {
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
  return last
    ? await readFailed(last, "openai", source, fallbackMessage)
    : { ok: false, provider: "openai", status: 502, error: fallbackMessage };
}

async function tryGemini(
  messages: ChatMessage[],
  geminiKey: string,
  source: KeySource,
  temperature: number,
  fallbackMessage: string,
): Promise<ChatCompletionOk | ChatCompletionFail> {
  let delay = 1000;
  let last: Response | null = null;
  for (let attempt = 0; attempt < OPENAI_RETRIES; attempt++) {
    last = await fetchGemini(messages, geminiKey, temperature);
    if (last.ok) {
      return { ok: true, provider: "gemini", json: geminiToChatJson(await last.json()) };
    }
    const retryable = last.status === 429 || last.status === 503;
    if (!retryable || attempt === OPENAI_RETRIES - 1) break;
    await last.text().catch(() => undefined);
    await sleep(retryAfterMs(last, delay));
    delay *= 2;
  }
  return last
    ? await readFailed(last, "gemini", source === "admin" ? "admin" : source, fallbackMessage)
    : { ok: false, provider: "gemini", status: 502, error: fallbackMessage };
}

/**
 * Prefer the admin's OpenAI, then Gemini BYOK, then platform OpenAI, then Lovable.
 * A stored-but-unreadable BYOK key must not silently fall through to Lovable.
 */
export async function completeChatJson(
  messages: ChatMessage[],
  openaiKey: string | null,
  source: KeySource,
  options: { temperature: number; fallbackMessage: string; geminiKey?: string | null },
): Promise<ChatCompletionOk | ChatCompletionFail> {
  const lovableKey = Deno.env.get("LOVABLE_API_KEY");
  const { temperature, fallbackMessage, geminiKey = null } = options;
  console.log("completeChatJson", {
    source,
    hasOpenAI: Boolean(openaiKey),
    hasGemini: Boolean(geminiKey),
    hasLovable: Boolean(lovableKey),
  });

  if (source === "decrypt_failed") {
    return {
      ok: false,
      provider: null,
      status: 400,
      error:
        "Não foi possível ler a chave de IA salva. Abra Configurações → Chaves de IA e cole a chave de novo.",
    };
  }

  if (openaiKey && source === "admin") {
    const result = await tryOpenAI(messages, openaiKey, source, temperature, fallbackMessage);
    if (result.ok) return result;
    if (geminiKey) {
      const gemini = await tryGemini(messages, geminiKey, "admin", temperature, fallbackMessage);
      if (gemini.ok) return gemini;
    }
    return result;
  }

  if (geminiKey) {
    const gemini = await tryGemini(messages, geminiKey, "admin", temperature, fallbackMessage);
    if (gemini.ok) return gemini;
  }

  if (openaiKey) {
    const result = await tryOpenAI(messages, openaiKey, source, temperature, fallbackMessage);
    if (result.ok) return result;
    if (!lovableKey) return result;
    console.error("platform OpenAI failed; falling back to Lovable:", result.status, result.error);
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
    "google/gemini-2.5-flash",
    Deno.env.get("AI_MODEL") || Deno.env.get("LOVABLE_AI_MODEL") || "openai/gpt-5.4-mini",
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
