import type { ResolvedKey } from "./admin-ai-keys.ts";

export type ChatMessage = { role: string; content: string };
export type ChatProvider = "openai" | "lovable" | "gemini" | "claude";
export type PreferredChatProvider = "openai" | "gemini" | "claude";
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
    if (provider === "claude") {
      return {
        status: 402,
        error:
          "Os créditos da sua chave Claude acabaram. Verifique o billing no console Anthropic ou atualize a chave em Configurações → Chaves de IA.",
      };
    }
    return {
      status: 402,
      error:
        "Os créditos da sua chave OpenAI acabaram. Verifique o billing em platform.openai.com ou atualize a chave em Configurações → Chaves de IA.",
    };
  }

  if (status === 401 || status === 403) {
    return {
      status: 400,
      error:
        provider === "gemini"
          ? "Chave Gemini rejeitada. Confira e salve de novo em Configurações → Chaves de IA."
          : provider === "claude"
            ? "Chave Claude rejeitada. Confira e salve de novo em Configurações → Chaves de IA."
            : "Chave OpenAI rejeitada. Confira e salve de novo em Configurações → Chaves de IA.",
    };
  }

  if (status === 429) {
    if (usingPlatform) {
      return {
        status: 400,
        error:
          "O assistente não usou a sua conta OpenAI (por isso o painel da OpenAI continua em $0). Salve sua chave em Configurações → Chaves de IA e gere de novo.",
      };
    }
    if (provider === "gemini") {
      return {
        status: 429,
        error:
          "O Gemini limitou esta chave no momento (não é um contador de uso do SOM). Aguarde cerca de 1 minuto e tente de novo.",
      };
    }
    if (provider === "claude") {
      return {
        status: 429,
        error:
          "A Anthropic limitou esta chave no momento (não é um contador de uso do SOM). Aguarde cerca de 1 minuto e tente de novo.",
      };
    }
    return {
      status: 429,
      error:
        "A OpenAI limitou esta chave no momento (não é um contador de uso do SOM). Aguarde cerca de 1 minuto e tente de novo.",
    };
  }

  let providerMessage = "";
  try {
    const parsed = JSON.parse(body) as { error?: { message?: string }; message?: string };
    const raw = parsed.error?.message || parsed.message;
    if (typeof raw === "string" && raw.trim()) providerMessage = raw.trim().slice(0, 220);
  } catch {
    // keep generic fallback
  }
  return {
    status: 502,
    error: providerMessage ? `${fallbackMessage}: ${providerMessage}` : fallbackMessage,
  };
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
  const model = Deno.env.get("GEMINI_CHAT_MODEL") || Deno.env.get("GEMINI_MODEL") || "gemini-3.8-flash";
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

async function fetchClaude(
  messages: ChatMessage[],
  claudeKey: string,
  temperature: number,
): Promise<Response> {
  const model = Deno.env.get("CLAUDE_MODEL") || Deno.env.get("ANTHROPIC_MODEL") || "claude-sonnet-4-5";
  const system = messages
    .filter((message) => message.role === "system")
    .map((message) => message.content)
    .join("\n\n");
  const user = messages
    .filter((message) => message.role !== "system")
    .map((message) => `${message.role}: ${message.content}`)
    .join("\n\n");
  return await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": claudeKey,
      "anthropic-version": "2023-06-01",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      max_tokens: 4096,
      temperature,
      ...(system ? { system } : {}),
      messages: [{ role: "user", content: user }],
    }),
  });
}

function claudeToChatJson(payload: unknown): ChatJson {
  const content = (payload as { content?: Array<{ type?: string; text?: string }> })?.content;
  const text = Array.isArray(content)
    ? content
        .filter((part) => part?.type === "text" && typeof part.text === "string")
        .map((part) => part.text)
        .join("\n")
        .trim()
    : "";
  return { choices: [{ message: { content: text } }] };
}

function geminiToChatJson(payload: unknown): ChatJson {
  const json = payload as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
  };
  const text =
    json.candidates?.[0]?.content?.parts?.map((part) => part.text ?? "").join("") ?? "";
  return { choices: [{ message: { content: text } }] };
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

