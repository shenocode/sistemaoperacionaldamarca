import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { corsHeaders, jsonResponse } from "../_shared/cors.ts";
import { clientIp, consumeRateLimit } from "../_shared/rate-limit.ts";

type ContactLeadIntent = "trial" | "human";
type ContactLeadNiche = "agency" | "social_media" | "brand_owner";

type RequestBody = {
  name?: string;
  email?: string;
  whatsapp?: string;
  intent?: string;
  niche?: string;
  locale?: string;
  source?: string;
};

function isIntent(value: string | undefined): value is ContactLeadIntent {
  return value === "trial" || value === "human";
}

function isNiche(value: string | undefined): value is ContactLeadNiche {
  return value === "agency" || value === "social_media" || value === "brand_owner";
}

function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
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
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !serviceRoleKey) {
      return jsonResponse({ error: "Supabase não configurado" }, 500);
    }

    const body = (await req.json().catch(() => ({}))) as RequestBody;
    const name = body.name?.trim() ?? "";
    const email = body.email?.trim().toLowerCase() ?? "";
    const whatsapp = (body.whatsapp ?? "").replace(/\D/g, "");
    const locale = body.locale?.trim().slice(0, 32) || null;
    const source = (body.source?.trim() || "landing").slice(0, 64);

    if (!name || name.length > 200) {
      return jsonResponse({ error: "Nome inválido" }, 400);
    }
    if (!email || email.length > 320 || !isValidEmail(email)) {
      return jsonResponse({ error: "E-mail inválido" }, 400);
    }
    if (whatsapp.length < 8 || whatsapp.length > 20) {
      return jsonResponse({ error: "WhatsApp inválido" }, 400);
    }
    if (!isIntent(body.intent)) {
      return jsonResponse({ error: "Intenção inválida" }, 400);
    }
    if (!isNiche(body.niche)) {
      return jsonResponse({ error: "Nicho inválido" }, 400);
    }

    const admin = createClient(supabaseUrl, serviceRoleKey);
    const allowed = await consumeRateLimit(
      admin,
      `lead:${clientIp(req)}:${email}`,
      6,
      600,
    );
    if (!allowed) {
      return jsonResponse({ error: "Muitas tentativas. Aguarde alguns minutos." }, 429);
    }

    const { data, error } = await admin
      .from("contact_leads")
      .insert({
        name,
        email,
        whatsapp,
        intent: body.intent,
        niche: body.niche,
        locale,
        source,
      })
      .select("id")
      .single();

    if (error) {
      console.error("contact_leads insert:", error.message);
      return jsonResponse({ error: "Falha ao salvar o lead" }, 500);
    }

    return jsonResponse({ ok: true, id: data.id });
  } catch (err) {
    console.error("submit-contact-lead:", err);
    return jsonResponse({ error: "Erro interno" }, 500);
  }
});
