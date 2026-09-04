import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { resolveAiKeyWithBudget, resolvedKeyError } from "../_shared/admin-ai-keys.ts";
import {
  DOCUMENT_MAX_BYTES,
  extractDocumentText,
} from "../_shared/extract-document-text.ts";

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type ContentFormat =
  | "static_feed"
  | "reels"
  | "stories"
  | "carousel"
  | "recorded_video"
  | "youtube_short"
  | "print_material";

type SuggestRequest = {
  contentId: string;
  projectId: string;
  clientId: string;
  prompt: string;
  references?: string;
  youtubeUrls?: string[];
  instagramUrls?: string[];
  transcription?: string;
  libraryAssetId?: string;
  documentUrl?: string;
  documentName?: string;
  format?: ContentFormat;
  locale?: string;
};

type ContentSuggestion = {
  title: string;
  caption: string;
  cta: string;
  hashtags: string;
  theme: string | null;
  locucao: string;
  roteiro: string;
};

type VideoMeta = {
  url: string;
  title: string;
  description: string;
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function extractYoutubeId(raw: string): string | null {
  try {
    const url = new URL(raw.trim());
    const host = url.hostname.replace(/^www\./, "");
    if (host === "youtu.be") {
      const id = url.pathname.split("/").filter(Boolean)[0];
      return id || null;
    }
    if (host === "youtube.com" || host === "m.youtube.com" || host === "music.youtube.com") {
      if (url.pathname === "/watch") return url.searchParams.get("v");
      const parts = url.pathname.split("/").filter(Boolean);
      if (parts[0] === "shorts" || parts[0] === "embed" || parts[0] === "live") {
        return parts[1] || null;
      }
    }
  } catch {
    return null;
  }
  return null;
}

async function fetchYoutubeMeta(url: string): Promise<VideoMeta> {
  const id = extractYoutubeId(url);
  const fallback: VideoMeta = { url, title: "", description: "" };
  if (!id) return fallback;

  try {
    const oembedUrl = `https://www.youtube.com/oembed?url=${encodeURIComponent(`https://www.youtube.com/watch?v=${id}`)}&format=json`;
    const res = await fetch(oembedUrl);
    if (!res.ok) return fallback;
    const data = (await res.json()) as { title?: string; author_name?: string };
    return {
      url,
      title: data.title?.trim() || "",
      description: data.author_name ? `Canal: ${data.author_name}` : "",
    };
  } catch {
    return fallback;
  }
}

function isInstagramUrl(raw: string): boolean {
  try {
    const url = new URL(raw.trim());
    const host = url.hostname.replace(/^www\./, "");
    return host === "instagram.com" || host === "instagr.am";
  } catch {
    return false;
  }
}

async function fetchInstagramMeta(url: string): Promise<VideoMeta> {
  const fallback: VideoMeta = { url, title: "", description: "" };
  if (!isInstagramUrl(url)) return fallback;

  try {
    const oembedUrl = `https://graph.facebook.com/v25.0/instagram_oembed?url=${encodeURIComponent(url.trim())}`;
    const res = await fetch(oembedUrl);
    if (!res.ok) return fallback;
    const data = (await res.json()) as { title?: string; author_name?: string };
    return {
      url,
      title: data.title?.trim() || "",
      description: data.author_name ? `Autor: ${data.author_name}` : "",
    };
  } catch {
    return fallback;
  }
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

function formatVideoMetasBlock(label: string, metas: VideoMeta[]): string | null {
  if (!metas.length) return null;
  return `${label}\n${metas
    .map((v, i) => `${i + 1}. ${v.url}\n   Título: ${v.title || "(indisponível)"}\n   ${v.description || ""}`)
    .join("\n")}`;
}

function languageInstruction(locale?: string): string {
  const lower = (locale ?? "pt-BR").toLowerCase();
  if (lower.startsWith("en")) return "Generate all copy in English (US).";
  if (lower.startsWith("es")) return "Genera todos los textos en español.";
  return "Gere textos em português do Brasil.";
}

function sanitizeSuggestion(raw: Record<string, unknown>, format: ContentFormat): ContentSuggestion {
  const asString = (value: unknown) => (typeof value === "string" ? value.trim() : "");
  const themeRaw = asString(raw.theme);
  return {
    title: asString(raw.title) || "Sem título",
    caption: asString(raw.caption),
    cta: asString(raw.cta),
    hashtags: asString(raw.hashtags),
    theme: themeRaw || null,
    locucao: format === "reels" || format === "recorded_video" || format === "youtube_short" ? asString(raw.locucao) : "",
    roteiro: format === "carousel" ? asString(raw.roteiro) : "",
  };
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

async function callChatModel(
  messages: Array<{ role: string; content: string }>,
  openaiKey: string | null,
) {
  // Prefer the admin's own OpenAI key so each manager pays for their usage.
  if (openaiKey) {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${openaiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: Deno.env.get("OPENAI_MODEL") || "gpt-4o-mini",
        temperature: 0.7,
        response_format: { type: "json_object" },
        messages,
      }),
    });
    return { provider: "openai" as const, res };
  }

  const lovableKey = Deno.env.get("LOVABLE_API_KEY");
  if (lovableKey) {
    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Lovable-API-Key": lovableKey,
        "X-Lovable-AIG-SDK": "vercel-ai-sdk",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: Deno.env.get("AI_MODEL") || Deno.env.get("LOVABLE_AI_MODEL") || "openai/gpt-5.4-mini",
        temperature: 0.7,
        response_format: { type: "json_object" },
        messages,
      }),
    });
    return { provider: "lovable" as const, res };
  }

  return null;
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

    const { apiKey: openaiKey, source } = serviceRoleKey
      ? await resolveAiKeyWithBudget(createClient(supabaseUrl, serviceRoleKey), user.id, "openai")
      : { apiKey: null as string | null, source: "none" as const };
    if (source === "quota") {
      return jsonResponse({ error: resolvedKeyError({ apiKey: null, source }, "openai") }, 400);
    }
    if (!openaiKey && !Deno.env.get("LOVABLE_API_KEY")) {
      return jsonResponse(
        { error: resolvedKeyError({ apiKey: openaiKey, source }, "openai") ?? "Configure sua chave de IA." },
        400,
      );
    }

    const body = (await req.json()) as SuggestRequest;
    const prompt = body.prompt?.trim() ?? "";
    if (!prompt) {
      return jsonResponse({ error: "Informe um prompt" }, 400);
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
        .select("guide_markdown, status")
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
    const youtubeUrls = (body.youtubeUrls ?? [])
      .map((u) => u.trim())
      .filter(Boolean)
      .slice(0, 5);
    const instagramUrls = (body.instagramUrls ?? [])
      .map((u) => u.trim())
      .filter(Boolean)
      .slice(0, 5);
    const transcription = (body.transcription ?? "").trim().slice(0, 12000);
    let attachedDocument: { name: string; text: string; truncated: boolean } | null = null;
    try {
      attachedDocument = await loadAttachedDocument({
        body,
        supabase,
        serviceRoleKey,
        supabaseUrl,
      });
    } catch (error) {
      return jsonResponse(
        { error: error instanceof Error ? error.message : "Falha ao ler o documento anexado." },
        400,
      );
    }
    const [youtubeMetas, instagramMetas] = await Promise.all([
      Promise.all(youtubeUrls.map((url) => fetchYoutubeMeta(url))),
      Promise.all(instagramUrls.map((url) => fetchInstagramMeta(url))),
    ]);
    const documentBlock = attachedDocument
      ? `Documento de base (${attachedDocument.name}${attachedDocument.truncated ? ", trecho inicial" : ""}):\n${attachedDocument.text}`
      : null;

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

    const systemPrompt = [
      "Você é um copywriter de Instagram para agências de marca.",
      languageInstruction(body.locale),
      "When there is a Brand guide, treat it as the priority source for voice, audience, pillars and ethical limits.",
      "When there are brand kit guidelines (orientações gerais), treat them as mandatory operational rules for every text.",
      "When there is an attached source document, use it as the factual base for the copy. Do not invent names, numbers or claims that are not in that document.",
      "Responda APENAS com JSON válido (sem markdown) no formato:",
      '{"title":"...","caption":"...","cta":"...","hashtags":"...","theme":"...|null","locucao":"...","roteiro":"..."}',
      "Regras:",
      "- title: curto, interno, para organização da equipe.",
      "- caption: legenda pronta para publicar.",
      "- cta: preferir um dos CTAs cadastrados quando fizer sentido.",
      "- hashtags: preferir hashtags cadastradas; espaço entre tags; começar com #.",
      "- theme: usar um tema da lista de presets se couber; senão null.",
      needsLocucao
        ? "- locucao: roteiro falado completo para gravação (Reels/vídeo)."
        : "- locucao: string vazia.",
      needsRoteiro
        ? "- roteiro: texto por slide no formato 'Slide 1: ...\\nSlide 2: ...' (mínimo 3 slides)."
        : "- roteiro: string vazia.",
      "Não invente fatos que não estejam no Guia de marca, prompt, referências, documento anexado, metadados dos vídeos ou na transcrição fornecida.",
    ].join("\n");

    const userPrompt = [
      `Cliente: ${clientRow.name}`,
      `Projeto: ${project.name}`,
      project.description ? `Descrição do projeto: ${project.description}` : null,
      brandGuidance ? `Orientações gerais da marca (obrigatórias):\n${brandGuidance}` : null,
      brandGuide ? `Guia de marca:\n${brandGuide}` : null,
      `Formato do post: ${format}`,
      content.theme ? `Tema atual: ${content.theme}` : null,
      `Temas disponíveis: ${(project.theme_presets ?? []).join(" | ") || "(nenhum)"}`,
      `CTAs disponíveis: ${(project.cta_presets ?? []).join(" | ") || "(nenhum)"}`,
      `Hashtags disponíveis: ${(project.hashtag_presets ?? []).join(" | ") || "(nenhuma)"}`,
      `Prompt do admin:\n${prompt}`,
      documentBlock,
      body.references?.trim() ? `Referências:\n${body.references.trim()}` : null,
      formatVideoMetasBlock("Vídeos do YouTube (metadados):", youtubeMetas),
      formatVideoMetasBlock("Vídeos do Instagram (metadados):", instagramMetas),
      transcription ? `Transcrição fornecida pelo usuário:\n${transcription}` : null,
    ]
      .filter(Boolean)
      .join("\n\n");

    const chat = await callChatModel(
      [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      openaiKey,
    );
    if (!chat) {
      return jsonResponse(
        {
          error:
            "Configure sua OPENAI API key em Configurações → Chaves de IA, ou use o fallback da plataforma.",
        },
        400,
      );
    }

    if (!chat.res.ok) {
      const errText = await chat.res.text();
      console.error(`${chat.provider} AI error:`, chat.res.status, errText);
      if (chat.res.status === 402) {
        return jsonResponse(
          { error: "Créditos de IA esgotados. Recarregue em Settings → Plans & credit usage." },
          402,
        );
      }
      if (chat.res.status === 429) {
        return jsonResponse({ error: "Limite de requisições da IA atingido. Tente de novo em instantes." }, 429);
      }
      return jsonResponse({ error: "Falha ao gerar sugestão com a IA" }, 502);
    }

    const chatJson = (await chat.res.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const contentText = chatJson.choices?.[0]?.message?.content ?? "";
    let parsed: Record<string, unknown>;
    try {
      parsed = extractJsonObject(contentText);
    } catch {
      return jsonResponse({ error: "Resposta da IA inválida" }, 502);
    }

    const suggestion = sanitizeSuggestion(parsed, format);
    return jsonResponse({ suggestion, youtube: youtubeMetas, instagram: instagramMetas });
  } catch (error) {
    console.error(error);
    return jsonResponse(
      { error: error instanceof Error ? error.message : "Erro interno" },
      500,
    );
  }
});
