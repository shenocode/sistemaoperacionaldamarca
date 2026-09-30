import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { resolveAiKey, resolveAiKeyWithBudget, resolvedKeyError } from "../_shared/admin-ai-keys.ts";
import { completeChatJson } from "../_shared/chat-completions.ts";
import {
  DOCUMENT_MAX_BYTES,
  extractDocumentText,
} from "../_shared/extract-document-text.ts";
import { asString, extractJsonObject } from "../_shared/json-extract.ts";
import { languageInstruction } from "../_shared/language.ts";
import { locucaoFromSuggestionFields } from "../_shared/locucao-script.ts";
import {
  formatReferenceCreatorsBlock,
  formatWinningPostsBlock,
  loadReferenceCreators,
  loadWinningPosts,
} from "../_shared/brand-strategy-context.ts";
import {
  extractYoutubeId,
  fetchInstagramMeta,
  fetchPublicProfileMeta,
  fetchTikTokMeta,
  fetchYoutubeMeta,
  formatVideoMetasBlock,
  isInstagramUrl,
  isTikTokUrl,
} from "../_shared/video-meta.ts";
import { generateCalendarIdeas, type IdeasRequest } from "../_shared/content-ideas.ts";
import { formatWebSourcesBlock, searchWeb, type WebSource } from "../_shared/web-search.ts";

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-api-version, x-region",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

type ContentFormat =
  | "static_feed"
  | "reels"
  | "stories"
  | "carousel"
  | "recorded_video"
  | "youtube_short"
  | "print_material";

type ContentSuggestion = {
  title: string;
  caption: string;
  cta: string;
  hashtags: string;
  theme: string | null;
  locucao: string;
  locucaoHook: string;
  locucaoBody: string;
  locucaoCta: string;
  roteiro: string;
};

type SuggestRequest = {
  contentId: string;
  projectId: string;
  clientId: string;
  prompt: string;
  references?: string;
  youtubeUrls?: string[];
  instagramUrls?: string[];
  tiktokUrls?: string[];
  transcription?: string;
  libraryAssetIds?: string[];
  libraryAssetId?: string;
  documentUrl?: string;
  documentName?: string;
  format?: ContentFormat;
  locale?: string;
  provider?: "openai" | "gemini";
  webSearch?: boolean;
  mode?: "generate" | "refine" | "ideas";
  refineInstruction?: string;
  currentDraft?: Partial<ContentSuggestion>;
  mix?: IdeasRequest["mix"];
  count?: number;
  allowedFormats?: IdeasRequest["allowedFormats"];
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

const LIBRARY_BUCKET = "library-assets";
const CONTENT_MEDIA_BUCKET = "content-media";

function bytesFromBlob(blob: Blob): Promise<Uint8Array> {
  return blob.arrayBuffer().then((buffer) => new Uint8Array(buffer));
}

function isAllowedDocumentUrl(
  raw: string,
  supabaseUrl: string,
  clientId: string,
  projectId: string,
): boolean {
  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    return false;
  }
  let origin: string;
  try {
    origin = new URL(supabaseUrl).origin;
  } catch {
    return false;
  }
  if (parsed.origin !== origin) return false;
  const path = decodeURIComponent(parsed.pathname);
  const libraryPrefix = `/storage/v1/object/public/${LIBRARY_BUCKET}/${clientId}/`;
  const mediaPrefix = `/storage/v1/object/public/${CONTENT_MEDIA_BUCKET}/${projectId}/`;
  return path.includes(libraryPrefix) || path.includes(mediaPrefix);
}

async function fetchDocumentBytes(url: string): Promise<{ bytes: Uint8Array; mimeType: string | null }> {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error("Não foi possível baixar o documento anexado.");
  }
  const length = Number(res.headers.get("content-length") || "0");
  if (length > DOCUMENT_MAX_BYTES) {
    throw new Error("O arquivo deve ter no máximo 10 MB para o assistente.");
  }
  const bytes = new Uint8Array(await res.arrayBuffer());
  if (bytes.byteLength > DOCUMENT_MAX_BYTES) {
    throw new Error("O arquivo deve ter no máximo 10 MB para o assistente.");
  }
  const mimeType = res.headers.get("content-type")?.split(";")[0]?.trim() || null;
  return { bytes, mimeType };
}

