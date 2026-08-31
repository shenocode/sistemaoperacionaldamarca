import Stripe from "https://esm.sh/stripe@14.25.0?target=deno";
import { corsHeaders, jsonResponse } from "../_shared/cors.ts";
import { isPlanKey, priceIdForPlan, type PlanKey } from "../_shared/stripe-plans.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { isSubscriptionActiveStatus } from "../_shared/admin-clients.ts";
import { clientIp, consumeRateLimit } from "../_shared/rate-limit.ts";

type RequestBody = {
  plan?: string;
  successUrl?: string;
  cancelUrl?: string;
  customerEmail?: string;
};

function isSafeHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:";
  } catch {
    return false;
  }
}

function originAllowed(url: string): boolean {
  try {
    const host = new URL(url).hostname.toLowerCase();
    let siteHost = "";
    try {
      siteHost = new URL(Deno.env.get("SITE_URL") ?? "").hostname.toLowerCase();
    } catch {
      siteHost = "";
    }
    return (
      host === "localhost" ||
      host === "127.0.0.1" ||
      host === siteHost ||
      host.endsWith(".netlify.app") ||
      host.endsWith(".lovable.app") ||
      host === "sistemaoperacionaldamarca.com.br" ||
      host === "www.sistemaoperacionaldamarca.com.br"
    );
  } catch {
    return false;
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  try {
    const stripeSecret = Deno.env.get("STRIPE_SECRET_KEY");
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
    if (!stripeSecret) {
      return jsonResponse({ error: "Stripe não configurado (STRIPE_SECRET_KEY)" }, 500);
    }
    if (!supabaseUrl || !serviceRoleKey) {
      return jsonResponse({ error: "Supabase não configurado" }, 500);
    }

    const body = (await req.json().catch(() => ({}))) as RequestBody;
    if (!isPlanKey(body.plan)) {
      return jsonResponse({ error: "Plano inválido. Use solo, studio ou agency." }, 400);
    }
    const plan: PlanKey = body.plan;

    const priceId = priceIdForPlan(plan);
    if (!priceId) {
      return jsonResponse(
        {
          error:
            `Preço Stripe não configurado para o plano ${plan}. Defina STRIPE_PRICE_${plan.toUpperCase()}.`,
        },
        500,
      );
    }

    const successUrl = body.successUrl?.trim();
    const cancelUrl = body.cancelUrl?.trim();
    if (
      !successUrl ||
      !cancelUrl ||
      !isSafeHttpUrl(successUrl) ||
      !isSafeHttpUrl(cancelUrl) ||
      !originAllowed(successUrl) ||
      !originAllowed(cancelUrl)
    ) {
      return jsonResponse({ error: "URLs de retorno inválidas" }, 400);
    }

    const admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const ip = clientIp(req);
    const email = body.customerEmail?.trim().toLowerCase() || "";
    const allowed = await consumeRateLimit(
      admin,
      `checkout:${ip}:${email || "anon"}`,
      8,
      600,
    );
    if (!allowed) {
      return jsonResponse({ error: "Muitas tentativas. Aguarde alguns minutos." }, 429);
    }

    let customerId: string | undefined;
    let authedEmail = email;

    const authHeader = req.headers.get("Authorization");
    if (authHeader && anonKey) {
      const supabase = createClient(supabaseUrl, anonKey, {
        global: { headers: { Authorization: authHeader } },
      });
      const { data: userData } = await supabase.auth.getUser();
      if (userData.user?.email) {
        authedEmail = userData.user.email.trim().toLowerCase();
        const { data: existing } = await admin
          .from("subscriptions")
          .select("status, source, stripe_customer_id, current_period_end")
          .eq("user_id", userData.user.id);

        const blocking = (existing ?? []).find(
          (row) =>
            row.source === "stripe" &&
            isSubscriptionActiveStatus(row.status, row.current_period_end),
        );
        if (blocking) {
          return jsonResponse(
            {
              error:
                "Você já tem uma assinatura ativa. Use Gerenciar assinatura no perfil para trocar de plano.",
            },
            409,
          );
        }

        customerId =
          (existing ?? []).find((row) => row.stripe_customer_id)?.stripe_customer_id ?? undefined;
      }
    } else if (authedEmail) {
      const { data: existing } = await admin
        .from("subscriptions")
        .select("status, source, stripe_customer_id, current_period_end")
        .eq("email", authedEmail);

      const blocking = (existing ?? []).find(
        (row) =>
          row.source === "stripe" &&
          isSubscriptionActiveStatus(row.status, row.current_period_end),
      );
      if (blocking) {
        return jsonResponse(
          { error: "Já existe uma assinatura ativa para este e-mail. Entre na conta para gerenciá-la." },
          409,
        );
      }
      customerId =
        (existing ?? []).find((row) => row.stripe_customer_id)?.stripe_customer_id ?? undefined;
    }

    const stripe = new Stripe(stripeSecret, {
      apiVersion: "2023-10-16",
      httpClient: Stripe.createFetchHttpClient(),
    });

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: successUrl.includes("{CHECKOUT_SESSION_ID}")
        ? successUrl
        : `${successUrl}${successUrl.includes("?") ? "&" : "?"}session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: cancelUrl,
      allow_promotion_codes: true,
      billing_address_collection: "auto",
      consent_collection: {
        terms_of_service: "required",
      },
      ...(customerId
        ? { customer: customerId }
        : authedEmail
          ? { customer_email: authedEmail }
          : {}),
      metadata: { plan },
      subscription_data: {
        metadata: { plan },
      },
      locale: "pt-BR",
    });

    if (!session.url) {
      return jsonResponse({ error: "Stripe não retornou URL de checkout" }, 500);
    }

    return jsonResponse({ url: session.url, sessionId: session.id });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("create-checkout-session:", message);
    return jsonResponse({ error: message }, 500);
  }
});
