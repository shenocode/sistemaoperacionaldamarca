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
  source: "admin" | "platform" | "none" | "quota";
};

const PLATFORM_DAILY_MAX = 40;

function platformKey(provider: AiProvider): string | null {
  if (provider === "gemini") {
    return Deno.env.get("GEMINI_API_KEY") || Deno.env.get("GOOGLE_API_KEY") || null;
  }
  return Deno.env.get("OPENAI_API_KEY") || null;
}

async function lookupOwnKey(
  admin: SupabaseLike,
  userId: string,
  provider: AiProvider,
): Promise<string | null> {
  try {
    const { data } = await admin
      .from("admin_ai_credentials")
      .select("openai_key_ciphertext, gemini_key_ciphertext")
      .eq("user_id", userId)
      .maybeSingle();

    const ciphertext = (
      provider === "gemini" ? data?.gemini_key_ciphertext : data?.openai_key_ciphertext
    ) as string | null | undefined;

    return (await decryptApiKey(ciphertext)) || null;
  } catch (error) {
    console.error("resolveAiKey lookup failed:", error);
    return null;
  }
}

/** Own key if present; otherwise no platform fallback. */
export async function resolveAiKey(
  admin: SupabaseLike,
  userId: string,
  provider: AiProvider,
): Promise<ResolvedKey> {
  const own = await lookupOwnKey(admin, userId, provider);
  if (own) return { apiKey: own, source: "admin" };
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
  if (own) return { apiKey: own, source: "admin" };

  const openaiPlatform = platformKey(provider);
  const lovableFallback =
    provider === "openai" ? Deno.env.get("LOVABLE_API_KEY") || null : null;
  if (!openaiPlatform && !lovableFallback) return { apiKey: null, source: "none" };

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

export function resolvedKeyError(resolved: ResolvedKey, provider: AiProvider): string | null {
  if (resolved.apiKey) return null;
  if (resolved.source === "quota") return quotaExceededMessage();
  return missingKeyMessage(provider);
}
