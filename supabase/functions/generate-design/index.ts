import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { resolveAiKeyWithBudget, resolvedKeyError } from "../_shared/admin-ai-keys.ts";
import { loadCallerEntitlements } from "../_shared/caller-entitlements.ts";
import {
  defaultAspectForFormat,
  designCanvasSpec,
  isContentFormat,
  parseDesignAspectRatio,
  type DesignAspectRatio,
} from "../_shared/design-aspect.ts";

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const CONTENT_MEDIA_BUCKET = "content-media";
const MAX_IMAGE_BYTES = 20 * 1024 * 1024;

type DesignProvider = "openai" | "gemini";

type GenerateRequest = {
  contentId: string;
  projectId: string;
  clientId: string;
  format?: string;
  aspectRatio?: string;
  provider?: DesignProvider;
  templateUrl: string;
  photoUrl?: string;
  overlayText: string;
  secondaryText?: string;
  guidance?: string;
};

type BrandColor = { name?: string; hex?: string };
type BrandFonts = { primary?: string; secondary?: string; notes?: string };

type RefImage = { bytes: Uint8Array; mime: string; fileName: string };

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function sanitizeFileName(name: string) {
  return name.replace(/[^\w.\-()+ ]+/g, "_").replace(/\s+/g, "-").slice(0, 120);
}

function extensionFromMime(mime: string) {
  if (mime.includes("png")) return "png";
  if (mime.includes("webp")) return "webp";
  if (mime.includes("jpeg") || mime.includes("jpg")) return "jpg";
  return "png";
}

function bytesToBase64(bytes: Uint8Array): string {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
  let result = "";
  for (let i = 0; i < bytes.length; i += 3) {
    const a = bytes[i];
    const b = i + 1 < bytes.length ? bytes[i + 1] : 0;
    const c = i + 2 < bytes.length ? bytes[i + 2] : 0;
    const triple = (a << 16) | (b << 8) | c;
    result += alphabet[(triple >> 18) & 63];
    result += alphabet[(triple >> 12) & 63];
    result += i + 1 < bytes.length ? alphabet[(triple >> 6) & 63] : "=";
    result += i + 2 < bytes.length ? alphabet[triple & 63] : "=";
  }
  return result;
}

