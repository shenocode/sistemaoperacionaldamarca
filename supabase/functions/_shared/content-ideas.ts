import { completeChatJson, type KeySource } from "./chat-completions.ts";
import {
  formatReferenceCreatorsBlock,
  formatWinningPostsBlock,
  loadReferenceCreators,
  loadWinningPosts,
} from "./brand-strategy-context.ts";
import { asString, extractJsonObject } from "./json-extract.ts";
import { languageInstruction } from "./language.ts";
import { formatWebSourcesBlock, searchWeb } from "./web-search.ts";

export type IdeasContentFormat =
  | "static_feed"
  | "reels"
  | "stories"
  | "carousel"
  | "recorded_video"
  | "youtube_short";

export type FunnelStage = "tofu" | "mofu" | "bofu";
export type ContentMix = { tofu: number; mofu: number; bofu: number };

export type IdeasRequest = {
  projectId?: string;
  clientId?: string;
  mix?: Partial<ContentMix>;
  count?: number;
  prompt?: string;
  locale?: string;
  webSearch?: boolean;
  allowedFormats?: IdeasContentFormat[];
};

export type ContentIdea = {
  title: string;
  format: IdeasContentFormat;
  funnelStage: FunnelStage;
  hook: string;
  why: string;
  theme: string | null;
};

export type IdeasOk = {
  ok: true;
  ideas: ContentIdea[];
  mix: ContentMix;
  sources: { title: string; url: string; snippet: string }[];
  webSearchUnavailable: boolean;
};

export type IdeasFail = { ok: false; status: number; error: string };

const FORMAT_SET = new Set<IdeasContentFormat>([
  "static_feed",
  "reels",
  "stories",
  "carousel",
  "recorded_video",
  "youtube_short",
]);

function clampPercent(value: unknown, fallback: number): number {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(0, Math.min(100, Math.round(n)));
}

export function parseMix(raw: Partial<ContentMix> | undefined): ContentMix {
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

function parseFormat(value: unknown, fallback: IdeasContentFormat): IdeasContentFormat {
  return typeof value === "string" && FORMAT_SET.has(value as IdeasContentFormat)
    ? (value as IdeasContentFormat)
    : fallback;
}

function parseStage(value: unknown, fallback: FunnelStage): FunnelStage {
  return value === "tofu" || value === "mofu" || value === "bofu" ? value : fallback;
}

export async function generateCalendarIdeas(input: {
  // deno-lint-ignore no-explicit-any
  supabase: any;
  body: IdeasRequest;
  openaiKey: string | null;
  keySource: KeySource;
  geminiKey: string | null;
  preferredProvider: "openai" | "gemini";
}): Promise<IdeasOk | IdeasFail> {
  const { supabase, body, openaiKey, keySource, geminiKey, preferredProvider } = input;
  if (!body.projectId || !body.clientId) {
    return { ok: false, status: 400, error: "Parâmetros inválidos" };
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

  if (projectError) return { ok: false, status: 500, error: projectError.message };
  if (clientError && !/brand_guidance/i.test(clientError.message)) {
    return { ok: false, status: 500, error: clientError.message };
  }
  if (brandBriefingError) return { ok: false, status: 500, error: brandBriefingError.message };
  if (!project || !client) {
    return { ok: false, status: 404, error: "Projeto ou cliente não encontrado" };
  }
  if (project.client_id !== client.id) {
    return { ok: false, status: 400, error: "Projeto não pertence a este cliente" };
  }

  const mix = parseMix(body.mix);
  const count = Math.max(3, Math.min(14, Math.round(body.count ?? 7)));
  const distribution = mixCounts(mix, count);
  const allowed = (body.allowedFormats ?? []).filter((item) => FORMAT_SET.has(item));
  const formats = allowed.length ? allowed : (["reels", "carousel", "static_feed", "stories"] as IdeasContentFormat[]);
  const defaultFormat = formats[0] ?? "reels";

  const [creators, winningPosts, web] = await Promise.all([
    loadReferenceCreators(supabase, body.clientId),
    loadWinningPosts(supabase, body.projectId),
    body.webSearch
      ? searchWeb(`${asString(client.name)} ${body.prompt?.trim() || asString(project.name)} ideias de conteúdo`)
      : Promise.resolve({ sources: [], unavailable: false }),
  ]);

  const brandGuide =
    typeof brandBriefing?.guide_markdown === "string"
      ? brandBriefing.guide_markdown.trim().slice(0, 12000)
      : "";
  const brandGuidance =
    typeof client.brand_guidance === "string" ? client.brand_guidance.trim().slice(0, 2000) : "";
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
    `Cliente: ${asString(client.name)}`,
    `Projeto: ${asString(project.name)}`,
    asString(project.description) ? `Descrição: ${asString(project.description)}` : null,
    brandGuidance ? `Orientações gerais:\n${brandGuidance}` : null,
    brandGuide ? `Guia de marca:\n${brandGuide}` : null,
    pillars ? `Pilares de conteúdo (briefing):\n${pillars}` : null,
    formatReferenceCreatorsBlock(creators),
    formatWinningPostsBlock(winningPosts),
    `Temas disponíveis: ${
      Array.isArray(project.theme_presets) ? project.theme_presets.join(" | ") : "(nenhum)"
    }`,
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
  if (!chat.ok) return { ok: false, status: chat.status, error: chat.error };

  const contentText = chat.json.choices?.[0]?.message?.content ?? "";
  let parsed: Record<string, unknown>;
  try {
    parsed = extractJsonObject(contentText);
  } catch {
    return { ok: false, status: 502, error: "Resposta da IA inválida" };
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
    return { ok: false, status: 502, error: "A IA não devolveu ideias utilizáveis" };
  }

  return {
    ok: true,
    ideas,
    mix,
    sources: web.sources,
    webSearchUnavailable: Boolean(body.webSearch && web.unavailable),
  };
}
