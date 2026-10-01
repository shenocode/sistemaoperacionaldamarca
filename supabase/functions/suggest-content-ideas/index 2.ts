import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { resolveAiKey, resolveAiKeyWithBudget, resolvedKeyError } from "../_shared/admin-ai-keys.ts";
import { handleCors, jsonResponse } from "../_shared/cors.ts";
import { generateCalendarIdeas, type IdeasRequest } from "../_shared/content-ideas.ts";

Deno.serve(async (req) => {
  const cors = handleCors(req);
  if (cors) return cors;
  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !supabaseAnonKey) {
      return jsonResponse({ error: "Supabase env missing" }, 500);
    }

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return jsonResponse({ error: "Não autenticado" }, 401);

    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();
    if (userError || !user) return jsonResponse({ error: "Não autenticado" }, 401);

    const { data: isAdmin, error: adminError } = await supabase.rpc("is_admin");
    if (adminError) return jsonResponse({ error: adminError.message }, 500);
    if (!isAdmin) return jsonResponse({ error: "Apenas administradores podem gerar ideias" }, 403);

    const adminClient = serviceRoleKey ? createClient(supabaseUrl, serviceRoleKey) : null;
    const body = (await req.json()) as IdeasRequest & { provider?: "openai" | "gemini" | "claude" };
    const preferredProvider =
      body.provider === "gemini" ? "gemini" : body.provider === "claude" ? "claude" : "openai";

    let openaiKey: string | null = null;
    let keySource: "admin" | "platform" | "none" | "quota" | "decrypt_failed" = "none";
    let geminiKey: string | null = null;
    let claudeKey: string | null = null;

    if (preferredProvider === "gemini") {
      const geminiResolved = adminClient
        ? await resolveAiKey(adminClient, user.id, "gemini")
        : { apiKey: null as string | null, source: "none" as const };
      if (geminiResolved.source === "decrypt_failed") {
        return jsonResponse({ error: resolvedKeyError(geminiResolved, "gemini") }, 400);
      }
      geminiKey = geminiResolved.source === "admin" ? geminiResolved.apiKey : null;
      if (!geminiKey) {
        return jsonResponse({ error: "Salve sua chave Gemini em Configurações → Chaves de IA." }, 400);
      }
    } else if (preferredProvider === "claude") {
      const claudeResolved = adminClient
        ? await resolveAiKey(adminClient, user.id, "claude")
        : { apiKey: null as string | null, source: "none" as const };
      if (claudeResolved.source === "decrypt_failed") {
        return jsonResponse({ error: resolvedKeyError(claudeResolved, "claude") }, 400);
      }
      claudeKey = claudeResolved.source === "admin" ? claudeResolved.apiKey : null;
      if (!claudeKey) {
        return jsonResponse({ error: "Salve sua chave Claude em Configurações → Chaves de IA." }, 400);
      }
    } else {
      const openaiResolved = adminClient
        ? await resolveAiKeyWithBudget(adminClient, user.id, "openai")
        : { apiKey: null as string | null, source: "none" as const };
      keySource = openaiResolved.source;
      openaiKey = openaiResolved.apiKey;
      if (keySource === "quota" || keySource === "decrypt_failed") {
        return jsonResponse({ error: resolvedKeyError({ apiKey: null, source: keySource }, "openai") }, 400);
      }
      if (!openaiKey) {
        return jsonResponse({ error: "Salve sua chave OpenAI em Configurações → Chaves de IA." }, 400);
      }
    }

    const ideas = await generateCalendarIdeas({
      supabase,
      body,
      openaiKey,
      keySource,
      geminiKey,
      claudeKey,
      preferredProvider,
    });
    if (!ideas.ok) return jsonResponse({ error: ideas.error }, ideas.status);

    return jsonResponse({
      ideas: ideas.ideas,
      mix: ideas.mix,
      sources: ideas.sources,
      webSearchUnavailable: ideas.webSearchUnavailable,
    });
  } catch (error) {
    console.error(error);
    return jsonResponse(
      { error: error instanceof Error ? error.message : "Erro interno" },
      500,
    );
  }
});
