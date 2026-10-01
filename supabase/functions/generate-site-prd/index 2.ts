import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { resolveAiKeyWithBudget, resolvedKeyError } from "../_shared/admin-ai-keys.ts";

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type GenerateRequest = {
  projectId: string;
  locale?: string;
};

const FIELD_LABELS: Record<string, string> = {
  nome: "Nome da empresa",
  nomeFantasia: "Nome fantasia",
  segmento: "Segmento",
  descricao: "Descrição do negócio",
  historia: "História da empresa",
  missao: "Missão",
  valores: "Valores",
  diferenciais: "Diferenciais",
  produtos: "Produtos",
  servicos: "Serviços",
  publicoAlvo: "Público-alvo",
  cidade: "Cidade",
  estado: "Estado",
  pais: "País",
  horario: "Horário de funcionamento",
  whatsapp: "WhatsApp",
  telefone: "Telefone",
  email: "E-mail",
  website: "URL do site (se houver)",
  endereco: "Endereço",
  maps: "Google Maps",
  instagram: "Instagram",
  facebook: "Facebook",
  linkedin: "LinkedIn",
  tiktok: "TikTok",
  youtube: "YouTube",
  pinterest: "Pinterest",
  videos: "Vídeos",
  estilo: "Estilo visual",
  tom: "Tom da marca",
  objetivos: "Objetivos do site",
  ctas: "Chamadas principais (CTA)",
  cta: "CTA",
};

function languageInstruction(locale?: string): string {
  const lower = (locale ?? "pt-BR").toLowerCase();
  if (lower.startsWith("en")) return "Write in English (US).";
  if (lower.startsWith("es")) return "Escribe en español.";
  return "Escreva em português do Brasil.";
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string" && item.trim() !== "");
}

