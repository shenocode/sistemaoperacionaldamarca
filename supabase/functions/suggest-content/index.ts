import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { resolveAiKey } from "../_shared/admin-ai-keys.ts";

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type ContentFormat =
  | "static_feed"
  | "reels"
  | "stories"
  | "carousel"
  | "recorded_video";

type SuggestRequest = {
  contentId: string;
  projectId: string;
  clientId: string;
  prompt: string;
  references?: string;
  youtubeUrls?: string[];
  instagramUrls?: string[];
  transcription?: string;
  format?: ContentFormat;
  locale?: string;
  provider?: "openai" | "gemini" | "claude";
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
    locucao: format === "reels" || format === "recorded_video" ? asString(raw.locucao) : "",
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
  options?: { preferredProvider?: "openai" | "gemini" | "claude"; geminiKey?: string | null; claudeKey?: string | null },
) {
  const preferred = options?.preferredProvider ?? "openai";
  const geminiKey = options?.geminiKey ?? null;
  const claudeKey = options?.claudeKey ?? null;

  if (preferred === "claude") {
    if (!claudeKey) return null;
    const system = messages.filter((m) => m.role === "system").map((m) => m.content).join("\n\n");
    const user = messages.filter((m) => m.role !== "system").map((m) => m.content).join("\n\n");
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": claudeKey,
        "anthropic-version": "2023-06-01",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: Deno.env.get("CLAUDE_MODEL") || Deno.env.get("ANTHROPIC_MODEL") || "claude-sonnet-4-5",
        max_tokens: 4096,
        temperature: 0.7,
        ...(system ? { system } : {}),
        messages: [{ role: "user", content: user }],
      }),
    });
    return { provider: "claude" as const, res };
  }

  if (preferred === "gemini") {
    if (!geminiKey) return null;
    const model = Deno.env.get("GEMINI_CHAT_MODEL") || Deno.env.get("GEMINI_MODEL") || "gemini-2.5-flash";
    const system = messages.filter((m) => m.role === "system").map((m) => m.content).join("\n\n");
    const user = messages.filter((m) => m.role !== "system").map((m) => m.content).join("\n\n");
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(geminiKey)}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...(system ? { systemInstruction: { parts: [{ text: system }] } } : {}),
          contents: [{ role: "user", parts: [{ text: user }] }],
          generationConfig: { temperature: 0.7, responseMimeType: "application/json" },
        }),
      },
    );
    return { provider: "gemini" as const, res };
  }

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

    const body = (await req.json()) as SuggestRequest;
    const preferredProvider =
      body.provider === "gemini" ? "gemini" : body.provider === "claude" ? "claude" : "openai";
    const adminClient = serviceRoleKey ? createClient(supabaseUrl, serviceRoleKey) : null;

    let openaiKey: string | null = null;
    let geminiKey: string | null = null;
    let claudeKey: string | null = null;

    if (preferredProvider === "claude") {
      claudeKey = adminClient
        ? (await resolveAiKey(adminClient, user.id, "claude")).apiKey
        : Deno.env.get("ANTHROPIC_API_KEY") || Deno.env.get("CLAUDE_API_KEY") || null;
      if (!claudeKey) {
        return jsonResponse({ error: "Salve sua chave Claude em Configurações → Chaves de IA." }, 400);
      }
    } else if (preferredProvider === "gemini") {
      geminiKey = adminClient
        ? (await resolveAiKey(adminClient, user.id, "gemini")).apiKey
        : Deno.env.get("GEMINI_API_KEY") || Deno.env.get("GOOGLE_API_KEY") || null;
      if (!geminiKey) {
        return jsonResponse({ error: "Salve sua chave Gemini em Configurações → Chaves de IA." }, 400);
      }
    } else {
      openaiKey = adminClient
        ? (await resolveAiKey(adminClient, user.id, "openai")).apiKey
        : Deno.env.get("OPENAI_API_KEY") ?? null;
      if (!openaiKey && !Deno.env.get("LOVABLE_API_KEY")) {
        return jsonResponse(
          {
            error:
              "Configure sua OPENAI API key em Configurações → Chaves de IA, ou use o fallback da plataforma.",
          },
          400,
        );
      }
    }

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
      supabase.from("clients").select("id, name").eq("id", body.clientId).maybeSingle(),
      supabase
        .from("brand_briefings")
        .select("guide_markdown, status")
        .eq("client_id", body.clientId)
        .maybeSingle(),
    ]);

    if (contentError) return jsonResponse({ error: contentError.message }, 500);
    if (projectError) return jsonResponse({ error: projectError.message }, 500);
    if (clientError) return jsonResponse({ error: clientError.message }, 500);
    if (brandBriefingError) return jsonResponse({ error: brandBriefingError.message }, 500);
    if (!content || !project || !client) {
      return jsonResponse({ error: "Conteúdo, projeto ou cliente não encontrado" }, 404);
    }
    if (content.project_id !== project.id || project.client_id !== client.id) {
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
    const [youtubeMetas, instagramMetas] = await Promise.all([
      Promise.all(youtubeUrls.map((url) => fetchYoutubeMeta(url))),
      Promise.all(instagramUrls.map((url) => fetchInstagramMeta(url))),
    ]);

    const needsLocucao = format === "reels" || format === "recorded_video";
    const needsRoteiro = format === "carousel";
    const brandGuide =
      typeof brandBriefing?.guide_markdown === "string"
        ? brandBriefing.guide_markdown.trim().slice(0, 12000)
        : "";

    const systemPrompt = [
      "Você é um copywriter de Instagram para agências de marca.",
      languageInstruction(body.locale),
      "When there is a Brand guide, treat it as the priority source for voice, audience, pillars and ethical limits.",
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
      "Não invente fatos que não estejam no Guia de marca, prompt, referências, metadados dos vídeos ou na transcrição fornecida.",
    ].join("\n");

    const userPrompt = [
      `Cliente: ${client.name}`,
      `Projeto: ${project.name}`,
      project.description ? `Descrição do projeto: ${project.description}` : null,
      brandGuide ? `Guia de marca:\n${brandGuide}` : null,
      `Formato do post: ${format}`,
      content.theme ? `Tema atual: ${content.theme}` : null,
      `Temas disponíveis: ${(project.theme_presets ?? []).join(" | ") || "(nenhum)"}`,
      `CTAs disponíveis: ${(project.cta_presets ?? []).join(" | ") || "(nenhum)"}`,
      `Hashtags disponíveis: ${(project.hashtag_presets ?? []).join(" | ") || "(nenhuma)"}`,
      `Prompt do admin:\n${prompt}`,
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
      { preferredProvider, geminiKey, claudeKey },
    );
    if (!chat) {
      return jsonResponse(
        {
          error:
            preferredProvider === "claude"
              ? "Salve sua chave Claude em Configurações → Chaves de IA."
              : preferredProvider === "gemini"
                ? "Salve sua chave Gemini em Configurações → Chaves de IA."
                : "Configure sua OPENAI API key em Configurações → Chaves de IA, ou use o fallback da plataforma.",
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

    let contentText = "";
    if (chat.provider === "claude") {
      const claudeJson = (await chat.res.json()) as {
        content?: Array<{ type?: string; text?: string }>;
      };
      contentText = (claudeJson.content ?? [])
        .filter((part) => part.type === "text" && typeof part.text === "string")
        .map((part) => part.text)
        .join("\n");
    } else if (chat.provider === "gemini") {
      const geminiJson = (await chat.res.json()) as {
        candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
      };
      contentText =
        geminiJson.candidates?.[0]?.content?.parts?.map((part) => part.text ?? "").join("") ?? "";
    } else {
      const chatJson = (await chat.res.json()) as {
        choices?: Array<{ message?: { content?: string } }>;
      };
      contentText = chatJson.choices?.[0]?.message?.content ?? "";
    }
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
