import Stripe from "https://esm.sh/stripe@14.25.0?target=deno";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { isPlanKey, planFromPriceId, type PlanKey } from "../_shared/stripe-plans.ts";

const ADMIN_MASTER_EMAIL = "sherocha03@gmail.com";

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

async function findUserIdByEmail(
  admin: ReturnType<typeof createClient>,
  email: string,
): Promise<string | null> {
  const normalized = email.toLowerCase();
  let page = 1;
  for (;;) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw new Error(error.message);

    const match = data.users.find((user) => (user.email ?? "").toLowerCase() === normalized);
    if (match?.id) return match.id;

    const lastPage = data.lastPage ?? page;
    if (page >= lastPage || data.users.length === 0) return null;
    page += 1;
  }
}

async function ensureGestorAccess(
  admin: ReturnType<typeof createClient>,
  email: string,
  siteUrl: string,
): Promise<{ userId: string; created: boolean }> {
  const normalized = email.trim().toLowerCase();
  let userId = await findUserIdByEmail(admin, normalized);
  let created = false;

  if (!userId) {
    const { data, error } = await admin.auth.admin.inviteUserByEmail(normalized, {
      redirectTo: `${siteUrl}/reset-password`,
    });
    if (error) {
      // Race: user may have been created between list and invite.
      userId = await findUserIdByEmail(admin, normalized);
      if (!userId) throw new Error(error.message);
    } else {
      if (!data.user?.id) throw new Error("Falha ao convidar usuário após pagamento");
      userId = data.user.id;
      created = true;
    }
  }

  const displayName = normalized.split("@")[0] || null;
  if (displayName) {
    const { error: profileError } = await admin.from("profiles").upsert({
      id: userId,
      full_name: displayName,
    });
    if (profileError) console.error("profile upsert:", profileError.message);
  }

  const { error: roleError } = await admin.from("user_roles").insert({
    user_id: userId,
    role: "admin",
  });
  if (roleError && roleError.code !== "23505") {
    throw new Error(roleError.message);
  }

  return { userId, created };
}

async function revokeGestorAccessIfNeeded(
  admin: ReturnType<typeof createClient>,
  userId: string | null,
  email: string,
) {
  if (!userId) return;
  if (email.trim().toLowerCase() === ADMIN_MASTER_EMAIL) return;

  const { error } = await admin.from("user_roles").delete().eq("user_id", userId).eq("role", "admin");
  if (error) console.error("revoke admin role:", error.message);
}

function resolvePlan(subscription: Stripe.Subscription, fallback?: string | null): PlanKey {
  const fromMeta = subscription.metadata?.plan;
  if (isPlanKey(fromMeta)) return fromMeta;

  const priceId = subscription.items.data[0]?.price?.id;
  const fromPrice = planFromPriceId(priceId);
  if (fromPrice) return fromPrice;

  if (isPlanKey(fallback)) return fallback;
  return "solo";
}