function buildFormQaText(raw: unknown): { qaText: string; filled: boolean } {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return { qaText: "", filled: false };
  }
  const form = raw as Record<string, unknown>;
  const lines: string[] = [];
  const push = (key: string, value: string) => {
    if (!value.trim()) return;
    lines.push(`P: ${FIELD_LABELS[key] ?? key}`);
    lines.push(`R: ${value.trim()}`);
    lines.push("");
  };

  for (const key of Object.keys(FIELD_LABELS)) {
    if (key === "whatsapp" || key === "telefone" || key === "videos" || key === "objetivos" || key === "ctas" || key === "cta") {
      continue;
    }
    const value = form[key];
    if (typeof value === "string") push(key, value);
  }

  const ddi = typeof form.ddi === "string" ? form.ddi : "";
  const whatsapp = typeof form.whatsapp === "string" ? form.whatsapp : "";
  if (whatsapp.trim()) push("whatsapp", `${ddi} ${whatsapp}`.trim());

  const telefoneDdi = typeof form.telefoneDdi === "string" ? form.telefoneDdi : ddi;
  const telefone = typeof form.telefone === "string" ? form.telefone : "";
  if (telefone.trim()) push("telefone", `${telefoneDdi} ${telefone}`.trim());

  const objetivos = asStringArray(form.objetivos);
  push("objetivos", objetivos.join(", "));

  const ctas = asStringArray(form.ctas);
  const cta = typeof form.cta === "string" ? form.cta : "";
  push("ctas", ctas.length ? ctas.join(", ") : cta);

  const videos = asStringArray(form.videos);
  push("videos", videos.join("\n"));

  const qaText = lines.join("\n").trim();
  return { qaText, filled: qaText.length > 0 };
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
    const resolved = await resolveAiKeyWithBudget(admin, user.id, "openai", 2);
    const keyError = resolvedKeyError(resolved, "openai");
    if (keyError || !resolved.apiKey) {
      return jsonResponse({ error: keyError ?? "Configure sua chave de IA." }, 400);
    }
    const openaiKey = resolved.apiKey;

    const body = (await req.json()) as GenerateRequest;
    if (!body.projectId) {
      return jsonResponse({ error: "Parâmetros inválidos" }, 400);
    }

    const { data: canManage, error: accessError } = await supabase.rpc("can_manage_project", {
      _project_id: body.projectId,
    });
    if (accessError) return jsonResponse({ error: accessError.message }, 500);
    if (!canManage) {
      return jsonResponse({ error: "Sem permissão para gerar o PRD deste projeto" }, 403);
    }

    const { data: project, error: projectError } = await supabase
      .from("projects")
      .select("id, name, client_id, categories")
      .eq("id", body.projectId)
      .maybeSingle();
    if (projectError) return jsonResponse({ error: projectError.message }, 500);
    if (!project) return jsonResponse({ error: "Projeto não encontrado" }, 404);

    const [{ data: client }, { data: site, error: siteError }, { data: brandBriefing }] =
      await Promise.all([
        supabase.from("clients").select("id, name").eq("id", project.client_id).maybeSingle(),
        supabase.from("project_site").select("*").eq("project_id", body.projectId).maybeSingle(),
        supabase
          .from("brand_briefings")
          .select("guide_markdown")
          .eq("client_id", project.client_id)
          .maybeSingle(),
      ]);

    if (siteError) return jsonResponse({ error: siteError.message }, 500);
    if (!site) {
      return jsonResponse({ error: "Briefing do site não encontrado" }, 404);
    }

    const { qaText, filled } = buildFormQaText(site.briefing_answers);
    if (!filled) {
      return jsonResponse(
        { error: "Preencha ao menos uma resposta no Briefing antes de gerar o PRD" },
        400,
      );
    }

    const managerNotes =
      typeof site.manager_notes === "string" && site.manager_notes.trim()
        ? site.manager_notes.trim()
        : "";
    const brandGuide =
      typeof brandBriefing?.guide_markdown === "string" ? brandBriefing.guide_markdown.trim() : "";

    const systemPrompt = [
      "Você é um product designer / product manager que escreve PRDs práticos para construir sites no Lovable.",
      languageInstruction(body.locale),
      "Responda APENAS com JSON válido (sem markdown fora do campo) no formato:",
      '{"prd_markdown":"..."}',
      "O campo prd_markdown deve ser um documento Markdown completo, pronto para colar no Lovable, com seções como:",
      "## Objetivo",
      "## Público",
      "## Escopo / páginas",
      "## Arquitetura da informação",
      "## Requisitos funcionais",
      "## Conteúdo e tom",
      "## Design / identidade visual",
      "## CTAs e conversão",
      "## Critérios de aceite",
      "## Prompt inicial para o Lovable",
      "Regras:",
      "- Não invente fatos ausentes; se faltar informação, registre como lacuna.",
      "- Use o guia de marca quando disponível para tom, visual e posicionamento.",
      "- Inclua no final um bloco 'Prompt inicial para o Lovable' com instruções acionáveis.",
    ].join("\n");

    const userPrompt = [
      `Cliente/marca: ${client?.name ?? "—"}`,
      `Projeto: ${project.name}`,
      "Título do briefing: Briefing do site",
      managerNotes ? `Anotações da 1ª reunião (gestor):\n${managerNotes}` : null,
      brandGuide ? `Guia de marca (resumo/fonte):\n${brandGuide.slice(0, 8000)}` : null,
      "Respostas do briefing do site:",
      qaText,
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
      return jsonResponse({ error: "Falha ao gerar o PRD com a IA" }, 502);
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

    const prdMarkdown =
      typeof parsed.prd_markdown === "string" ? parsed.prd_markdown.trim() : "";
    if (!prdMarkdown) {
      return jsonResponse({ error: "PRD gerado sem conteúdo" }, 502);
    }

    const now = new Date().toISOString();
    const { data: updated, error: updateError } = await supabase
      .from("project_site")
      .update({
        prd_markdown: prdMarkdown,
        prd_generated_at: now,
        briefing_status: "completed",
      })
      .eq("project_id", body.projectId)
      .select("*")
      .single();

    if (updateError) return jsonResponse({ error: updateError.message }, 500);

    return jsonResponse({ site: updated });
  } catch (error) {
    console.error(error);
    return jsonResponse(
      { error: error instanceof Error ? error.message : "Erro interno" },
      500,
    );
  }
});
