// Resolves which AI API key to use for a request:
// 1) the admin's own key saved in Configurações → Chaves de IA
// 2) platform secret, only within a per-user daily quota

import { decryptApiKey } from "./ai-key-crypto.ts";

export type AiProvider = "openai" | "gemini";

type SupabaseLike = {
  from: (table: string) => {
    select: (cols: string) => {
      eq: (col: string, value: string) => {
        maybeSingle: () => Promise<{ data: Record<string, unknown> | null; error: unknown }>;
      };
    };
  };
  rpc?: (
    fn: string,
    args?: Record<string, unknown>,
  ) => Promise<{ data: unknown; error: { message?: string } | null }>;
};

export type ResolvedKey = {
  apiKey: string | null;
  source: "admin" | "platform" | "none" | "quota" | "decrypt_failed";
};

const PLATFORM_DAILY_MAX = 40;

function platformKey(provider: AiProvider): string | null {
  if (provider === "gemini") {
    return Deno.env.get("GEMINI_API_KEY") || Deno.env.get("GOOGLE_API_KEY") || null;
  }
  return Deno.env.get("OPENAI_API_KEY") || null;
}

type OwnKeyLookup = {
  apiKey: string | null;
  stored: boolean;
};

async function lookupOwnKey(
  admin: SupabaseLike,
  userId: string,
  provider: AiProvider,
): Promise<OwnKeyLookup> {
  try {
    const { data, error } = await admin
      .from("admin_ai_credentials")
      .select("openai_key_ciphertext, gemini_key_ciphertext, openai_key_last4, gemini_key_last4")
      .eq("user_id", userId)
      .maybeSingle();
    if (error) {
      console.error("resolveAiKey lookup failed:", error);
      return { apiKey: null, stored: false };
    }

    const ciphertext = (
      provider === "gemini" ? data?.gemini_key_ciphertext : data?.openai_key_ciphertext
    ) as string | null | undefined;
    const last4 = (
      provider === "gemini" ? data?.gemini_key_last4 : data?.openai_key_last4
    ) as string | null | undefined;
    const stored = Boolean((ciphertext && String(ciphertext).trim()) || last4);
    if (!ciphertext) return { apiKey: null, stored };

    const apiKey = await decryptApiKey(ciphertext);
    if (stored && !apiKey) {
      console.error(`resolveAiKey: stored ${provider} key could not be decrypted`);
    }
    return { apiKey, stored };
  } catch (error) {
    console.error("resolveAiKey lookup failed:", error);
    return { apiKey: null, stored: false };
  }
}

/** Own key if present; otherwise no platform fallback. */
export async function resolveAiKey(
  admin: SupabaseLike,
  userId: string,
  provider: AiProvider,
): Promise<ResolvedKey> {
  const own = await lookupOwnKey(admin, userId, provider);
  if (own.apiKey) return { apiKey: own.apiKey, source: "admin" };
  if (own.stored) return { apiKey: null, source: "decrypt_failed" };
  return { apiKey: null, source: "none" };
}

/**
 * Own BYOK first. Platform secret only after consuming daily quota units.
 * Design-class calls should pass a higher `units` cost.
 */
export async function resolveAiKeyWithBudget(
  admin: SupabaseLike,
  userId: string,
  provider: AiProvider,
  units = 1,
): Promise<ResolvedKey> {
  const own = await lookupOwnKey(admin, userId, provider);
  if (own.apiKey) return { apiKey: own.apiKey, source: "admin" };
  if (own.stored) return { apiKey: null, source: "decrypt_failed" };

  const openaiPlatform = platformKey(provider);
  if (!openaiPlatform) return { apiKey: null, source: "none" };

  if (typeof admin.rpc !== "function") {
    return { apiKey: null, source: "quota" };
  }

  const { data, error } = await admin.rpc("try_consume_platform_ai_quota", {
    _user_id: userId,
    _units: units,
    _daily_max: PLATFORM_DAILY_MAX,
  });
  if (error) {
    console.error("try_consume_platform_ai_quota:", error.message);
    return { apiKey: null, source: "quota" };
  }
  if (!data) return { apiKey: null, source: "quota" };
  return { apiKey: openaiPlatform, source: "platform" };
}

export function missingKeyMessage(provider: AiProvider): string {
  return provider === "gemini"
    ? "Nenhuma chave Gemini disponível. Salve a sua chave em Configurações → Chaves de IA."
    : "Nenhuma chave OpenAI disponível. Salve a sua chave em Configurações → Chaves de IA.";
}

export function quotaExceededMessage(): string {
  return "Cota diária de IA da plataforma atingida. Salve a sua própria chave em Configurações → Chaves de IA para continuar.";
}

export function decryptFailedMessage(): string {
  return "Não foi possível ler a chave de IA salva. Abra Configurações → Chaves de IA e cole a chave de novo.";
}

export function resolvedKeyError(resolved: ResolvedKey, provider: AiProvider): string | null {
  if (resolved.apiKey) return null;
  if (resolved.source === "quota") return quotaExceededMessage();
  if (resolved.source === "decrypt_failed") return decryptFailedMessage();
  return missingKeyMessage(provider);
}