function periodEnd(subscription: Stripe.Subscription): string | null {
  const end = subscription.current_period_end;
  if (!end) return null;
  return new Date(end * 1000).toISOString();
}

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return json({ error: "Method not allowed" }, 405);
  }

  const stripeSecret = Deno.env.get("STRIPE_SECRET_KEY");
  const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET");
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const siteUrl = (Deno.env.get("SITE_URL") ?? "https://som-sistemaoperacionaldamarca.netlify.app").replace(
    /\/$/,
    "",
  );

  if (!stripeSecret || !webhookSecret || !supabaseUrl || !serviceRoleKey) {
    return json({ error: "Stripe/Supabase env missing" }, 500);
  }

  const stripe = new Stripe(stripeSecret, {
    apiVersion: "2023-10-16",
    httpClient: Stripe.createFetchHttpClient(),
  });
  const admin = createClient(supabaseUrl, serviceRoleKey);

  const signature = req.headers.get("stripe-signature");
  if (!signature) return json({ error: "Missing stripe-signature" }, 400);

  const rawBody = await req.text();
  let event: Stripe.Event;
  try {
    event = await stripe.webhooks.constructEventAsync(rawBody, signature, webhookSecret);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("webhook signature:", message);
    return json({ error: `Webhook Error: ${message}` }, 400);
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        if (session.mode !== "subscription") break;

        const subscriptionId =
          typeof session.subscription === "string"
            ? session.subscription
            : session.subscription?.id;
        const customerId =
          typeof session.customer === "string" ? session.customer : session.customer?.id;
        const email = (session.customer_details?.email || session.customer_email || "")
          .trim()
          .toLowerCase();

        if (!subscriptionId || !customerId || !email) {
          console.error("checkout.session.completed missing fields", {
            subscriptionId,
            customerId,
            email,
          });
          break;
        }

        const subscription = await stripe.subscriptions.retrieve(subscriptionId);
        const plan = resolvePlan(subscription, session.metadata?.plan);
        const { userId } = await ensureGestorAccess(admin, email, siteUrl);

        const { error } = await admin.from("subscriptions").upsert(
          {
            user_id: userId,
            email,
            plan,
            status: subscription.status,
            source: "stripe",
            stripe_customer_id: customerId,
            stripe_subscription_id: subscriptionId,
            stripe_price_id: subscription.items.data[0]?.price?.id ?? null,
            current_period_end: periodEnd(subscription),
            cancel_at_period_end: subscription.cancel_at_period_end ?? false,
          },
          { onConflict: "stripe_subscription_id" },
        );
        if (error) throw new Error(error.message);
        break;
      }

      case "customer.subscription.updated":
      case "customer.subscription.deleted": {
        const subscription = event.data.object as Stripe.Subscription;
        const customerId =
          typeof subscription.customer === "string"
            ? subscription.customer
            : subscription.customer.id;
        const plan = resolvePlan(subscription);
        const priceId = subscription.items.data[0]?.price?.id ?? null;

        const { data: existing } = await admin
          .from("subscriptions")
          .select("id, user_id, email")
          .eq("stripe_subscription_id", subscription.id)
          .maybeSingle();

        let email = existing?.email ?? "";
        let userId = existing?.user_id ?? null;

        if (!email) {
          const customer = await stripe.customers.retrieve(customerId);
          if (!customer.deleted) {
            email = (customer.email ?? "").toLowerCase();
          }
        }

        if (email && !userId) {
          userId = await findUserIdByEmail(admin, email);
        }

        const status = event.type === "customer.subscription.deleted" ? "canceled" : subscription.status;

        if (existing) {
          const { error } = await admin
            .from("subscriptions")
            .update({
              user_id: userId,
              email: email || existing.email,
              plan,
              status,
              source: "stripe",
              stripe_customer_id: customerId,
              stripe_price_id: priceId,
              current_period_end: periodEnd(subscription),
              cancel_at_period_end: subscription.cancel_at_period_end ?? false,
            })
            .eq("stripe_subscription_id", subscription.id);
          if (error) throw new Error(error.message);
        } else if (email) {
          const { error } = await admin.from("subscriptions").insert({
            user_id: userId,
            email,
            plan,
            status,
            source: "stripe",
            stripe_customer_id: customerId,
            stripe_subscription_id: subscription.id,
            stripe_price_id: priceId,
            current_period_end: periodEnd(subscription),
            cancel_at_period_end: subscription.cancel_at_period_end ?? false,
          });
          if (error) throw new Error(error.message);
        }

        const inactive = status === "canceled" || status === "unpaid" || status === "incomplete_expired";
        if (inactive) {
          await revokeGestorAccessIfNeeded(admin, userId, email);
        } else if (status === "active" || status === "trialing" || status === "past_due") {
          if (email) await ensureGestorAccess(admin, email, siteUrl);
        }
        break;
      }

      default:
        break;
    }

    return json({ received: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("stripe-webhook handler:", message);
    return json({ error: message }, 500);
  }
});
