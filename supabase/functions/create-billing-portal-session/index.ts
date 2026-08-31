import Stripe from "https://esm.sh/stripe@14.25.0?target=deno";
import { corsHeaders, jsonResponse } from "../_shared/cors.ts";
import { createClients, requireAuthedUser } from "../_shared/admin-clients.ts";

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

    const { data: rows, error } = await admin
      .from("subscriptions")
      .select("stripe_customer_id, source, status")
      .eq("user_id", user.id)
      .eq("source", "stripe")
      .not("stripe_customer_id", "is", null)
      .order("updated_at", { ascending: false })
      .limit(1);
    if (error) throw new Error(error.message);

    const customerId = rows?.[0]?.stripe_customer_id as string | undefined;
    if (!customerId) {
      return jsonResponse(
        { error: "Nenhuma assinatura Stripe encontrada. Assine um plano ou fale com o suporte." },
        404,
      );
    }

    const body = (await req.json().catch(() => ({}))) as { returnUrl?: string };
    const siteUrl = (Deno.env.get("SITE_URL") ?? "https://som-sistemaoperacionaldamarca.netlify.app").replace(
      /\/$/,
      "",
    );
    const returnUrl =
      typeof body.returnUrl === "string" && body.returnUrl.startsWith("http")
        ? body.returnUrl
        : `${siteUrl}/profile`;

    const stripe = new Stripe(stripeSecret, {
      apiVersion: "2023-10-16",
      httpClient: Stripe.createFetchHttpClient(),
    });

    const session = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: returnUrl,
    });

    return jsonResponse({ url: session.url });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("create-billing-portal-session:", message);
    return jsonResponse({ error: message }, 500);
  }
});