function base64ToBytes(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

async function fetchImage(url: string): Promise<RefImage> {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Falha ao baixar imagem de referência (${res.status})`);
  }
  const mime = res.headers.get("content-type")?.split(";")[0]?.trim() || "image/png";
  if (!mime.startsWith("image/")) {
    throw new Error("URL de referência não é uma imagem");
  }
  const buffer = new Uint8Array(await res.arrayBuffer());
  if (buffer.byteLength === 0) {
    throw new Error("Imagem de referência vazia");
  }
  if (buffer.byteLength > MAX_IMAGE_BYTES) {
    throw new Error("Imagem de referência maior que 20 MB");
  }
  const pathPart = sanitizeFileName(url.split("/").pop()?.split("?")[0] || `ref.${extensionFromMime(mime)}`);
  return { bytes: buffer, mime, fileName: pathPart };
}

function formatBrandColors(raw: unknown): string {
  if (!Array.isArray(raw) || raw.length === 0) return "(não informado)";
  return (raw as BrandColor[])
    .map((c) => {
      const name = typeof c.name === "string" && c.name.trim() ? c.name.trim() : "Cor";
      const hex = typeof c.hex === "string" ? c.hex.trim() : "";
      return hex ? `${name}: ${hex}` : null;
    })
    .filter(Boolean)
    .join("; ") || "(não informado)";
}

function formatBrandFonts(raw: unknown): string {
  if (!raw || typeof raw !== "object") return "(não informado)";
  const fonts = raw as BrandFonts;
  const parts = [
    fonts.primary?.trim() ? `principal: ${fonts.primary.trim()}` : null,
    fonts.secondary?.trim() ? `secundária: ${fonts.secondary.trim()}` : null,
    fonts.notes?.trim() ? `notas: ${fonts.notes.trim()}` : null,
  ].filter(Boolean);
  return parts.length ? parts.join("; ") : "(não informado)";
}

function normalizeProvider(value: unknown): DesignProvider {
  return value === "gemini" ? "gemini" : "openai";
}

function normalizeMime(mime: string) {
  const m = (mime || "").toLowerCase();
  if (m.includes("png")) return "image/png";
  if (m.includes("webp")) return "image/webp";
  if (m.includes("jpeg") || m.includes("jpg")) return "image/jpeg";
  return "image/png";
}

function throwOpenAiImageError(status: number, errText: string): never {
  console.error("OpenAI image edit error:", status, errText);
  if (status === 429) {
    throw Object.assign(new Error("Limite de requisições da OpenAI atingido. Tente de novo ou use Gemini."), {
      status: 429,
    });
  }
  if (status === 402 || /billing|quota|insufficient|credit/i.test(errText)) {
    throw Object.assign(new Error("Créditos da OpenAI esgotados. Troque para Gemini ou recarregue a conta."), {
      status: 402,
    });
  }
  throw Object.assign(new Error("Falha ao gerar arte com a OpenAI"), { status: 502 });
}

async function openaiImageEdit(input: {
  prompt: string;
  images: RefImage[];
  apiKey: string;
  aspectRatio: DesignAspectRatio;
  /** high trava demais o template (texto + proporção); low permite adaptar canvas e limpar letras. */
  inputFidelity?: "low" | "high";
}): Promise<Uint8Array> {
  const form = new FormData();
  const model = Deno.env.get("OPENAI_IMAGE_MODEL") || "gpt-image-1";
  form.append("model", model);
  form.append("prompt", input.prompt);
  form.append("n", "1");
  form.append("size", designCanvasSpec(input.aspectRatio).openaiSize);
  form.append("quality", "high");
  form.append("input_fidelity", input.inputFidelity ?? "low");
  for (const image of input.images) {
    form.append(
      "image[]",
      new Blob([image.bytes], { type: normalizeMime(image.mime) }),
      image.fileName || "ref.png",
    );
  }

  const openaiRes = await fetch("https://api.openai.com/v1/images/edits", {
    method: "POST",
    headers: { Authorization: `Bearer ${input.apiKey}` },
    body: form,
  });

  if (!openaiRes.ok) {
    throwOpenAiImageError(openaiRes.status, await openaiRes.text());
  }

  const openaiJson = (await openaiRes.json()) as {
    data?: Array<{ b64_json?: string; url?: string }>;
  };
  const first = openaiJson.data?.[0];
  if (first?.b64_json) return base64ToBytes(first.b64_json);
  if (first?.url) {
    const downloaded = await fetchImage(first.url);
    return downloaded.bytes;
  }
  throw Object.assign(new Error("Resposta de imagem inválida da OpenAI"), { status: 502 });
}

async function generateWithOpenAI(input: {
  prompt: string;
  templateImage: RefImage;
  photoImage?: RefImage | null;
  apiKey: string;
  aspectRatio: DesignAspectRatio;
}): Promise<Uint8Array> {
  // Com foto: NÃO envia o template em pixels (ele carrega tipografia e a IA copia).
  // Só a foto + prompt de direção de arte → fundo limpo para overlay de texto.
  const images: RefImage[] = input.photoImage
    ? [input.photoImage]
    : [input.templateImage];
  return openaiImageEdit({
    prompt: input.prompt,
    images,
    apiKey: input.apiKey,
    aspectRatio: input.aspectRatio,
    inputFidelity: "low",
  });
}

async function scrubTextWithOpenAI(input: {
  image: RefImage;
  apiKey: string;
  aspectRatio: DesignAspectRatio;
}): Promise<Uint8Array> {
  const canvas = designCanvasSpec(input.aspectRatio);
  const prompt = [
    "CRITICAL TASK: erase ALL typography from this artwork. Output must be a CLEAN photo/background only.",
    `Mandatory canvas ${input.aspectRatio} (${canvas.pixels}). ${canvas.forbidden}`,
    "Delete every letter, number, word, @handle, hashtag, caption, subtitle, footer text, watermark, logo type, and illegible glyph.",
    "Inpaint those areas with continuous photo/background — no blank boxes, no smudged letters, no new words.",
    "Do not redraw, translate, or invent any text. Zero characters in the output.",
    "Keep the photography, lighting, colors and composition. Only remove text.",
  ].join("\n");
  return openaiImageEdit({
    prompt,
    images: [input.image],
    apiKey: input.apiKey,
    aspectRatio: input.aspectRatio,
    inputFidelity: "low",
  });
}

function isGeminiApiKeyError(status: number, errText: string): boolean {
  // Não usar /invalid/i: quase todo 400 do Gemini traz status "INVALID_ARGUMENT".
  if (status === 401 || status === 403) {
    return /API[_ ]?KEY|API key|PERMISSION_DENIED|permission/i.test(errText);
  }
  if (status !== 400) return false;
  return /API_KEY_INVALID|API key not valid|API key is invalid|Please pass a valid API key/i.test(
    errText,
  );
}

function geminiErrorDetail(errText: string): string {
  try {
    const parsed = JSON.parse(errText) as { error?: { message?: string } };
    const message = parsed?.error?.message?.trim();
    if (message) return message;
  } catch {
    // corpo não-JSON
  }
  return errText.replace(/\s+/g, " ").trim().slice(0, 220);
}

function throwGeminiImageError(status: number, errText: string): never {
  console.error("Gemini image error:", status, errText);
  if (status === 429) {
    throw Object.assign(new Error("Limite de requisições do Gemini atingido. Tente de novo ou use OpenAI."), {
      status: 429,
    });
  }
  if (isGeminiApiKeyError(status, errText)) {
    throw Object.assign(
      new Error(
        "Chave do Gemini inválida ou sem permissão. Confira em Configurações → Chaves de IA (ou GEMINI_API_KEY nas secrets).",
      ),
      { status: 400 },
    );
  }
  if (/quota|billing|RESOURCE_EXHAUSTED/i.test(errText)) {
    throw Object.assign(new Error("Cota/créditos do Gemini esgotados. Troque para OpenAI ou aguarde."), {
      status: 402,
    });
  }
  const detail = geminiErrorDetail(errText);
  throw Object.assign(
    new Error(detail ? `Falha ao gerar arte com o Gemini: ${detail}` : "Falha ao gerar arte com o Gemini"),
    { status: status >= 400 && status < 600 ? status : 502 },
  );
}

async function geminiImageGenerate(input: {
  parts: Array<Record<string, unknown>>;
  apiKey: string;
  aspectRatio: DesignAspectRatio;
}): Promise<Uint8Array> {
  const model = Deno.env.get("GEMINI_IMAGE_MODEL") || "gemini-2.5-flash-image";
  const url =
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(input.apiKey)}`;

  const geminiRes = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ role: "user", parts: input.parts }],
      generationConfig: {
        responseModalities: ["IMAGE"],
        imageConfig: { aspectRatio: input.aspectRatio },
      },
    }),
  });

  if (!geminiRes.ok) {
    throwGeminiImageError(geminiRes.status, await geminiRes.text());
  }

  const geminiJson = (await geminiRes.json()) as {
    candidates?: Array<{
      content?: {
        parts?: Array<{
          inlineData?: { data?: string; mimeType?: string };
          inline_data?: { data?: string; mime_type?: string };
        }>;
      };
    }>;
  };

  const responseParts = geminiJson.candidates?.[0]?.content?.parts ?? [];
  for (const part of responseParts) {
    const data = part.inlineData?.data || part.inline_data?.data;
    if (data) return base64ToBytes(data);
  }

  throw Object.assign(new Error("Resposta de imagem inválida do Gemini"), { status: 502 });
}

