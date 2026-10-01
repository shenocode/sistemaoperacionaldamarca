import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { resolveAiKey, resolveAiKeyWithBudget, resolvedKeyError } from "../_shared/admin-ai-keys.ts";
import { completeChatJson } from "../_shared/chat-completions.ts";
import { asString, extractJsonObject } from "../_shared/json-extract.ts";
import { languageInstruction } from "../_shared/language.ts";
import { fetchPublicProfileMeta } from "../_shared/video-meta.ts";

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type AnalyzeRequest = {
  creatorId: string;
  clientId: string;
  locale?: string;
  provider?: "openai" | "gemini" | "claude";
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
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
    if (!isAdmin) return jsonResponse({ error: "Apenas administradores podem analisar referências" }, 403);

    const adminClient = serviceRoleKey ? createClient(supabaseUrl, serviceRoleKey) : null;
    const body = (await req.json()) as AnalyzeRequest;
    if (!body.creatorId || !body.clientId) {
      return jsonResponse({ error: "Parâmetros inválidos" }, 400);
    }

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

    const { data: creator, error: creatorError } = await supabase
      .from("brand_reference_creators")
      .select("id, client_id, name, url, notes, pattern_summary")
      .eq("id", body.creatorId)
      .eq("client_id", body.clientId)
      .maybeSingle();
    if (creatorError) return jsonResponse({ error: creatorError.message }, 500);
    if (!creator) return jsonResponse({ error: "Criador de referência não encontrado" }, 404);

    const meta = creator.url ? await fetchPublicProfileMeta(creator.url) : { url: "", title: "", description: "" };

    const systemPrompt = [
      "Você analisa perfis públicos de referência para uma agência de marca.",
      languageInstruction(body.locale),
      "Você só vê metadados públicos (título/autor) e as notas que o gestor colou. Não invente métricas, números de seguidores ou insights privados.",
      "Responda APENAS com JSON: {\"pattern_summary\":\"...\"}",
      "pattern_summary: 3 a 6 frases sobre tom, tipo de gancho, duração aparente, temas e o que vale adaptar (não copiar) para a marca.",
    ].join("\n");

    const userPrompt = [
      `Nome informado: ${creator.name || "(sem nome)"}`,
      creator.url ? `URL: ${creator.url}` : "URL: (não informada)",
      creator.notes ? `Notas do gestor:\n${creator.notes}` : "Notas: (nenhuma)",
      meta.title ? `Título público: ${meta.title}` : null,
      meta.description ? `Metadados: ${meta.description}` : null,
      creator.pattern_summary ? `Resumo anterior:\n${creator.pattern_summary}` : null,
    ]
      .filter(Boolean)
      .join("\n\n");

    const chat = await completeChatJson(
      [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      openaiKey,
      keySource,
      {
        temperature: 0.5,
        fallbackMessage: "Falha ao analisar o perfil",
        geminiKey,
        claudeKey,
        preferredProvider,
      },
    );
    if (!chat.ok) return jsonResponse({ error: chat.error }, chat.status);

    const contentText = chat.json.choices?.[0]?.message?.content ?? "";
    let parsed: Record<string, unknown>;
    try {
      parsed = extractJsonObject(contentText);
    } catch {
      return jsonResponse({ error: "Resposta da IA inválida" }, 502);
    }

    const patternSummary = asString(parsed.pattern_summary) || asString(parsed.patternSummary);
    if (!patternSummary) {
      return jsonResponse({ error: "A IA não devolveu um resumo utilizável" }, 502);
    }

    const { data: updated, error: updateError } = await supabase
      .from("brand_reference_creators")
      .update({ pattern_summary: patternSummary })
      .eq("id", creator.id)
      .eq("client_id", body.clientId)
      .select("*")
      .single();
    if (updateError) return jsonResponse({ error: updateError.message }, 500);

    return jsonResponse({ creator: updated, patternSummary, meta });
  } catch (error) {
    console.error(error);
    return jsonResponse(
      { error: error instanceof Error ? error.message : "Erro interno" },
      500,
    );
  }
});
