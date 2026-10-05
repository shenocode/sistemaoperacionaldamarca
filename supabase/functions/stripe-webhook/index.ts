import Stripe from "https://esm.sh/stripe@14.25.0?target=deno";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { isPlanKey, planFromPriceId, type PlanKey } from "../_shared/stripe-plans.ts";
import {
  findUserIdByEmail,
  isSubscriptionActiveStatus,
  type AnyClient,
} from "../_shared/admin-clients.ts";

const ADMIN_MASTER_EMAIL = "sherocha03@gmail.com";

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

async function ensureGestorAccess(
  admin: AnyClient,
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

  return { userId: userId as string, created };
}

async function expireManualSubscriptions(
  admin: AnyClient,
  userId: string | null,
  email: string,
) {
  if (email.trim().toLowerCase() === ADMIN_MASTER_EMAIL) return;

  const emailNorm = email.trim().toLowerCase();
  let query = admin
    .from("subscriptions")
    .update({ status: "canceled", cancel_at_period_end: false })
    .eq("source", "manual")
    .in("status", ["active", "trialing", "past_due", "incomplete"]);

  if (userId && emailNorm) {
    query = query.or(`user_id.eq.${userId},email.eq.${emailNorm}`);
  } else if (userId) {
    query = query.eq("user_id", userId);
  } else if (emailNorm) {
    query = query.eq("email", emailNorm);
  } else {
    return;
  }

  const { error } = await query;
  if (error) console.error("expire manual subscriptions:", error.message);
}

async function revokeGestorAccessIfNeeded(
  admin: AnyClient,
  userId: string | null,
  email: string,
) {
  if (!userId) return;
  if (email.trim().toLowerCase() === ADMIN_MASTER_EMAIL) return;

  const { data: stillActive } = await admin
    .from("subscriptions")
    .select("id, status, current_period_end")
    .eq("user_id", userId);

  const hasOther = (stillActive ?? []).some((row: any) =>
    isSubscriptionActiveStatus(row.status, row.current_period_end),
  );
  if (hasOther) return;

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

async function upsertStripeSubscription(
  admin: AnyClient,
  input: {
    userId: string | null;
    email: string;
    plan: PlanKey;
    status: string;
    customerId: string;
    subscriptionId: string;
    priceId: string | null;
    periodEnd: string | null;
    cancelAtPeriodEnd: boolean;
  },
) {
  const { data: existing } = await admin
    .from("subscriptions")
    .select("id")
    .eq("stripe_subscription_id", input.subscriptionId)
    .maybeSingle();

  const row = {
    user_id: input.userId,
    email: input.email,
    plan: input.plan,
    status: input.status,
    source: "stripe",
    stripe_customer_id: input.customerId,
    stripe_subscription_id: input.subscriptionId,
    stripe_price_id: input.priceId,
    current_period_end: input.periodEnd,
    cancel_at_period_end: input.cancelAtPeriodEnd,
  };

  if (existing) {
    const { error } = await admin.from("subscriptions").update(row).eq("id", existing.id);
    if (error) throw new Error(error.message);
    return;
  }

  const { error } = await admin.from("subscriptions").insert(row);
  if (error) throw new Error(error.message);
}

async function syncStripeSubscription(
  admin: AnyClient,
  stripe: Stripe,
  subscription: Stripe.Subscription,
  siteUrl: string,
  statusOverride?: string,
) {
  const customerId =
    typeof subscription.customer === "string" ? subscription.customer : subscription.customer.id;
  const plan = resolvePlan(subscription);
  const priceId = subscription.items.data[0]?.price?.id ?? null;
  const status = statusOverride ?? subscription.status;
  const endedAt = periodEnd(subscription);

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

  if (isSubscriptionActiveStatus(status, endedAt) && email) {
    const ensured = await ensureGestorAccess(admin, email, siteUrl);
    userId = ensured.userId;
  }

  if (existing || email) {
    await upsertStripeSubscription(admin, {
      userId,
      email: email || existing?.email || "",
      plan,
      status,
      customerId,
      subscriptionId: subscription.id,
      priceId,
      periodEnd: endedAt,
      cancelAtPeriodEnd: subscription.cancel_at_period_end ?? false,
    });
  }

  // Renovação, troca de cartão e subscription.updated não encerram cortesia.
  // O plano manual atribuído pelo admin só termina num novo checkout pago.

  const inactive =
    status === "canceled" ||
    status === "unpaid" ||
    status === "incomplete_expired" ||
    (status === "past_due" && !isSubscriptionActiveStatus(status, endedAt));

  if (inactive) {
    await revokeGestorAccessIfNeeded(admin, userId, email);
  }
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

  const { error: claimError } = await admin.from("stripe_webhook_events").insert({
    id: event.id,
    event_type: event.type,
  });
  if (claimError?.code === "23505") {
    return json({ received: true, duplicate: true });
  }
  if (claimError) {
    console.error("stripe_webhook_events insert:", claimError.message);
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

        await upsertStripeSubscription(admin, {
          userId,
          email,
          plan,
          status: subscription.status,
          customerId,
          subscriptionId,
          priceId: subscription.items.data[0]?.price?.id ?? null,
          periodEnd: periodEnd(subscription),
          cancelAtPeriodEnd: subscription.cancel_at_period_end ?? false,
        });
        if (isSubscriptionActiveStatus(subscription.status, periodEnd(subscription))) {
          await expireManualSubscriptions(admin, userId, email);
        }
        break;
      }

      case "customer.subscription.updated":
      case "customer.subscription.deleted": {
        const subscription = event.data.object as Stripe.Subscription;
        const status =
          event.type === "customer.subscription.deleted" ? "canceled" : subscription.status;
        await syncStripeSubscription(admin, stripe, subscription, siteUrl, status);
        break;
      }

      case "invoice.payment_failed": {
        const invoice = event.data.object as Stripe.Invoice;
        const subscriptionId =
          typeof invoice.subscription === "string"
            ? invoice.subscription
            : invoice.subscription?.id;
        if (!subscriptionId) break;
        const subscription = await stripe.subscriptions.retrieve(subscriptionId);
        await syncStripeSubscription(admin, stripe, subscription, siteUrl);
        break;
      }

      default:
        break;
    }

    return json({ received: true });
  } catch (err) {
    if (!claimError) {
      await admin.from("stripe_webhook_events").delete().eq("id", event.id);
    }
    const message = err instanceof Error ? err.message : String(err);
    console.error("stripe-webhook handler:", message);
    return json({ error: message }, 500);
  }
});