async function generateWithGemini(input: {
  prompt: string;
  templateImage: RefImage;
  photoImage?: RefImage | null;
  apiKey: string;
  aspectRatio: DesignAspectRatio;
}): Promise<Uint8Array> {
  const imagePart = (image: RefImage) => ({
    inline_data: {
      mime_type: image.mime,
      data: bytesToBase64(image.bytes),
    },
  });

  const parts: Array<Record<string, unknown>> = [{ text: input.prompt }];
  if (input.photoImage) {
    // Só a foto — evita que o Gemini copie tipografia do PNG do template.
    parts.push({
      text: `FOTO — base visual. Canvas final ${input.aspectRatio}. Trate a foto; zero texto na saída.`,
    });
    parts.push(imagePart(input.photoImage));
  } else {
    parts.push({
      text: `TEMPLATE — use só direção de arte. Apague TODO texto desta imagem. Canvas ${input.aspectRatio}.`,
    });
    parts.push(imagePart(input.templateImage));
  }

  return geminiImageGenerate({
    parts,
    apiKey: input.apiKey,
    aspectRatio: input.aspectRatio,
  });
}

async function scrubTextWithGemini(input: {
  image: RefImage;
  apiKey: string;
  aspectRatio: DesignAspectRatio;
}): Promise<Uint8Array> {
  const canvas = designCanvasSpec(input.aspectRatio);
  const prompt = [
    "CRITICAL: erase ALL text from this image. Clean background/photo only.",
    `Mandatory output ${input.aspectRatio} (${canvas.pixels}). ${canvas.forbidden}`,
    "Remove every letter, number, @handle, caption and watermark. Inpaint continuously. Zero typography.",
  ].join("\n");

  return geminiImageGenerate({
    parts: [
      { text: prompt },
      {
        inline_data: {
          mime_type: input.image.mime,
          data: bytesToBase64(input.image.bytes),
        },
      },
    ],
    apiKey: input.apiKey,
    aspectRatio: input.aspectRatio,
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
    const admin = createClient(supabaseUrl, serviceRoleKey);

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
      return jsonResponse({ error: "Apenas gestores podem usar o assistente de design" }, 403);
    }

    const entitlements = await loadCallerEntitlements(admin, user.id, user.email);
    if (!entitlements.designAi) {
      return jsonResponse(
        { error: "IA de design não está incluída no seu plano. Atualize para Studio ou Agência." },
        403,
      );
    }

    const body = (await req.json()) as GenerateRequest;
    const provider = normalizeProvider(body.provider);
    const templateUrl = body.templateUrl?.trim() ?? "";
    const photoUrl = body.photoUrl?.trim() ?? "";
    const overlayText = body.overlayText?.trim() ?? "";
    const secondaryText = body.secondaryText?.trim() ?? "";
    const guidance = body.guidance?.trim() ?? "";

    if (!body.contentId || !body.projectId || !body.clientId) {
      return jsonResponse({ error: "Parâmetros inválidos" }, 400);
    }
    if (!templateUrl) return jsonResponse({ error: "Informe o template de referência" }, 400);
    if (!overlayText) return jsonResponse({ error: "Informe o texto da arte" }, 400);
    void overlayText;
    void secondaryText;

    const { apiKey, source: keySource } = await resolveAiKeyWithBudget(admin, user.id, provider, 10);
    const keyError = resolvedKeyError({ apiKey, source: keySource }, provider);
    if (keyError) {
      return jsonResponse({ error: keyError }, 400);
    }
    void keySource;

    const [
      { data: content, error: contentError },
      { data: project, error: projectError },
      clientResult,
      { data: brandBriefing, error: brandBriefingError },
    ] = await Promise.all([
      supabase.from("content_items").select("id, project_id, title, format").eq("id", body.contentId).maybeSingle(),
      supabase.from("projects").select("id, name, client_id").eq("id", body.projectId).maybeSingle(),
      supabase
        .from("clients")
        .select("id, name, logo_url, brand_colors, brand_fonts, brand_guidance")
        .eq("id", body.clientId)
        .maybeSingle(),
      supabase
        .from("brand_briefings")
        .select("guide_markdown, status")
        .eq("client_id", body.clientId)
        .maybeSingle(),
    ]);

    let client = clientResult.data as {
      id: string;
      name: string;
      logo_url?: string | null;
      brand_colors?: unknown;
      brand_fonts?: unknown;
      brand_guidance?: unknown;
    } | null;
    let clientError = clientResult.error;

    if (clientError && /brand_guidance/i.test(clientError.message)) {
      const retry = await supabase
        .from("clients")
        .select("id, name, logo_url, brand_colors, brand_fonts")
        .eq("id", body.clientId)
        .maybeSingle();
      client = retry.data;
      clientError = retry.error;
    }

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

    const rawFormat = body.format ?? content.format ?? "static_feed";
    const format = isContentFormat(rawFormat) ? rawFormat : "static_feed";
    const aspectRatio = parseDesignAspectRatio(
      body.aspectRatio,
      defaultAspectForFormat(format),
    );
    const canvas = designCanvasSpec(aspectRatio);

    const brandGuide =
      typeof brandBriefing?.guide_markdown === "string"
        ? brandBriefing.guide_markdown.trim().slice(0, 4000)
        : "";
    const brandGuidance =
      typeof client.brand_guidance === "string" ? client.brand_guidance.trim().slice(0, 2000) : "";

    const templateImage = await fetchImage(templateUrl);
    const photoImage = photoUrl ? await fetchImage(photoUrl) : null;

    const prompt = [
      photoImage
        ? "TAREFA: tratar ESTA FOTO como fundo de arte social — UMA imagem limpa, SEM nenhuma letra."
        : "TAREFA: gerar UMA arte final pronta para overlay de texto (sem letras), a partir do template.",
      photoImage
        ? "Use só a foto anexada. Aplique clima editorial/cinemático (contraste, cor, vinheta leve) inspirado na direção de arte da marca. NÃO anexe tipografia."
        : "O template anexado é REFERÊNCIA de direção de arte — apague todo texto dele.",
      `Canvas de saída OBRIGATÓRIO: ${canvas.orientation} ${aspectRatio} (${canvas.pixels}, size API ${canvas.openaiSize}) para ${canvas.uses}.`,
      `Proporção final: exatamente ${aspectRatio}. ${canvas.forbidden}`,
      "Ignore a proporção nativa da foto/template. Recomponha no canvas pedido (sem letterbox, sem barras).",
      "Não invente logos, selos, stickers nem tipografia desenhada.",
      "TEXTO — regra absoluta (falha se violar):",
      "ZERO letras na saída. Proibido palavra, número, handle (@), hashtag, CTA, crédito, marca d'água, placeholder ou texto borrado.",
      "Se a referência tiver texto, APAGUE completamente e complete o fundo. Não copie, não reescreva, não invente frases.",
      "O app aplica o copy depois (título, @, topo, apoio) com a fonte da marca. Sua saída é SÓ o fundo fotográfico limpo.",
      "Respeite as cores do kit de marca quando informadas.",
      `Resultado: fundo limpo sem letras em ${aspectRatio} (${canvas.pixels}).`,
      "",
      `Cliente: ${client.name}`,
      `Projeto: ${project.name}`,
      `Formato: ${format} (arte ${aspectRatio})`,
      `Cores da marca: ${formatBrandColors(client.brand_colors)}`,
      `Fontes da marca (NÃO desenhe letras): ${formatBrandFonts(client.brand_fonts)}`,
      brandGuidance ? `Orientações gerais da marca:\n${brandGuidance}` : null,
      brandGuide ? `Trecho do guia de marca:\n${brandGuide}` : null,
      guidance ? `Orientações adicionais deste pedido:\n${guidance}` : null,
    ]
      .filter(Boolean)
      .join("\n");

    async function scrubTwice(bytes: Uint8Array): Promise<Uint8Array> {
      let next = bytes;
      const run = provider === "gemini" ? scrubTextWithGemini : scrubTextWithOpenAI;
      for (let i = 0; i < 2; i += 1) {
        try {
          next = await run({
            image: { bytes: next, mime: "image/png", fileName: `draft-${i}.png` },
            apiKey,
            aspectRatio,
          });
        } catch (scrubErr) {
          console.error(`Text scrub pass ${i + 1} failed:`, scrubErr);
          break;
        }
      }
      return next;
    }

    let imageBytes: Uint8Array;
    try {
      if (provider === "gemini") {
        imageBytes = await generateWithGemini({
          prompt,
          templateImage,
          photoImage,
          apiKey,
          aspectRatio,
        });
      } else {
        imageBytes = await generateWithOpenAI({
          prompt,
          templateImage,
          photoImage,
          apiKey,
          aspectRatio,
        });
      }
      imageBytes = await scrubTwice(imageBytes);
    } catch (err) {
      const status = typeof err === "object" && err && "status" in err
        ? Number((err as { status?: number }).status) || 502
        : 502;
      return jsonResponse(
        { error: err instanceof Error ? err.message : "Falha ao gerar arte com a IA" },
        status,
      );
    }

    const storagePath = `${body.projectId}/ai-${crypto.randomUUID()}.png`;
    const { error: uploadError } = await admin.storage.from(CONTENT_MEDIA_BUCKET).upload(
      storagePath,
      imageBytes,
      {
        contentType: "image/png",
        upsert: false,
        cacheControl: "3600",
      },
    );
    if (uploadError) {
      console.error("Upload generated art failed:", uploadError.message);
      return jsonResponse({ error: "Falha ao salvar a arte gerada" }, 500);
    }

    const { data: publicUrlData } = admin.storage.from(CONTENT_MEDIA_BUCKET).getPublicUrl(storagePath);
    return jsonResponse({ imageUrl: publicUrlData.publicUrl, provider });
  } catch (error) {
    console.error(error);
    return jsonResponse(
      { error: error instanceof Error ? error.message : "Erro interno" },
      500,
    );
  }
});
