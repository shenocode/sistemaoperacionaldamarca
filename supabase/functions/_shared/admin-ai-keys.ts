// Resolves which AI API key to use for a request:
// 1) the admin's own key saved in Configurações → Chaves de IA
// 2) fallback to the platform secret (OPENAI_API_KEY / GEMINI_API_KEY)

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
};

export type ResolvedKey = {
  apiKey: string | null;
  source: "admin" | "platform" | "none";
};

function platformKey(provider: AiProvider): string | null {
  if (provider === "gemini") {
    return Deno.env.get("GEMINI_API_KEY") || Deno.env.get("GOOGLE_API_KEY") || null;
  }
  return Deno.env.get("OPENAI_API_KEY") || null;
}

export async function resolveAiKey(
  admin: SupabaseLike,
  userId: string,
  provider: AiProvider,
): Promise<ResolvedKey> {
  try {
    const { data } = await admin
      .from("admin_ai_credentials")
      .select("openai_key_ciphertext, gemini_key_ciphertext")
      .eq("user_id", userId)
      .maybeSingle();

    const ciphertext = (
      provider === "gemini" ? data?.gemini_key_ciphertext : data?.openai_key_ciphertext
    ) as string | null | undefined;

    const own = await decryptApiKey(ciphertext);
    if (own) return { apiKey: own, source: "admin" };
  } catch (error) {
    console.error("resolveAiKey lookup failed:", error);
  }

  const fallback = platformKey(provider);
  return fallback ? { apiKey: fallback, source: "platform" } : { apiKey: null, source: "none" };
}

export function missingKeyMessage(provider: AiProvider): string {
  return provider === "gemini"
    ? "Nenhuma chave Gemini disponível. Salve a sua chave em Configurações → Chaves de IA."
    : "Nenhuma chave OpenAI disponível. Salve a sua chave em Configurações → Chaves de IA.";
}
