import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { resolveAiKeyWithBudget, resolvedKeyError } from "../_shared/admin-ai-keys.ts";
import { loadCallerEntitlements } from "../_shared/caller-entitlements.ts";

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type GenerateRequest = {
  clientId: string;
  locale?: string;
};

type BriefingSection = {
  id?: string;
  title?: string;
  questions?: Array<{ id?: string; label?: string }>;
};

type BriefingTemplate = {
  title?: string;
  sections?: BriefingSection[];
};

function languageInstruction(locale?: string): string {
  const lower = (locale ?? "pt-BR").toLowerCase();
  if (lower.startsWith("en")) return "Write in English (US).";
  if (lower.startsWith("es")) return "Escribe en español.";
  return "Escreva em português do Brasil.";
}

function normalizeLocale(locale?: string): "pt-BR" | "en-US" | "es-ES" {
  const lower = (locale ?? "pt-BR").toLowerCase();
  if (lower.startsWith("en")) return "en-US";
  if (lower.startsWith("es")) return "es-ES";
  return "pt-BR";
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function asAnswers(raw: unknown): Record<string, string> {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    if (typeof value === "string" && value.trim()) out[key] = value.trim();
  }
  return out;
}

function buildQaText(template: BriefingTemplate, answers: Record<string, string>): string {
  const lines: string[] = [];
  for (const section of template.sections ?? []) {
    if (section.title) lines.push(`## ${section.title}`);
    for (const q of section.questions ?? []) {
      if (!q.id || !q.label) continue;
      const answer = answers[q.id];
      if (!answer) continue;
      lines.push(`P: ${q.label}`);
      lines.push(`R: ${answer}`);
      lines.push("");
    }
  }
  return lines.join("\n").trim();
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
    const entitlements = await loadCallerEntitlements(admin, user.id, user.email);
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

    const body = (await req.json()) as GenerateRequest;
    if (!body.clientId) {
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
        supabase.from("brand_briefings").select("*").eq("client_id", body.clientId).maybeSingle(),
      ]);

    if (clientError) return jsonResponse({ error: clientError.message }, 500);
    if (briefingError) return jsonResponse({ error: briefingError.message }, 500);
    if (!client || !briefing) {
      return jsonResponse({ error: "Briefing não encontrado" }, 404);
    }

    const answers = asAnswers(briefing.answers);
    if (Object.keys(answers).length === 0) {
      return jsonResponse({ error: "Preencha ao menos uma resposta antes de gerar o guia" }, 400);
    }

    const template = (briefing.template ?? {}) as BriefingTemplate;
    const qaText = buildQaText(template, answers);

    const systemPrompt = [
      "Você sintetiza briefings de marca em um Guia de marca interno para produção de conteúdo.",
      languageInstruction(body.locale),
      "Responda APENAS com JSON válido (sem markdown) no formato:",
      '{"guide":{"proposito":"...","publico":"...","voz":"...","pilares":"...","posicionamento":"...","etica":"...","visual":"...","objetivos":"...","regras_ia":"...","notas":"..."},"guide_markdown":"..."}',
      "Regras:",
      "- guide: objeto com seções curtas (parágrafos ou bullets em string).",
      "- guide_markdown: documento completo em markdown com títulos ## para cada seção.",
      "- Não invente fatos ausentes nas respostas; se faltar, indique lacuna brevemente.",
      "- Priorize o que ajuda um assistente de conteúdo a escrever fiel à marca.",
    ].join("\n");

    const userPrompt = [
      `Cliente/marca: ${client.name}`,
      template.title ? `Título do briefing: ${template.title}` : null,
      "Respostas do briefing:",
      qaText || "(sem pares pergunta/resposta estruturados; use o mapa bruto abaixo)",
      !qaText ? JSON.stringify(answers) : null,
    ]
      .filter(Boolean)
      .join("\n\n");

    const openaiRes = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${openaiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: Deno.env.get("OPENAI_MODEL") || "gpt-4o-mini",
        temperature: 0.4,
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
      return jsonResponse({ error: "Falha ao gerar o guia com a IA" }, 502);
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

    const guide = parsed.guide ?? null;
    const guideMarkdown =
      typeof parsed.guide_markdown === "string" ? parsed.guide_markdown.trim() : "";
    if (!guideMarkdown) {
      return jsonResponse({ error: "Guia gerado sem conteúdo" }, 502);
    }

    const now = new Date().toISOString();
    const sourceLocale = normalizeLocale(body.locale);
    const existingI18n =
      briefing.i18n && typeof briefing.i18n === "object" && !Array.isArray(briefing.i18n)
        ? (briefing.i18n as Record<string, unknown>)
        : {};
    const nextI18n = {
      ...existingI18n,
      guide_markdown: {
        source: sourceLocale,
        values: { [sourceLocale]: guideMarkdown },
      },
    };

    const { data: updated, error: updateError } = await supabase
      .from("brand_briefings")
      .update({
        guide,
        guide_markdown: guideMarkdown,
        status: "completed",
        completed_at: now,
        i18n: nextI18n,
      })
      .eq("client_id", body.clientId)
      .select("*")
      .single();

    if (updateError) return jsonResponse({ error: updateError.message }, 500);

    return jsonResponse({ briefing: updated });
  } catch (error) {
    console.error(error);
    return jsonResponse(
      { error: error instanceof Error ? error.message : "Erro interno" },
      500,
    );
  }
});
