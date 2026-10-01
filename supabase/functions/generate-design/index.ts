import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { missingKeyMessage, resolveAiKey } from "../_shared/admin-ai-keys.ts";

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const CONTENT_MEDIA_BUCKET = "content-media";
const MAX_IMAGE_BYTES = 20 * 1024 * 1024;

type DesignFormat = "static_feed" | "carousel";
type DesignProvider = "openai" | "gemini";

type GenerateRequest = {
  contentId: string;
  projectId: string;
  clientId: string;
  format?: DesignFormat;
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

async function generateWithOpenAI(input: {
  prompt: string;
  templateImage: RefImage;
  photoImage?: RefImage;
  apiKey: string;
}): Promise<Uint8Array> {
  const form = new FormData();
  form.append("model", Deno.env.get("OPENAI_IMAGE_MODEL") || "gpt-image-1");
  form.append("prompt", input.prompt);
  form.append("n", "1");
  form.append("size", "1024x1024");
  form.append("input_fidelity", "high");
  const normalizeMime = (mime: string) => {
    const m = (mime || "").toLowerCase();
    if (m.includes("png")) return "image/png";
    if (m.includes("webp")) return "image/webp";
    if (m.includes("jpeg") || m.includes("jpg")) return "image/jpeg";
    return "image/png";
  };
  form.append(
    "image[]",
    new Blob([input.templateImage.bytes], { type: normalizeMime(input.templateImage.mime) }),
    input.templateImage.fileName || "template.png",
  );
  if (input.photoImage) {
    form.append(
      "image[]",
      new Blob([input.photoImage.bytes], { type: normalizeMime(input.photoImage.mime) }),
      input.photoImage.fileName || "photo.png",
    );
  }

  const openaiRes = await fetch("https://api.openai.com/v1/images/edits", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${input.apiKey}`,
    },
    body: form,
  });

  if (!openaiRes.ok) {
    const errText = await openaiRes.text();
    console.error("OpenAI image edit error:", openaiRes.status, errText);
    if (openaiRes.status === 429) {
      throw Object.assign(new Error("Limite de requisições da OpenAI atingido. Tente de novo ou use Gemini."), {
        status: 429,
      });
    }
    if (openaiRes.status === 402 || /billing|quota|insufficient|credit/i.test(errText)) {
      throw Object.assign(new Error("Créditos da OpenAI esgotados. Troque para Gemini ou recarregue a conta."), {
        status: 402,
      });
    }
    throw Object.assign(new Error("Falha ao gerar arte com a OpenAI"), { status: 502 });
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

async function generateWithGemini(input: {
  prompt: string;
  templateImage: RefImage;
  photoImage?: RefImage;
  apiKey: string;
}): Promise<Uint8Array> {
  const model = Deno.env.get("GEMINI_IMAGE_MODEL") || "gemini-2.5-flash-image";
  const url =
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(input.apiKey)}`;

  const parts: Array<Record<string, unknown>> = [
    { text: input.prompt },
    {
      inline_data: {
        mime_type: input.templateImage.mime,
        data: bytesToBase64(input.templateImage.bytes),
      },
    },
  ];
  if (input.photoImage) {
    parts.push({
      inline_data: {
        mime_type: input.photoImage.mime,
        data: bytesToBase64(input.photoImage.bytes),
      },
    });
  }

  const geminiRes = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [
        {
          role: "user",
          parts,
        },
      ],
      generationConfig: {
        responseModalities: ["TEXT", "IMAGE"],
        imageConfig: { aspectRatio: "1:1" },
      },
    }),
  });

  if (!geminiRes.ok) {
    const errText = await geminiRes.text();
    const status = geminiRes.status;
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

  const partsRes = geminiJson.candidates?.[0]?.content?.parts ?? [];
  for (const part of partsRes) {
    const data = part.inlineData?.data || part.inline_data?.data;
    if (data) return base64ToBytes(data);
  }

  throw Object.assign(new Error("Resposta de imagem inválida do Gemini"), { status: 502 });
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
      return jsonResponse({ error: "Apenas administradores podem usar o assistente de design" }, 403);
    }

    // Redeploy bump: gestores/admins com BYOK podem gerar arte (sem gate de plano Studio/Agência).

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

    const { apiKey, source: keySource } = await resolveAiKey(admin, user.id, provider);
    if (!apiKey) {
      return jsonResponse({ error: missingKeyMessage(provider) }, 400);
    }
    void keySource;

    const [
      { data: content, error: contentError },
      { data: project, error: projectError },
      { data: client, error: clientError },
      { data: brandBriefing, error: brandBriefingError },
    ] = await Promise.all([
      supabase.from("content_items").select("id, project_id, title, format").eq("id", body.contentId).maybeSingle(),
      supabase.from("projects").select("id, name, client_id").eq("id", body.projectId).maybeSingle(),
      supabase
        .from("clients")
        .select("id, name, logo_url, brand_colors, brand_fonts")
        .eq("id", body.clientId)
        .maybeSingle(),
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

    const format = (body.format ?? content.format ?? "static_feed") as DesignFormat;
    if (format !== "static_feed" && format !== "carousel") {
      return jsonResponse({ error: "Formato não suportado pelo assistente de design" }, 400);
    }

    const brandGuide =
      typeof brandBriefing?.guide_markdown === "string"
        ? brandBriefing.guide_markdown.trim().slice(0, 4000)
        : "";

    const templateImage = await fetchImage(templateUrl);
    const photoImage = photoUrl ? await fetchImage(photoUrl) : undefined;

    const prompt = [
      "Você é um diretor de arte de Instagram.",
      "Crie UMA arte quadrada de feed (1:1) em português do Brasil.",
      "A primeira imagem é o TEMPLATE de layout: preserve a composição, hierarquia, áreas de texto e estilo visual o máximo possível.",
      photoImage
        ? "A segunda imagem é a FOTO/ASSET que deve ser usada como elemento principal da arte (substitua a foto do template por esta, mantendo enquadramento coerente)."
        : "Nenhuma foto/asset adicional foi fornecida: use apenas os elementos, textos e estilo do template. Não invente fotografias, pessoas, ilustrações ou assets que não estejam no template.",
      "Use exatamente os textos fornecidos (não invente frases extras).",
      "Quando houver texto secundário, use-o como texto explicativo/apoio (menor hierarquia visual).",
      "Respeite as cores e fontes do kit de marca quando informadas.",
      "Não adicione logos inventados; se houver logo na referência, mantenha o estilo, não invente marcas.",
      "Resultado final: peça pronta para publicar, limpa, legível, profissional.",
      "",
      `Cliente: ${client.name}`,
      `Projeto: ${project.name}`,
      `Formato: ${format}`,
      `Cores da marca: ${formatBrandColors(client.brand_colors)}`,
      `Fontes da marca: ${formatBrandFonts(client.brand_fonts)}`,
      brandGuide ? `Trecho do guia de marca:\n${brandGuide}` : null,
      `Texto em destaque / frase principal (exato):\n${overlayText}`,
      secondaryText ? `Texto secundário / explicativo (exato):\n${secondaryText}` : null,
      guidance ? `Orientações adicionais:\n${guidance}` : null,
    ]
      .filter(Boolean)
      .join("\n");

    let imageBytes: Uint8Array;
    try {
      if (provider === "gemini") {
        imageBytes = await generateWithGemini({
          prompt,
          templateImage,
          photoImage,
          apiKey,
        });
      } else {
        imageBytes = await generateWithOpenAI({
          prompt,
          templateImage,
          photoImage,
          apiKey,
        });
      }
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