async function loadAttachedDocument(input: {
  body: SuggestRequest;
  supabase: ReturnType<typeof createClient>;
  serviceRoleKey: string | undefined;
  supabaseUrl: string;
}): Promise<{ name: string; text: string; truncated: boolean } | null> {
  const libraryAssetId = input.body.libraryAssetId?.trim();
  const documentUrl = input.body.documentUrl?.trim();
  if (!libraryAssetId && !documentUrl) return null;

  if (libraryAssetId) {
    const { data: asset, error } = await input.supabase
      .from("library_assets")
      .select("id, client_id, name, file_name, file_url, storage_path, mime_type")
      .eq("id", libraryAssetId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!asset || asset.client_id !== input.body.clientId) {
      throw new Error("Documento da biblioteca não encontrado.");
    }

    const fileName = (asset.file_name || asset.name || "documento").trim();
    let bytes: Uint8Array | null = null;
    let mimeType = typeof asset.mime_type === "string" ? asset.mime_type : null;

    if (asset.storage_path && input.serviceRoleKey) {
      const admin = createClient(input.supabaseUrl, input.serviceRoleKey);
      const downloaded = await admin.storage.from(LIBRARY_BUCKET).download(asset.storage_path);
      if (!downloaded.error && downloaded.data) {
        bytes = await bytesFromBlob(downloaded.data);
      }
    }
    if (!bytes && asset.file_url) {
      const fetched = await fetchDocumentBytes(asset.file_url);
      bytes = fetched.bytes;
      mimeType = mimeType || fetched.mimeType;
    }
    if (!bytes) {
      throw new Error("Não foi possível abrir o documento da biblioteca.");
    }

    const extracted = await extractDocumentText({ bytes, fileName, mimeType });
    return { name: fileName, text: extracted.text, truncated: extracted.truncated };
  }

  if (
    !isAllowedDocumentUrl(documentUrl!, input.supabaseUrl, input.body.clientId, input.body.projectId)
  ) {
    throw new Error("URL de documento inválida.");
  }
  const fileName = (input.body.documentName || documentUrl!.split("/").pop() || "documento")
    .split("?")[0];
  const fetched = await fetchDocumentBytes(documentUrl!);
  const extracted = await extractDocumentText({
    bytes: fetched.bytes,
    fileName,
    mimeType: fetched.mimeType,
  });
  return { name: fileName, text: extracted.text, truncated: extracted.truncated };
}

const LIBRARY_REFERENCE_MAX = 8;
const DOCUMENT_LIKE_CATEGORIES = new Set(["pdfs", "documents", "spreadsheets", "brand"]);
const DOCUMENT_EXT = /\.(pdf|txt|md|csv|docx?|xlsx?|rtf)\b/i;
const DOCUMENT_MIME =
  /(pdf|wordprocessingml|spreadsheetml|msword|ms-excel|text\/plain|text\/csv|text\/markdown|rtf)/i;

type LibraryAssetRow = {
  id: string;
  client_id: string;
  name: string;
  category: string | null;
  file_name: string | null;
  file_url: string | null;
  storage_path: string | null;
  mime_type: string | null;
  notes: string | null;
};

function isDocumentLikeAsset(asset: LibraryAssetRow): boolean {
  if (asset.category && DOCUMENT_LIKE_CATEGORIES.has(asset.category)) return true;
  const hay = `${asset.file_name ?? ""} ${asset.name ?? ""} ${asset.file_url ?? ""} ${asset.mime_type ?? ""}`;
  return DOCUMENT_EXT.test(hay) || DOCUMENT_MIME.test(hay);
}

async function extractLibraryDocument(
  asset: LibraryAssetRow,
  input: {
    serviceRoleKey: string | undefined;
    supabaseUrl: string;
  },
): Promise<{ name: string; text: string; truncated: boolean }> {
  const fileName = (asset.file_name || asset.name || "documento").trim();
  let bytes: Uint8Array | null = null;
  let mimeType = typeof asset.mime_type === "string" ? asset.mime_type : null;

  if (asset.storage_path && input.serviceRoleKey) {
    const admin = createClient(input.supabaseUrl, input.serviceRoleKey);
    const downloaded = await admin.storage.from(LIBRARY_BUCKET).download(asset.storage_path);
    if (!downloaded.error && downloaded.data) {
      bytes = await bytesFromBlob(downloaded.data);
    }
  }
  if (!bytes && asset.file_url) {
    const fetched = await fetchDocumentBytes(asset.file_url);
    bytes = fetched.bytes;
    mimeType = mimeType || fetched.mimeType;
  }
  if (!bytes) {
    throw new Error(`Não foi possível abrir o documento "${fileName}" da biblioteca.`);
  }

  const extracted = await extractDocumentText({ bytes, fileName, mimeType });
  return { name: fileName, text: extracted.text, truncated: extracted.truncated };
}

