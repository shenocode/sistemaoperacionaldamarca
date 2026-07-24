import { createClient } from "https://esm.sh/@supabase/supabase-js@2.91.1";
import { encryptSecret } from "../_shared/ai-key-crypto.ts";
import { corsHeaders, handleCors, jsonResponse } from "../_shared/cors.ts";

type UpsertBody = {
  action?: "status" | "upsert";
  openaiKey?: string;
  geminiKey?: string;
  clearOpenAI?: boolean;
  clearGemini?: boolean;
};

function last4(value: string): string {
  const cleaned = value.trim();
  return cleaned.slice(-4);
}

function statusPayload(data: {
  openai_key_last4: string | null;
  gemini_key_last4: string | null;
  updated_at?: string | null;
} | null) {
  return {
    openaiConfigured: Boolean(data?.openai_key_last4),
    geminiConfigured: Boolean(data?.gemini_key_last4),
    openaiLast4: data?.openai_key_last4 ?? null,
    geminiLast4: data?.gemini_key_last4 ?? null,
    updatedAt: data?.updated_at ?? null,
    openaiHelpUrl: "https://platform.openai.com/api-keys",
    geminiHelpUrl: "https://aistudio.google.com/apikey",
  };
}

Deno.serve(async (req) => {
  const cors = handleCors(req);
  if (cors) return cors;

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return jsonResponse({ error: "Unauthorized" }, 401);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const admin = createClient(supabaseUrl, serviceRoleKey);

    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await userClient.auth.getUser(token);
    if (userError || !userData.user) {
      return jsonResponse({ error: "Unauthorized" }, 401);
    }
    const user = userData.user;

    const { data: isAdmin, error: adminError } = await userClient.rpc("is_admin");
    if (adminError) {
      return jsonResponse({ error: adminError.message }, 500);
    }
    if (!isAdmin) {
      return jsonResponse({ error: "Only admins can manage AI keys" }, 403);
    }

    if (req.method === "GET") {
      const { data, error } = await admin
        .from("admin_ai_credentials")
        .select("openai_key_last4, gemini_key_last4, updated_at")
        .eq("user_id", user.id)
        .maybeSingle();
      if (error) return jsonResponse({ error: error.message }, 500);
      return jsonResponse(statusPayload(data));
    }

    if (req.method !== "POST") {
      return jsonResponse({ error: "Method not allowed" }, 405);
    }

    const body = (await req.json().catch(() => ({}))) as UpsertBody;
    const wantsStatus =
      body.action === "status" ||
      (!body.action && !body.openaiKey && !body.geminiKey && !body.clearOpenAI && !body.clearGemini);

    if (wantsStatus) {
      const { data, error } = await admin
        .from("admin_ai_credentials")
        .select("openai_key_last4, gemini_key_last4, updated_at")
        .eq("user_id", user.id)
        .maybeSingle();
      if (error) return jsonResponse({ error: error.message }, 500);
      return jsonResponse(statusPayload(data));
    }

    const openaiKey = typeof body.openaiKey === "string" ? body.openaiKey.trim() : "";
    const geminiKey = typeof body.geminiKey === "string" ? body.geminiKey.trim() : "";

    if (openaiKey && openaiKey.length < 20) {
      return jsonResponse({ error: "OpenAI API key looks invalid" }, 400);
    }
    if (geminiKey && geminiKey.length < 20) {
      return jsonResponse({ error: "Gemini API key looks invalid" }, 400);
    }

    if (!openaiKey && !geminiKey && !body.clearOpenAI && !body.clearGemini) {
      return jsonResponse({ error: "Nothing to update" }, 400);
    }

    const { data: existing } = await admin
      .from("admin_ai_credentials")
      .select("*")
      .eq("user_id", user.id)
      .maybeSingle();

    const next = {
      user_id: user.id,
      openai_key_ciphertext: existing?.openai_key_ciphertext ?? null,
      gemini_key_ciphertext: existing?.gemini_key_ciphertext ?? null,
      openai_key_last4: existing?.openai_key_last4 ?? null,
      gemini_key_last4: existing?.gemini_key_last4 ?? null,
      updated_at: new Date().toISOString(),
    };

    if (body.clearOpenAI) {
      next.openai_key_ciphertext = null;
      next.openai_key_last4 = null;
    } else if (openaiKey) {
      next.openai_key_ciphertext = await encryptSecret(openaiKey);
      next.openai_key_last4 = last4(openaiKey);
    }

    if (body.clearGemini) {
      next.gemini_key_ciphertext = null;
      next.gemini_key_last4 = null;
    } else if (geminiKey) {
      next.gemini_key_ciphertext = await encryptSecret(geminiKey);
      next.gemini_key_last4 = last4(geminiKey);
    }

    const { data, error } = await admin
      .from("admin_ai_credentials")
      .upsert(next, { onConflict: "user_id" })
      .select("openai_key_last4, gemini_key_last4, updated_at")
      .single();

    if (error) return jsonResponse({ error: error.message }, 500);

    return jsonResponse(statusPayload(data));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