async function tryClaude(
  messages: ChatMessage[],
  claudeKey: string,
  source: KeySource,
  temperature: number,
  fallbackMessage: string,
): Promise<ChatCompletionOk | ChatCompletionFail> {
  let delay = 1000;
  let last: Response | null = null;
  for (let attempt = 0; attempt < OPENAI_RETRIES; attempt++) {
    last = await fetchClaude(messages, claudeKey, temperature);
    if (last.ok) {
      return { ok: true, provider: "claude", json: claudeToChatJson(await last.json()) };
    }
    const retryable = last.status === 429 || last.status === 529 || last.status === 503;
    if (!retryable || attempt === OPENAI_RETRIES - 1) break;
    await last.text().catch(() => undefined);
    await sleep(retryAfterMs(last, delay));
    delay *= 2;
  }
  return last
    ? await readFailed(last, "claude", source === "admin" ? "admin" : source, fallbackMessage)
    : { ok: false, provider: "claude", status: 502, error: fallbackMessage };
}

/**
 * Prefer the admin's OpenAI, then Gemini/Claude BYOK, then the platform OpenAI secret.
 * Never use the shared Lovable gateway — it 429s independently of the user's OpenAI usage.
 */
export async function completeChatJson(
  messages: ChatMessage[],
  openaiKey: string | null,
  source: KeySource,
  options: {
    temperature: number;
    fallbackMessage: string;
    geminiKey?: string | null;
    claudeKey?: string | null;
    preferredProvider?: PreferredChatProvider;
  },
): Promise<ChatCompletionOk | ChatCompletionFail> {
  const {
    temperature,
    fallbackMessage,
    geminiKey = null,
    claudeKey = null,
    preferredProvider,
  } = options;
  console.log("completeChatJson", {
    source,
    preferredProvider: preferredProvider ?? "auto",
    hasOpenAI: Boolean(openaiKey),
    hasGemini: Boolean(geminiKey),
    hasClaude: Boolean(claudeKey),
  });

  if (preferredProvider === "gemini") {
    if (!geminiKey) {
      return {
        ok: false,
        provider: "gemini",
        status: 400,
        error: "Salve sua chave Gemini em Configurações → Chaves de IA.",
      };
    }
    return await tryGemini(messages, geminiKey, "admin", temperature, fallbackMessage);
  }

  if (preferredProvider === "claude") {
    if (!claudeKey) {
      return {
        ok: false,
        provider: "claude",
        status: 400,
        error: "Salve sua chave Claude em Configurações → Chaves de IA.",
      };
    }
    return await tryClaude(messages, claudeKey, "admin", temperature, fallbackMessage);
  }

  if (preferredProvider === "openai") {
    if (source === "decrypt_failed") {
      return {
        ok: false,
        provider: "openai",
        status: 400,
        error:
          "Não foi possível ler a chave OpenAI salva. Abra Configurações → Chaves de IA e cole a chave de novo.",
      };
    }
    if (!openaiKey) {
      return {
        ok: false,
        provider: "openai",
        status: 400,
        error: "Salve sua chave OpenAI em Configurações → Chaves de IA.",
      };
    }
    return await tryOpenAI(messages, openaiKey, source, temperature, fallbackMessage);
  }

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
    return await tryOpenAI(messages, openaiKey, source, temperature, fallbackMessage);
  }

  if (geminiKey) {
    return await tryGemini(messages, geminiKey, "admin", temperature, fallbackMessage);
  }

  if (claudeKey) {
    return await tryClaude(messages, claudeKey, "admin", temperature, fallbackMessage);
  }

  if (openaiKey) {
    return await tryOpenAI(messages, openaiKey, source, temperature, fallbackMessage);
  }

  return {
    ok: false,
    provider: null,
    status: 400,
    error:
      "Salve sua chave OpenAI em Configurações → Chaves de IA. Sem essa chave o assistente não usa a sua conta OpenAI.",
  };
}