async function loadLibraryReferenceBlocks(input: {
  body: SuggestRequest;
  supabase: ReturnType<typeof createClient>;
  serviceRoleKey: string | undefined;
  supabaseUrl: string;
}): Promise<{
  blocks: string[];
  youtubeUrls: string[];
  instagramUrls: string[];
  tiktokUrls: string[];
  /** True when at least one selected asset contributed usable text (doc or page excerpt). */
  hasRichSourceText: boolean;
  /** Count of selected library assets actually considered (excluding generated_arts). */
  selectedCount: number;
}> {
  const ids = [
    ...new Set((input.body.libraryAssetIds ?? []).map((id) => id.trim()).filter(Boolean)),
  ].slice(0, LIBRARY_REFERENCE_MAX);

  if (ids.length === 0) {
    return {
      blocks: [],
      youtubeUrls: [],
      instagramUrls: [],
      tiktokUrls: [],
      hasRichSourceText: false,
      selectedCount: 0,
    };
  }

  const { data, error } = await input.supabase
    .from("library_assets")
    .select("id, client_id, name, category, file_name, file_url, storage_path, mime_type, notes")
    .in("id", ids);
  if (error) throw new Error(error.message);

  const byId = new Map((data ?? []).map((row) => [row.id as string, row as LibraryAssetRow]));
  const blocks: string[] = [];
  const youtubeUrls: string[] = [];
  const instagramUrls: string[] = [];
  const tiktokUrls: string[] = [];
  let hasRichSourceText = false;
  let selectedCount = 0;

  for (const id of ids) {
    const asset = byId.get(id);
    if (!asset || asset.client_id !== input.body.clientId) {
      throw new Error("Referência da biblioteca não encontrada.");
    }
    if (asset.category === "generated_arts") continue;
    selectedCount += 1;

    const label = (asset.name || asset.file_name || "Referência").trim();
    const notes = typeof asset.notes === "string" ? asset.notes.trim() : "";
    const url = typeof asset.file_url === "string" ? asset.file_url.trim() : "";

    if (asset.category === "references" && url) {
      if (extractYoutubeId(url) || url.includes("youtube.com") || url.includes("youtu.be")) {
        youtubeUrls.push(url);
        continue;
      }
      if (isInstagramUrl(url)) {
        instagramUrls.push(url);
        continue;
      }
      if (isTikTokUrl(url)) {
        tiktokUrls.push(url);
        continue;
      }
      const meta = await fetchPublicProfileMeta(url);
      if (meta.title || meta.description) hasRichSourceText = true;
      blocks.push(
        [
          `Referência URL: ${label}`,
          `URL: ${url}`,
          meta.title ? `Título: ${meta.title}` : null,
          meta.description ? `Conteúdo / resumo da página:\n${meta.description}` : null,
          notes ? `Notas: ${notes}` : null,
          !meta.title && !meta.description
            ? "Aviso: não foi possível extrair o texto desta URL. Use só o nome/URL ou peça transcrição no prompt."
            : null,
        ]
          .filter(Boolean)
          .join("\n"),
      );
      continue;
    }

    if (isDocumentLikeAsset(asset)) {
      const doc = await extractLibraryDocument(asset, input);
      if (doc.text.trim()) hasRichSourceText = true;
      blocks.push(
        `Documento (${doc.name}${doc.truncated ? ", trecho inicial" : ""}):\n${doc.text}`,
      );
      continue;
    }

    if (asset.category === "videos") {
      blocks.push(
        [
          `Vídeo da biblioteca: ${label}`,
          url ? `URL: ${url}` : null,
          notes ? `Notas: ${notes}` : null,
          "Sem transcrição automática — use o campo Transcrição se precisar do conteúdo falado.",
        ]
          .filter(Boolean)
          .join("\n"),
      );
      continue;
    }

    if (asset.category === "images") {
      blocks.push(
        [
          `Imagem da biblioteca: ${label}`,
          url ? `URL: ${url}` : null,
          notes ? `Notas: ${notes}` : null,
          "A IA não analisa pixels da imagem — use só o nome/notas ou descreva o conteúdo no prompt.",
        ]
          .filter(Boolean)
          .join("\n"),
      );
      continue;
    }

    blocks.push(
      [
        `Referência da biblioteca: ${label}`,
        asset.category ? `Categoria: ${asset.category}` : null,
        url ? `URL: ${url}` : null,
        notes ? `Notas: ${notes}` : null,
      ]
        .filter(Boolean)
        .join("\n"),
    );
  }

  return { blocks, youtubeUrls, instagramUrls, tiktokUrls, hasRichSourceText, selectedCount };
}

