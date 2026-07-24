import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { decryptSecret } from "./ai-key-crypto.ts";

export type AdminAiKeys = {
  openaiKey: string | null;
  geminiKey: string | null;
};

/** Load and decrypt the caller's AI keys (service role). */
export async function loadAdminAiKeys(userId: string): Promise<AdminAiKeys> {
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceRoleKey) {
    return { openaiKey: null, geminiKey: null };
  }

  const admin = createClient(supabaseUrl, serviceRoleKey);
  const { data, error } = await admin
    .from("admin_ai_credentials")
    .select("openai_key_ciphertext, gemini_key_ciphertext")
    .eq("user_id", userId)
    .maybeSingle();

  if (error || !data) {
    return { openaiKey: null, geminiKey: null };
  }

  let openaiKey: string | null = null;
  let geminiKey: string | null = null;

  try {
    if (data.openai_key_ciphertext) {
      openaiKey = await decryptSecret(data.openai_key_ciphertext);
    }
  } catch (err) {
    console.error("Failed to decrypt OpenAI key", err);
  }

  try {
    if (data.gemini_key_ciphertext) {
      geminiKey = await decryptSecret(data.gemini_key_ciphertext);
    }
  } catch (err) {
    console.error("Failed to decrypt Gemini key", err);
  }

  return { openaiKey, geminiKey };
}

export function resolveOpenAiKey(userKey: string | null): string | null {
  return userKey?.trim() || Deno.env.get("OPENAI_API_KEY") || null;
}

export function resolveGeminiKey(userKey: string | null): string | null {
  return (
    userKey?.trim() ||
    Deno.env.get("GEMINI_API_KEY") ||
    Deno.env.get("GOOGLE_API_KEY") ||
    null
  );
}
