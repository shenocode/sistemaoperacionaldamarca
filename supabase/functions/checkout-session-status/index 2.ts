import Stripe from "https://esm.sh/stripe@14.25.0?target=deno";
import { corsHeaders, jsonResponse } from "../_shared/cors.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { clientIp, consumeRateLimit } from "../_shared/rate-limit.ts";
import { isSubscriptionActiveStatus } from "../_shared/admin-clients.ts";

type RequestBody = { sessionId?: string };

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse({ error: "Method not allowed" }, 405);

  try {
    const stripeSecret = Deno.env.get("STRIPE_SECRET_KEY");
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!stripeSecret || !supabaseUrl || !serviceRoleKey) {
      return jsonResponse({ error: "Stripe/Supabase não configurado" }, 500);
    }

    const body = (await req.json().catch(() => ({}))) as RequestBody;
    const sessionId = body.sessionId?.trim() ?? "";
    if (!sessionId.startsWith("cs_")) {
      return jsonResponse({ error: "Sessão inválida" }, 400);
    }

    const admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const allowed = await consumeRateLimit(admin, `checkout-status:${clientIp(req)}`, 30, 60);
    if (!allowed) {
      return jsonResponse({ error: "Muitas tentativas. Aguarde um momento." }, 429);
    }

    const stripe = new Stripe(stripeSecret, {
      apiVersion: "2023-10-16",
      httpClient: Stripe.createFetchHttpClient(),
    });

    const session = await stripe.checkout.sessions.retrieve(sessionId);
    if (session.mode !== "subscription") {
      return jsonResponse({ status: "invalid" });
    }

    const subscriptionId =
      typeof session.subscription === "string"
        ? session.subscription
        : session.subscription?.id;
    if (!subscriptionId) {
      return jsonResponse({ status: "pending" });
    }

    const { data: row } = await admin
      .from("subscriptions")
      .select("status, current_period_end, email")
      .eq("stripe_subscription_id", subscriptionId)
      .maybeSingle();

    if (row && isSubscriptionActiveStatus(row.status, row.current_period_end)) {
      return jsonResponse({ status: "ready", email: row.email });
    }

    if (session.status === "expired" || session.payment_status === "unpaid") {
      return jsonResponse({ status: "failed" });
    }

    return jsonResponse({ status: "pending" });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("checkout-session-status:", message);
    return jsonResponse({ error: message }, 500);
  }
});