function sanitizeSuggestion(raw: Record<string, unknown>, format: ContentFormat): ContentSuggestion {
  const themeRaw = asString(raw.theme);
  const needsLocucao = format === "reels" || format === "recorded_video" || format === "youtube_short";
  const locucao = needsLocucao
    ? locucaoFromSuggestionFields(raw, asString(raw.locucao))
    : "";
  const hook = asString(raw.locucao_hook);
  const body = asString(raw.locucao_body);
  const ctaLine = asString(raw.locucao_cta);
  return {
    title: asString(raw.title) || "Sem título",
    caption: asString(raw.caption),
    cta: asString(raw.cta),
    hashtags: asString(raw.hashtags),
    theme: themeRaw || null,
    locucao,
    locucaoHook: needsLocucao ? hook : "",
    locucaoBody: needsLocucao ? body : "",
    locucaoCta: needsLocucao ? ctaLine : "",
    roteiro: format === "carousel" ? asString(raw.roteiro) : "",
  };
}

function clipUrls(list: string[] | undefined): string[] {
  return (list ?? []).map((u) => u.trim()).filter(Boolean).slice(0, 5);
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

    const { data: isAdmin, error: adminError } = await supabase.rpc("is_admin");
    if (adminError) {
      return jsonResponse({ error: adminError.message }, 500);
    }
    if (!isAdmin) {
      return jsonResponse({ error: "Apenas administradores podem usar o assistente" }, 403);
    }

    const adminClient = serviceRoleKey ? createClient(supabaseUrl, serviceRoleKey) : null;
    const body = (await req.json()) as SuggestRequest;
    const preferredProvider = body.provider === "gemini" ? "gemini" : "openai";
    const mode = body.mode === "refine" ? "refine" : body.mode === "ideas" ? "ideas" : "generate";

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
        return jsonResponse(
          { error: "Salve sua chave OpenAI em Configurações → Chaves de IA." },
          400,
        );
      }
    }
    if (mode === "ideas") {
      const ideas = await generateCalendarIdeas({
        supabase,
        body,
        openaiKey,
        keySource,
        geminiKey,
        preferredProvider,
      });
      if (!ideas.ok) return jsonResponse({ error: ideas.error }, ideas.status);
      return jsonResponse({
        ideas: ideas.ideas,
        mix: ideas.mix,
        sources: ideas.sources,
        webSearchUnavailable: ideas.webSearchUnavailable,
      });
    }

    const prompt = body.prompt?.trim() ?? "";
    const refineInstruction = body.refineInstruction?.trim() ?? "";
    if (mode === "generate" && !prompt) {
      return jsonResponse({ error: "Informe um prompt" }, 400);
    }
    if (mode === "refine" && !refineInstruction) {
      return jsonResponse({ error: "Informe o ajuste que a IA deve fazer" }, 400);
    }
    if (!body.contentId || !body.projectId || !body.clientId) {
      return jsonResponse({ error: "Parâmetros inválidos" }, 400);
    }

    const [
      { data: content, error: contentError },
      { data: project, error: projectError },
      { data: client, error: clientError },
      { data: brandBriefing, error: brandBriefingError },
    ] = await Promise.all([
      supabase.from("content_items").select("id, project_id, title, format, theme").eq("id", body.contentId).maybeSingle(),
      supabase
        .from("projects")
        .select("id, name, description, client_id, theme_presets, cta_presets, hashtag_presets")
        .eq("id", body.projectId)
        .maybeSingle(),
      supabase.from("clients").select("id, name, brand_guidance").eq("id", body.clientId).maybeSingle(),
      supabase
        .from("brand_briefings")
        .select("guide_markdown, status, answers")
        .eq("client_id", body.clientId)
        .maybeSingle(),
    ]);

    let clientRow = client as { id: string; name: string; brand_guidance?: unknown } | null;
    if (clientError && /brand_guidance/i.test(clientError.message)) {
      const retry = await supabase.from("clients").select("id, name").eq("id", body.clientId).maybeSingle();
      if (retry.error) return jsonResponse({ error: retry.error.message }, 500);
      clientRow = retry.data;
    } else if (clientError) {
      return jsonResponse({ error: clientError.message }, 500);
    }
    if (contentError) return jsonResponse({ error: contentError.message }, 500);
    if (projectError) return jsonResponse({ error: projectError.message }, 500);
    if (brandBriefingError) return jsonResponse({ error: brandBriefingError.message }, 500);
    if (!content || !project || !clientRow) {
      return jsonResponse({ error: "Conteúdo, projeto ou cliente não encontrado" }, 404);
    }
    if (content.project_id !== project.id || project.client_id !== clientRow.id) {
      return jsonResponse({ error: "Conteúdo não pertence a este projeto/cliente" }, 400);
    }

    const format = (body.format ?? content.format ?? "static_feed") as ContentFormat;
    const youtubeUrls = clipUrls(body.youtubeUrls);
    const instagramUrls = clipUrls(body.instagramUrls);
    const tiktokUrls = clipUrls(body.tiktokUrls);
    const transcription = (body.transcription ?? "").trim().slice(0, 12000);
    let attachedDocument: { name: string; text: string; truncated: boolean } | null = null;
    let libraryBlocks: string[] = [];
    let libraryHasRichSourceText = false;
    let librarySelectedCount = 0;
    try {
      const libraryRefs = await loadLibraryReferenceBlocks({
        body,
        supabase,
        serviceRoleKey,
        supabaseUrl,
      });
      libraryBlocks = libraryRefs.blocks;
      libraryHasRichSourceText = libraryRefs.hasRichSourceText;
      librarySelectedCount = libraryRefs.selectedCount;
      youtubeUrls.push(...libraryRefs.youtubeUrls);
      instagramUrls.push(...libraryRefs.instagramUrls);
      tiktokUrls.push(...libraryRefs.tiktokUrls);

      // Legacy single-document attachment (compat) when multi-select is empty.
      if (libraryBlocks.length === 0 && librarySelectedCount === 0) {
        attachedDocument = await loadAttachedDocument({
          body,
          supabase,
          serviceRoleKey,
          supabaseUrl,
        });
        if (attachedDocument?.text.trim()) libraryHasRichSourceText = true;
      }
    } catch (error) {
      return jsonResponse(
        {
          error:
            error instanceof Error
              ? error.message
              : "Falha ao ler as referências da biblioteca.",
        },
        400,
      );
    }

    const searchQuery = [prompt, refineInstruction, content.title, clientRow.name]
      .filter(Boolean)
      .join(" — ")
      .slice(0, 280);
    const webPromise = body.webSearch
      ? searchWeb(searchQuery)
      : Promise.resolve({ sources: [] as WebSource[], unavailable: false });

    const uniqueYoutube = [...new Set(youtubeUrls)].slice(0, 8);
    const uniqueInstagram = [...new Set(instagramUrls)].slice(0, 8);
    const uniqueTiktok = [...new Set(tiktokUrls)].slice(0, 8);

    const [youtubeMetas, instagramMetas, tiktokMetas, web, creators, winningPosts] = await Promise.all([
      Promise.all(uniqueYoutube.map((url) => fetchYoutubeMeta(url))),
      Promise.all(uniqueInstagram.map((url) => fetchInstagramMeta(url))),
      Promise.all(uniqueTiktok.map((url) => fetchTikTokMeta(url))),
      webPromise,
      loadReferenceCreators(supabase, body.clientId),
      loadWinningPosts(supabase, body.projectId),
    ]);
    const documentBlock = attachedDocument
      ? `Documento de base (${attachedDocument.name}${attachedDocument.truncated ? ", trecho inicial" : ""}):\n${attachedDocument.text}`
      : null;
    const libraryBlock =
      libraryBlocks.length > 0
        ? `Referências selecionadas da biblioteca:\n\n${libraryBlocks
            .map((block, index) => `${index + 1}. ${block}`)
            .join("\n\n")}`
        : null;

    const hasLibrarySelection =
      librarySelectedCount > 0 || libraryBlocks.length > 0 || Boolean(attachedDocument);
    const socialMetaHasText = [...youtubeMetas, ...instagramMetas, ...tiktokMetas].some(
      (meta) => Boolean(meta.title?.trim() || meta.description?.trim()),
    );
    const hasUsableReferenceText =
      libraryHasRichSourceText || Boolean(transcription) || socialMetaHasText;

    const needsLocucao = format === "reels" || format === "recorded_video" || format === "youtube_short";
    const needsRoteiro = format === "carousel";
    const brandGuide =
      typeof brandBriefing?.guide_markdown === "string"
        ? brandBriefing.guide_markdown.trim().slice(0, 12000)
        : "";
    const brandGuidance =
      typeof clientRow.brand_guidance === "string"
        ? clientRow.brand_guidance.trim().slice(0, 2000)
        : "";
    const webBlock = formatWebSourcesBlock(web.sources);

    const librarySourceRules = hasLibrarySelection
      ? [
          "CRITICAL — selected library references / attached source material:",
          "- The TOPIC and factual claims of the copy MUST come from those references (and the user prompt/transcription).",
          "- Do NOT invent a new theme, pillar or subject (e.g. a wellness/emotional topic) that is absent from the references, prompt and transcription.",
          "- Brand guide, brand kit, winning formats and reference creators define VOICE, style and CTA patterns — not a substitute topic when references are present.",
          hasUsableReferenceText
            ? "- Prefer paraphrasing ideas, hooks and angles already present in the extracted reference text / titles / transcription."
            : "- If references only have titles/URLs/metadata (no full text), stay tightly tied to those titles and to the admin prompt; do not invent an unrelated subject. Ask nothing — just work with what is available.",
          "- If the admin prompt asks to adapt format (e.g. carousel) but not to change the subject, keep the same subject as the references.",
        ].join("\n")
      : null;

    const systemPrompt = [
      "Você é um copywriter de Instagram e vídeos curtos para agências de marca.",
      languageInstruction(body.locale),
      "When there is a Brand guide, treat it as the priority source for voice, audience, pillars and ethical limits — unless selected library references define the topic for this specific post.",
      "When there are brand kit guidelines (orientações gerais), treat them as mandatory operational rules for every text.",
      "When there is an attached source document or selected library references, use them as the factual base and TOPIC for the copy. Do not invent names, numbers, claims or themes that are not in those materials, the prompt or the transcription.",
      librarySourceRules,
      "When there are winning formats marked to repeat, prefer those patterns (length, hook style, CTA) unless the brief contradicts them.",
      "When there are reference creators, adapt their patterns to this brand — do not copy them verbatim.",
      "Responda APENAS com JSON válido (sem markdown) no formato:",
      '{"title":"...","caption":"...","cta":"...","hashtags":"...","theme":"...|null","locucao":"...","locucao_hook":"...","locucao_body":"...","locucao_cta":"...","roteiro":"..."}',
      "Regras:",
      "- title: curto, interno, para organização da equipe.",
      "- caption: legenda pronta para publicar.",
      "- cta: preferir um dos CTAs cadastrados quando fizer sentido.",
      "- hashtags: preferir hashtags cadastradas; espaço entre tags; começar com #.",
      "- theme: usar um tema da lista de presets se couber E se alinhado às referências; senão null. Não escolha um tema de preset só porque está na lista se as referências apontam outro assunto.",
      needsLocucao
        ? "- locucao_hook: primeira frase falada (gancho de 1–2 frases). locucao_body: desenvolvimento. locucao_cta: fechamento falado. locucao: o roteiro completo no formato HOOK / CORPO / CTA."
        : "- locucao, locucao_hook, locucao_body e locucao_cta: strings vazias.",
      needsRoteiro
        ? "- roteiro: texto por slide no formato 'Slide 1: ...\\nSlide 2: ...' (mínimo 3 slides), derivado das referências/prompt — não de um tema inventado."
        : "- roteiro: string vazia.",
      webBlock
        ? "- Se usar um fato da pesquisa web, cite a fonte na caption ou na locução (nome do site). Pesquisa web NÃO substitui o tema das referências selecionadas."
        : "",
      "Não invente fatos que não estejam no Guia de marca, prompt, referências da biblioteca, documento anexado, metadados dos vídeos, transcrição ou fontes da pesquisa web.",
    ]
      .filter(Boolean)
      .join("\n");

    const draft = body.currentDraft;
    const userPrompt = [
      `Cliente: ${clientRow.name}`,
      `Projeto: ${project.name}`,
      project.description ? `Descrição do projeto: ${project.description}` : null,
      brandGuidance ? `Orientações gerais da marca (obrigatórias):\n${brandGuidance}` : null,
      brandGuide ? `Guia de marca:\n${brandGuide}` : null,
      formatReferenceCreatorsBlock(creators),
      formatWinningPostsBlock(winningPosts),
      `Formato do post: ${format}`,
      content.theme ? `Tema atual: ${content.theme}` : null,
      `Temas disponíveis: ${(project.theme_presets ?? []).join(" | ") || "(nenhum)"}`,
      `CTAs disponíveis: ${(project.cta_presets ?? []).join(" | ") || "(nenhum)"}`,
      `Hashtags disponíveis: ${(project.hashtag_presets ?? []).join(" | ") || "(nenhuma)"}`,
      prompt ? `Prompt do admin:\n${prompt}` : null,
      libraryBlock,
      documentBlock,
      body.references?.trim() ? `Referências:\n${body.references.trim()}` : null,
      formatVideoMetasBlock("Vídeos do YouTube (metadados):", youtubeMetas),
      formatVideoMetasBlock("Vídeos do Instagram (metadados):", instagramMetas),
      formatVideoMetasBlock("Vídeos do TikTok (metadados):", tiktokMetas),
      transcription ? `Transcrição fornecida pelo usuário:\n${transcription}` : null,
      webBlock,
      hasLibrarySelection
        ? [
            "Instrução obrigatória sobre as referências selecionadas:",
            "- O assunto deste post deve refletir as referências da biblioteca (e a transcrição, se houver).",
            "- Não troque o tema por um assunto genérico do guia de marca ou da lista de temas disponíveis.",
            hasUsableReferenceText
              ? "- Extraia ângulos, ideias e vocabulário do material acima."
              : "- O material pode estar incompleto (só título/URL). Ainda assim, não invente outro tema; baseie-se no que há + no prompt do admin.",
          ].join("\n")
        : null,
      mode === "refine" && draft
        ? `Rascunho atual (JSON):\n${JSON.stringify({
            title: draft.title ?? "",
            caption: draft.caption ?? "",
            cta: draft.cta ?? "",
            hashtags: draft.hashtags ?? "",
            theme: draft.theme ?? null,
            locucao: draft.locucao ?? "",
            locucao_hook: draft.locucaoHook ?? "",
            locucao_body: draft.locucaoBody ?? "",
            locucao_cta: draft.locucaoCta ?? "",
            roteiro: draft.roteiro ?? "",
          })}`
        : null,
      mode === "refine" ? `Ajuste pedido pelo gestor:\n${refineInstruction}` : null,
      mode === "refine"
        ? "Reescreva o JSON completo já com o ajuste aplicado. Preserve o que não foi pedido para mudar."
        : null,
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
        // Slightly less creative when library references define the topic.
        temperature: hasLibrarySelection ? 0.45 : 0.7,
        fallbackMessage: "Falha ao gerar sugestão com a IA",
        geminiKey,
        preferredProvider,
      },
    );
    if (!chat.ok) {
      return jsonResponse({ error: chat.error }, chat.status);
    }

    const contentText = chat.json.choices?.[0]?.message?.content ?? "";
    let parsed: Record<string, unknown>;
    try {
      parsed = extractJsonObject(contentText);
    } catch {
      return jsonResponse({ error: "Resposta da IA inválida" }, 502);
    }

    const suggestion = sanitizeSuggestion(parsed, format);
    return jsonResponse({
      suggestion,
      youtube: youtubeMetas,
      instagram: instagramMetas,
      tiktok: tiktokMetas,
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
