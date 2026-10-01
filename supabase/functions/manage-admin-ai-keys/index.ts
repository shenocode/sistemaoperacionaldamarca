import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { corsHeaders, jsonResponse } from "../_shared/cors.ts";
import { encryptApiKey, lastFour } from "../_shared/ai-key-crypto.ts";

type Action = "get" | "save" | "delete";
type Provider = "openai" | "gemini" | "claude";

type RequestBody = {
  action?: Action;
  provider?: Provider;
  apiKey?: string;
};

function normalizeProvider(value: unknown): Provider | null {
  return value === "openai" || value === "gemini" || value === "claude" ? value : null;
}

function providerPatch(
  provider: Provider,
  values: { ciphertext: string | null; last4: string | null },
): Record<string, string | null> {
  if (provider === "openai") {
    return { openai_key_ciphertext: values.ciphertext, openai_key_last4: values.last4 };
  }
  if (provider === "gemini") {
    return { gemini_key_ciphertext: values.ciphertext, gemini_key_last4: values.last4 };
  }
  return { claude_key_ciphertext: values.ciphertext, claude_key_last4: values.last4 };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !supabaseAnonKey || !serviceRoleKey) {
      return jsonResponse({ error: "Supabase env missing" }, 500);
    }

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return jsonResponse({ error: "Não autenticado" }, 401);

    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const admin = createClient(supabaseUrl, serviceRoleKey);

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();
    if (userError || !user) return jsonResponse({ error: "Não autenticado" }, 401);

    const { data: isAdmin, error: adminError } = await supabase.rpc("is_admin");
    if (adminError) return jsonResponse({ error: adminError.message }, 500);
    if (!isAdmin) {
      return jsonResponse({ error: "Apenas administradores podem gerenciar chaves de IA" }, 403);
    }

    const body = (await req.json().catch(() => ({}))) as RequestBody;
    const action = body.action ?? "get";

    const readState = async () => {
      const { data, error } = await admin
        .from("admin_ai_credentials")
        .select("openai_key_last4, gemini_key_last4, claude_key_last4, updated_at")
        .eq("user_id", user.id)
        .maybeSingle();
      if (error) throw new Error(error.message);
      return {
        openai: {
          configured: Boolean(data?.openai_key_last4),
          last4: data?.openai_key_last4 ?? null,
        },
        gemini: {
          configured: Boolean(data?.gemini_key_last4),
          last4: data?.gemini_key_last4 ?? null,
        },
        claude: {
          configured: Boolean(data?.claude_key_last4),
          last4: data?.claude_key_last4 ?? null,
        },
        platformFallback: {
          openai: Boolean(Deno.env.get("OPENAI_API_KEY")),
          gemini: Boolean(Deno.env.get("GEMINI_API_KEY") || Deno.env.get("GOOGLE_API_KEY")),
          claude: Boolean(Deno.env.get("ANTHROPIC_API_KEY") || Deno.env.get("CLAUDE_API_KEY")),
        },
        encryptionConfigured: Boolean(Deno.env.get("AI_KEYS_ENCRYPTION_SECRET")),
        updatedAt: data?.updated_at ?? null,
      };
    };

    if (action === "get") {
      return jsonResponse(await readState());
    }

    const provider = normalizeProvider(body.provider);
    if (!provider) return jsonResponse({ error: "Provedor inválido" }, 400);

    if (action === "delete") {
      const patch = providerPatch(provider, { ciphertext: null, last4: null });
      const { error } = await admin
        .from("admin_ai_credentials")
        .upsert({ user_id: user.id, ...patch, updated_at: new Date().toISOString() }, {
          onConflict: "user_id",
        });
      if (error) return jsonResponse({ error: error.message }, 500);
      return jsonResponse(await readState());
    }

    if (action === "save") {
      const apiKey = body.apiKey?.trim() ?? "";
      if (apiKey.length < 12) return jsonResponse({ error: "Chave de API inválida" }, 400);

      const ciphertext = await encryptApiKey(apiKey);
      const patch = providerPatch(provider, {
        ciphertext,
        last4: lastFour(apiKey),
      });

      const { error } = await admin
        .from("admin_ai_credentials")
        .upsert({ user_id: user.id, ...patch, updated_at: new Date().toISOString() }, {
          onConflict: "user_id",
        });
      if (error) return jsonResponse({ error: error.message }, 500);
      return jsonResponse(await readState());
    }

    return jsonResponse({ error: "Ação inválida" }, 400);
  } catch (error) {
    console.error(error);
    return jsonResponse({ error: error instanceof Error ? error.message : "Erro interno" }, 500);
  }
});
