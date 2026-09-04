import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { resolveAiKeyWithBudget, resolvedKeyError } from "../_shared/admin-ai-keys.ts";
import { loadViewerEntitlements } from "../_shared/caller-entitlements.ts";

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type CoachMessage = {
  role: "user" | "assistant";
  content: string;
};

type CoachRequest = {
  clientId: string;
  questionId: string;
  questionLabel: string;
  currentAnswer?: string;
  messages?: CoachMessage[];
  locale?: string;
};

type CoachResponse = {
  type: "follow_up" | "suggestion";
  content: string;
};

function languageInstruction(locale?: string): string {
  const lower = (locale ?? "pt-BR").toLowerCase();
  if (lower.startsWith("en")) return "Speak in English (US).";
  if (lower.startsWith("es")) return "Habla en español.";
  return "Fale em português do Brasil.";
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function parseCoachResult(raw: Record<string, unknown>): CoachResponse | null {
  const type = raw.type === "suggestion" || raw.type === "follow_up" ? raw.type : null;
  const content = typeof raw.content === "string" ? raw.content.trim() : "";
  if (!type || !content) return null;
  return { type, content };
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
    if (!authHeader) {
      return jsonResponse({ error: "Não autenticado" }, 401);
    }

    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();
    if (userError || !user) {
      return jsonResponse({ error: "Não autenticado" }, 401);
    }

    const admin = createClient(supabaseUrl, serviceRoleKey);
    const entitlements = await loadViewerEntitlements(admin, user.id, user.email);
    if (!entitlements.brandBriefing) {
      return jsonResponse(
        { error: "Brand briefing não está incluído no seu plano. Atualize para Studio ou Agência." },
        403,
      );
    }
    const resolved = await resolveAiKeyWithBudget(admin, user.id, "openai");
    const keyError = resolvedKeyError(resolved, "openai");
    if (keyError || !resolved.apiKey) {
      return jsonResponse({ error: keyError ?? "Configure sua chave de IA." }, 400);
    }
    const openaiKey = resolved.apiKey;

    const body = (await req.json()) as CoachRequest;
    if (!body.clientId || !body.questionId || !body.questionLabel?.trim()) {
      return jsonResponse({ error: "Parâmetros inválidos" }, 400);
    }

    const { data: canAccess, error: accessError } = await supabase.rpc("can_access_client", {
      _client_id: body.clientId,
    });
    if (accessError) return jsonResponse({ error: accessError.message }, 500);
    if (!canAccess) {
      return jsonResponse({ error: "Sem acesso a este cliente" }, 403);
    }

    const [{ data: client, error: clientError }, { data: briefing, error: briefingError }] =
      await Promise.all([
        supabase.from("clients").select("id, name").eq("id", body.clientId).maybeSingle(),
        supabase
          .from("brand_briefings")
          .select("template, answers")
          .eq("client_id", body.clientId)
          .maybeSingle(),
      ]);

    if (clientError) return jsonResponse({ error: clientError.message }, 500);
    if (briefingError) return jsonResponse({ error: briefingError.message }, 500);
    if (!client) return jsonResponse({ error: "Cliente não encontrado" }, 404);

    const answers =
      briefing?.answers && typeof briefing.answers === "object" && !Array.isArray(briefing.answers)
        ? (briefing.answers as Record<string, unknown>)
        : {};

    const answeredContext = Object.entries(answers)
      .filter(([, value]) => typeof value === "string" && value.trim())
      .slice(0, 12)
      .map(([id, value]) => `- ${id}: ${String(value).trim().slice(0, 280)}`)
      .join("\n");

    const history = (body.messages ?? [])
      .filter((m) => (m.role === "user" || m.role === "assistant") && m.content?.trim())
      .slice(-12);

    const userTurns = history.filter((m) => m.role === "user").length;
    const preferSuggestion = userTurns >= 2;

    const systemPrompt = [
      "Você é um coach de branding empático que ajuda a pessoa a clarear ideias para um briefing de marca.",
      languageInstruction(body.locale),
      "Não invente fatos biográficos ou profissionais; use apenas o que a pessoa disser e o contexto fornecido.",
      "Responda APENAS com JSON válido (sem markdown) no formato:",
      '{"type":"follow_up"|"suggestion","content":"..."}',
      "Regras:",
      "- type=follow_up: uma pergunta curta de esclarecimento (1–2 frases).",
      "- type=suggestion: rascunho de resposta pronto para o campo do briefing, na 1ª pessoa do cliente.",
      preferSuggestion
        ? "- Prefira type=suggestion agora (já houve respostas suficientes)."
        : "- Prefira type=follow_up no início; só sugira resposta se já houver material claro.",
      "- Se a pessoa pedir explicitamente uma sugestão, use type=suggestion.",
    ].join("\n");

    const userPrompt = [
      `Cliente/marca: ${client.name}`,
      `Pergunta do briefing (id ${body.questionId}): ${body.questionLabel.trim()}`,
      body.currentAnswer?.trim()
        ? `Rascunho atual no campo:\n${body.currentAnswer.trim()}`
        : "Campo ainda vazio.",
      answeredContext
        ? `Outras respostas já preenchidas (contexto):\n${answeredContext}`
        : "Ainda há poucas outras respostas preenchidas.",
      history.length
        ? `Conversa até agora:\n${history.map((m) => `${m.role}: ${m.content}`).join("\n")}`
        : "Inicie a conversa com uma pergunta de follow-up útil para destravar a resposta.",
    ].join("\n\n");

    const openaiRes = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${openaiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: Deno.env.get("OPENAI_MODEL") || "gpt-4o-mini",
        temperature: 0.6,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
      }),
    });

    if (!openaiRes.ok) {
      const errText = await openaiRes.text();
      console.error("OpenAI error:", errText);
      return jsonResponse({ error: "Falha ao conversar com a IA" }, 502);
    }

    const openaiJson = (await openaiRes.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const contentText = openaiJson.choices?.[0]?.message?.content ?? "";
    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(contentText) as Record<string, unknown>;
    } catch {
      return jsonResponse({ error: "Resposta da IA inválida" }, 502);
    }

    const result = parseCoachResult(parsed);
    if (!result) {
      return jsonResponse({ error: "Resposta da IA incompleta" }, 502);
    }

    return jsonResponse(result);
  } catch (error) {
    console.error(error);
    return jsonResponse(
      { error: error instanceof Error ? error.message : "Erro interno" },
      500,
    );
  }
});
