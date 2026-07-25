import Stripe from "https://esm.sh/stripe@14.25.0?target=deno";
import { corsHeaders, jsonResponse } from "../_shared/cors.ts";
import { isPlanKey, priceIdForPlan, type PlanKey } from "../_shared/stripe-plans.ts";

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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  try {
    const stripeSecret = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeSecret) {
      return jsonResponse({ error: "Stripe não configurado (STRIPE_SECRET_KEY)" }, 500);
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
    if (!successUrl || !cancelUrl || !isSafeHttpUrl(successUrl) || !isSafeHttpUrl(cancelUrl)) {
      return jsonResponse({ error: "URLs de retorno inválidas" }, 400);
    }

    const stripe = new Stripe(stripeSecret, {
      apiVersion: "2023-10-16",
      httpClient: Stripe.createFetchHttpClient(),
    });

    const email = body.customerEmail?.trim().toLowerCase();

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: successUrl.includes("{CHECKOUT_SESSION_ID}")
        ? successUrl
        : `${successUrl}${successUrl.includes("?") ? "&" : "?"}session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: cancelUrl,
      allow_promotion_codes: true,
      billing_address_collection: "auto",
      customer_email: email || undefined,
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
