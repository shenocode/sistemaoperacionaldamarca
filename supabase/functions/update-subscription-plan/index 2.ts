import Stripe from "https://esm.sh/stripe@14.25.0?target=deno";
import { corsHeaders, jsonResponse } from "../_shared/cors.ts";
import { createClients, isSubscriptionActiveStatus, requireAuthedUser } from "../_shared/admin-clients.ts";
import { isPlanKey, priceIdForPlan, type PlanKey } from "../_shared/stripe-plans.ts";

type RequestBody = { plan?: string };

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse({ error: "Method not allowed" }, 405);

  try {
    const stripeSecret = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeSecret) {
      return jsonResponse({ error: "Stripe não configurado (STRIPE_SECRET_KEY)" }, 500);
    }

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return jsonResponse({ error: "Não autenticado" }, 401);

    const { supabase, admin } = createClients(authHeader);
    const user = await requireAuthedUser(supabase);

    const body = (await req.json().catch(() => ({}))) as RequestBody;
    if (!isPlanKey(body.plan)) {
      return jsonResponse({ error: "Plano inválido. Use solo, studio ou agency." }, 400);
    }
    const plan: PlanKey = body.plan;
    const priceId = priceIdForPlan(plan);
    if (!priceId) {
      return jsonResponse({ error: `Preço Stripe não configurado para o plano ${plan}.` }, 500);
    }

    const { data: rows, error } = await admin
      .from("subscriptions")
      .select(
        "id, plan, status, source, stripe_subscription_id, stripe_price_id, current_period_end",
      )
      .eq("user_id", user.id)
      .eq("source", "stripe")
      .order("updated_at", { ascending: false });
    if (error) throw new Error(error.message);

    const current = (rows ?? []).find((row) =>
      isSubscriptionActiveStatus(row.status, row.current_period_end),
    );
    if (!current?.stripe_subscription_id) {
      return jsonResponse(
        { error: "Nenhuma assinatura Stripe ativa. Use o checkout para assinar." },
        404,
      );
    }
    if (current.plan === plan && current.stripe_price_id === priceId) {
      return jsonResponse({ error: "Você já está neste plano." }, 409);
    }

    const stripe = new Stripe(stripeSecret, {
      apiVersion: "2023-10-16",
      httpClient: Stripe.createFetchHttpClient(),
    });

    const subscription = await stripe.subscriptions.retrieve(current.stripe_subscription_id);
    const itemId = subscription.items.data[0]?.id;
    if (!itemId) {
      return jsonResponse({ error: "Assinatura Stripe sem item de preço." }, 500);
    }

    const updated = await stripe.subscriptions.update(current.stripe_subscription_id, {
      items: [{ id: itemId, price: priceId }],
      proration_behavior: "create_prorations",
      metadata: { ...(subscription.metadata ?? {}), plan },
      cancel_at_period_end: false,
    });

    const { error: updateError } = await admin
      .from("subscriptions")
      .update({
        plan,
        status: updated.status,
        stripe_price_id: priceId,
        current_period_end: updated.current_period_end
          ? new Date(updated.current_period_end * 1000).toISOString()
          : current.current_period_end,
        cancel_at_period_end: updated.cancel_at_period_end ?? false,
      })
      .eq("id", current.id);
    if (updateError) throw new Error(updateError.message);

    return jsonResponse({ plan, status: updated.status });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("update-subscription-plan:", message);
    return jsonResponse({ error: message }, 500);
  }
});
