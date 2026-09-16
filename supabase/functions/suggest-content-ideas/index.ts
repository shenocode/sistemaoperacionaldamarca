import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { resolveAiKey, resolveAiKeyWithBudget, resolvedKeyError } from "../_shared/admin-ai-keys.ts";
import { completeChatJson } from "../_shared/chat-completions.ts";
import {
  formatReferenceCreatorsBlock,
  formatWinningPostsBlock,
  loadReferenceCreators,
  loadWinningPosts,
} from "../_shared/brand-strategy-context.ts";
import { asString, extractJsonObject } from "../_shared/json-extract.ts";
import { languageInstruction } from "../_shared/language.ts";
import { formatWebSourcesBlock, searchWeb } from "../_shared/web-search.ts";

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type ContentFormat = "static_feed" | "reels" | "stories" | "carousel" | "recorded_video" | "youtube_short";
type FunnelStage = "tofu" | "mofu" | "bofu";

type ContentMix = { tofu: number; mofu: number; bofu: number };

type IdeasRequest = {
  projectId: string;
  clientId: string;
  calendarBlockId?: string | null;
  mix?: Partial<ContentMix>;
  count?: number;
  prompt?: string;
  locale?: string;
  provider?: "openai" | "gemini";
  webSearch?: boolean;
  allowedFormats?: ContentFormat[];
};

