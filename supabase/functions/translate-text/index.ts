import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { resolveAiKey, resolveAiKeyWithBudget, resolvedKeyError } from "../_shared/admin-ai-keys.ts";
import { completeChatJson } from "../_shared/chat-completions.ts";

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPPORTED_LOCALES = ["pt-BR", "en-US", "es-ES"] as const;
type AppLocale = (typeof SUPPORTED_LOCALES)[number];

type TranslateRequest = {
  text: string;
  sourceLocale?: AppLocale;
  targetLocales?: AppLocale[];
};

type LocalizedField = {
  source: AppLocale;
  values: Partial<Record<AppLocale, string>>;
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function isAppLocale(value: unknown): value is AppLocale {
  return typeof value === "string" && (SUPPORTED_LOCALES as readonly string[]).includes(value);
}

function extractJsonObject(text: string): Record<string, unknown> {
  const trimmed = text.trim();
  try {
    return JSON.parse(trimmed) as Record<string, unknown>;
  } catch {
    const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
    if (fenced?.[1]) {
      return JSON.parse(fenced[1].trim()) as Record<string, unknown>;
    }
    const start = trimmed.indexOf("{");
    const end = trimmed.lastIndexOf("}");
    if (start >= 0 && end > start) {
      return JSON.parse(trimmed.slice(start, end + 1)) as Record<string, unknown>;
    }
    throw new Error("JSON não encontrado na resposta");
  }
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

    const adminClient = serviceRoleKey ? createClient(supabaseUrl, serviceRoleKey) : null;
    const { apiKey: openaiKey, source: keySource } = adminClient
      ? await resolveAiKeyWithBudget(adminClient, user.id, "openai")
      : { apiKey: null as string | null, source: "none" as const };
    if (keySource === "quota" || keySource === "decrypt_failed") {
      return jsonResponse({ error: resolvedKeyError({ apiKey: null, source: keySource }, "openai") }, 400);
    }
    const geminiResolved = adminClient
      ? await resolveAiKey(adminClient, user.id, "gemini")
      : { apiKey: null as string | null, source: "none" as const };
    const geminiKey = geminiResolved.source === "admin" ? geminiResolved.apiKey : null;
    if (!openaiKey && !geminiKey && !Deno.env.get("LOVABLE_API_KEY")) {
      return jsonResponse(
        { error: resolvedKeyError({ apiKey: openaiKey, source: keySource }, "openai") ?? "Configure sua chave de IA." },
        400,
      );
    }

    const body = (await req.json()) as TranslateRequest;
    const text = typeof body.text === "string" ? body.text.trim() : "";
    if (!text) {
      return jsonResponse({ error: "Informe o texto" }, 400);
    }

    const targetLocales = (body.targetLocales ?? [...SUPPORTED_LOCALES]).filter(isAppLocale);
    const uniqueTargets = [...new Set(targetLocales)];
    if (uniqueTargets.length === 0) {
      return jsonResponse({ error: "Nenhum locale de destino válido" }, 400);
    }

    const systemPrompt = [
      "You are a professional translator for a brand content operating system.",
      "Detect the source language if not provided, then translate the text into the requested locales.",
      "Preserve meaning, tone, and formatting (line breaks, markdown, lists).",
      "Do NOT translate: @handles, #hashtags, URLs, emails, brand product codes, or pure proper names when they should stay as-is.",
      "Respond ONLY with valid JSON:",
      '{"source":"pt-BR|en-US|es-ES","values":{"pt-BR":"...","en-US":"...","es-ES":"..."}}',
      "Include the original text under the source locale key.",
      "Only include keys for the requested target locales (plus source).",
    ].join("\n");

    const userPrompt = [
      body.sourceLocale && isAppLocale(body.sourceLocale)
        ? `Source locale (hint): ${body.sourceLocale}`
        : "Source locale: detect automatically",
      `Target locales: ${uniqueTargets.join(", ")}`,
      `Text:\n${text}`,
    ].join("\n\n");

    const chat = await completeChatJson(
      [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      openaiKey,
      keySource,
      { temperature: 0.2, fallbackMessage: "Falha ao traduzir com a IA", geminiKey },
    );

    if (!chat.ok) {
      return jsonResponse({ error: chat.error }, chat.status);
    }

    const chatJson = chat.json;
    const contentText = chatJson.choices?.[0]?.message?.content ?? "";
    let parsed: Record<string, unknown>;
    try {
      parsed = extractJsonObject(contentText);
    } catch {
      return jsonResponse({ error: "Resposta da IA inválida" }, 502);
    }

    const sourceHint = isAppLocale(body.sourceLocale) ? body.sourceLocale : null;
    const source = isAppLocale(parsed.source) ? parsed.source : sourceHint ?? "pt-BR";
    const rawValues =
      parsed.values && typeof parsed.values === "object" && !Array.isArray(parsed.values)
        ? (parsed.values as Record<string, unknown>)
        : {};

    const values: Partial<Record<AppLocale, string>> = {};
    for (const locale of uniqueTargets) {
      const v = rawValues[locale];
      if (typeof v === "string" && v.trim()) {
        values[locale] = v.trim();
      }
    }
    values[source] = text;

    const field: LocalizedField = { source, values };
    return jsonResponse(field);
  } catch (error) {
    console.error(error);
    return jsonResponse(
      { error: error instanceof Error ? error.message : "Erro interno" },
      500,
    );
  }
});
