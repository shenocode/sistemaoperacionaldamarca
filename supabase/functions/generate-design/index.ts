import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const CONTENT_MEDIA_BUCKET = "content-media";
const MAX_IMAGE_BYTES = 20 * 1024 * 1024;

type DesignFormat = "static_feed" | "carousel";

type GenerateRequest = {
  contentId: string;
  projectId: string;
  clientId: string;
  format?: DesignFormat;
  templateUrl: string;
  photoUrl: string;
  overlayText: string;
  secondaryText?: string;
  guidance?: string;
};

type BrandColor = { name?: string; hex?: string };
type BrandFonts = { primary?: string; secondary?: string; notes?: string };

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

async function fetchImage(url: string): Promise<{ bytes: Uint8Array; mime: string; fileName: string }> {
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
    const openaiKey = Deno.env.get("OPENAI_API_KEY");

    if (!supabaseUrl || !supabaseAnonKey || !serviceRoleKey) {
      return jsonResponse({ error: "Supabase env missing" }, 500);
    }
    if (!openaiKey) {
      return jsonResponse({ error: "OPENAI_API_KEY não configurada" }, 500);
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

    const body = (await req.json()) as GenerateRequest;
    const templateUrl = body.templateUrl?.trim() ?? "";
    const photoUrl = body.photoUrl?.trim() ?? "";
    const overlayText = body.overlayText?.trim() ?? "";
    const secondaryText = body.secondaryText?.trim() ?? "";
    const guidance = body.guidance?.trim() ?? "";

    if (!body.contentId || !body.projectId || !body.clientId) {
      return jsonResponse({ error: "Parâmetros inválidos" }, 400);
    }
    if (!templateUrl) return jsonResponse({ error: "Informe o template de referência" }, 400);
    if (!photoUrl) return jsonResponse({ error: "Informe a imagem da arte" }, 400);
    if (!overlayText) return jsonResponse({ error: "Informe o texto da arte" }, 400);

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

    const [templateImage, photoImage] = await Promise.all([
      fetchImage(templateUrl),
      fetchImage(photoUrl),
    ]);

    const prompt = [
      "Você é um diretor de arte de Instagram.",
      "Crie UMA arte quadrada de feed (1:1) em português do Brasil.",
      "A primeira imagem é o TEMPLATE de layout: preserve a composição, hierarquia, áreas de texto e estilo visual o máximo possível.",
      "A segunda imagem é a FOTO/ASSET que deve ser usada como elemento principal da arte (substitua a foto do template por esta, mantendo enquadramento coerente).",
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

    const form = new FormData();
    form.append("model", Deno.env.get("OPENAI_IMAGE_MODEL") || "gpt-image-1");
    form.append("prompt", prompt);
    form.append("n", "1");
    form.append("size", "1024x1024");
    form.append("input_fidelity", "high");
    form.append(
      "image",
      new Blob([templateImage.bytes], { type: templateImage.mime }),
      templateImage.fileName || "template.png",
    );
    form.append(
      "image",
      new Blob([photoImage.bytes], { type: photoImage.mime }),
      photoImage.fileName || "photo.png",
    );

    const openaiRes = await fetch("https://api.openai.com/v1/images/edits", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${openaiKey}`,
      },
      body: form,
    });

    if (!openaiRes.ok) {
      const errText = await openaiRes.text();
      console.error("OpenAI image edit error:", openaiRes.status, errText);
      if (openaiRes.status === 429) {
        return jsonResponse({ error: "Limite de requisições da IA atingido. Tente de novo em instantes." }, 429);
      }
      return jsonResponse({ error: "Falha ao gerar arte com a IA" }, 502);
    }

    const openaiJson = (await openaiRes.json()) as {
      data?: Array<{ b64_json?: string; url?: string }>;
    };
    const first = openaiJson.data?.[0];
    let imageBytes: Uint8Array | null = null;

    if (first?.b64_json) {
      const binary = atob(first.b64_json);
      imageBytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i += 1) {
        imageBytes[i] = binary.charCodeAt(i);
      }
    } else if (first?.url) {
      const downloaded = await fetchImage(first.url);
      imageBytes = downloaded.bytes;
    }

    if (!imageBytes) {
      return jsonResponse({ error: "Resposta de imagem inválida da IA" }, 502);
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
    return jsonResponse({ imageUrl: publicUrlData.publicUrl });
  } catch (error) {
    console.error(error);
    return jsonResponse(
      { error: error instanceof Error ? error.message : "Erro interno" },
      500,
    );
  }
});