type ContentIdea = {
  title: string;
  format: ContentFormat;
  funnelStage: FunnelStage;
  hook: string;
  why: string;
  theme: string | null;
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function clampPercent(value: unknown, fallback: number): number {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(0, Math.min(100, Math.round(n)));
}

function parseMix(raw: Partial<ContentMix> | undefined): ContentMix {
  const mix: ContentMix = {
    tofu: clampPercent(raw?.tofu, 50),
    mofu: clampPercent(raw?.mofu, 30),
    bofu: clampPercent(raw?.bofu, 20),
  };
  const total = mix.tofu + mix.mofu + mix.bofu;
  if (total <= 0) return { tofu: 50, mofu: 30, bofu: 20 };
  if (total === 100) return mix;
  return {
    tofu: Math.round((mix.tofu / total) * 100),
    mofu: Math.round((mix.mofu / total) * 100),
    bofu: Math.max(0, 100 - Math.round((mix.tofu / total) * 100) - Math.round((mix.mofu / total) * 100)),
  };
}

function mixCounts(mix: ContentMix, total: number): ContentMix {
  const n = Math.max(1, Math.min(14, Math.round(total)));
  const tofu = Math.round((mix.tofu / 100) * n);
  const mofu = Math.round((mix.mofu / 100) * n);
  const bofu = Math.max(0, n - tofu - mofu);
  return { tofu, mofu, bofu };
}

const FORMAT_SET = new Set<ContentFormat>([
  "static_feed",
  "reels",
  "stories",
  "carousel",
  "recorded_video",
  "youtube_short",
]);

function parseFormat(value: unknown, fallback: ContentFormat): ContentFormat {
  return typeof value === "string" && FORMAT_SET.has(value as ContentFormat)
    ? (value as ContentFormat)
    : fallback;
}

function parseStage(value: unknown, fallback: FunnelStage): FunnelStage {
  return value === "tofu" || value === "mofu" || value === "bofu" ? value : fallback;
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
    if (!isAdmin) return jsonResponse({ error: "Apenas administradores podem gerar ideias" }, 403);

    const adminClient = serviceRoleKey ? createClient(supabaseUrl, serviceRoleKey) : null;
    const body = (await req.json()) as IdeasRequest;
    const preferredProvider = body.provider === "gemini" ? "gemini" : "openai";

    let openaiKey: string | null = null;
    let keySource: "admin" | "platform" | "none" | "quota" | "decrypt_failed" = "none";
    let geminiKey: string | null = null;

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

    if (!body.projectId || !body.clientId) {
      return jsonResponse({ error: "Parâmetros inválidos" }, 400);
    }

    const [
      { data: project, error: projectError },
      { data: client, error: clientError },
      { data: brandBriefing, error: brandBriefingError },
    ] = await Promise.all([
      supabase
        .from("projects")
        .select("id, name, description, client_id, theme_presets, categories")
        .eq("id", body.projectId)
        .maybeSingle(),
      supabase.from("clients").select("id, name, brand_guidance").eq("id", body.clientId).maybeSingle(),
      supabase
        .from("brand_briefings")
        .select("guide_markdown, answers")
        .eq("client_id", body.clientId)
        .maybeSingle(),
    ]);

    if (projectError) return jsonResponse({ error: projectError.message }, 500);
    if (clientError && !/brand_guidance/i.test(clientError.message)) {
      return jsonResponse({ error: clientError.message }, 500);
    }
    if (brandBriefingError) return jsonResponse({ error: brandBriefingError.message }, 500);
    if (!project || !client) {
      return jsonResponse({ error: "Projeto ou cliente não encontrado" }, 404);
    }
    if (project.client_id !== client.id) {
      return jsonResponse({ error: "Projeto não pertence a este cliente" }, 400);
    }

    const mix = parseMix(body.mix);
    const count = Math.max(3, Math.min(14, Math.round(body.count ?? 7)));
    const distribution = mixCounts(mix, count);
    const allowed = (body.allowedFormats ?? []).filter((item) => FORMAT_SET.has(item));
    const formats = allowed.length ? allowed : (["reels", "carousel", "static_feed", "stories"] as ContentFormat[]);
    const defaultFormat = formats[0] ?? "reels";

    const [creators, winningPosts, web] = await Promise.all([
      loadReferenceCreators(supabase, body.clientId),
      loadWinningPosts(supabase, body.projectId),
      body.webSearch
        ? searchWeb(`${client.name} ${body.prompt?.trim() || project.name} ideias de conteúdo`)
        : Promise.resolve({ sources: [], unavailable: false }),
    ]);

    const brandGuide =
      typeof brandBriefing?.guide_markdown === "string"
        ? brandBriefing.guide_markdown.trim().slice(0, 12000)
        : "";
    const brandGuidance =
      typeof (client as { brand_guidance?: unknown }).brand_guidance === "string"
        ? String((client as { brand_guidance: string }).brand_guidance).trim().slice(0, 2000)
        : "";
    const answers = brandBriefing?.answers;
    const pillars =
      answers && typeof answers === "object" && !Array.isArray(answers)
        ? asString((answers as Record<string, unknown>).s7_q1)
        : "";

    const systemPrompt = [
      "Você é estrategista de conteúdo para agências. Gere um lote de ideias prontas para o calendário editorial.",
      languageInstruction(body.locale),
      "Responda APENAS com JSON válido: {\"ideas\":[{\"title\":\"...\",\"format\":\"reels|carousel|static_feed|stories|recorded_video|youtube_short\",\"funnelStage\":\"tofu|mofu|bofu\",\"hook\":\"...\",\"why\":\"...\",\"theme\":null}]}",
      "Regras:",
      "- title: curto, operacional, para o card do calendário.",
      "- format: só use um dos formatos permitidos.",
      "- funnelStage: tofu = atração/descoberta; mofu = autoridade/consideração; bofu = oferta/conversão.",
      "- hook: gancho de 1 frase.",
      "- why: por que essa ideia serve esta marca agora (1 frase).",
      "- theme: um dos temas cadastrados, ou null.",
      "Não invente fatos. Não copie criadores de referência; adapte o padrão.",
    ].join("\n");

    const userPrompt = [
      `Cliente: ${client.name}`,
      `Projeto: ${project.name}`,
      project.description ? `Descrição: ${project.description}` : null,
      brandGuidance ? `Orientações gerais:\n${brandGuidance}` : null,
      brandGuide ? `Guia de marca:\n${brandGuide}` : null,
      pillars ? `Pilares de conteúdo (briefing):\n${pillars}` : null,
      formatReferenceCreatorsBlock(creators),
      formatWinningPostsBlock(winningPosts),
      `Temas disponíveis: ${(project.theme_presets ?? []).join(" | ") || "(nenhum)"}`,
      `Formatos permitidos: ${formats.join(", ")}`,
      `Quantidade: ${count} ideias`,
      `Mix alvo: TOFU ${distribution.tofu} · MOFU ${distribution.mofu} · BOFU ${distribution.bofu} (respeite essa distribuição)`,
      body.prompt?.trim() ? `Pedido extra do gestor:\n${body.prompt.trim()}` : null,
      formatWebSourcesBlock(web.sources),
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
        temperature: 0.8,
        fallbackMessage: "Falha ao gerar ideias com a IA",
        geminiKey,
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

    const rawIdeas = Array.isArray(parsed.ideas) ? parsed.ideas : [];
    const ideas: ContentIdea[] = rawIdeas
      .filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === "object")
      .slice(0, count)
      .map((item, index) => {
        const stageFallback: FunnelStage =
          index < distribution.tofu ? "tofu" : index < distribution.tofu + distribution.mofu ? "mofu" : "bofu";
        const theme = asString(item.theme);
        return {
          title: asString(item.title) || `Ideia ${index + 1}`,
          format: parseFormat(item.format, defaultFormat),
          funnelStage: parseStage(item.funnelStage ?? item.funnel_stage, stageFallback),
          hook: asString(item.hook),
          why: asString(item.why),
          theme: theme || null,
        };
      });

    if (!ideas.length) {
      return jsonResponse({ error: "A IA não devolveu ideias utilizáveis" }, 502);
    }

    return jsonResponse({
      ideas,
      mix,
      sources: web.sources,
      webSearchUnavailable: Boolean(body.webSearch && web.unavailable),
    });
  } catch (error) {
    console.error(error);
    return jsonResponse(
      { error: error instanceof Error ? error.message : "Erro interno" },
      500,
    );
  }
});
