export type PlanKey = "solo" | "studio" | "agency";

export const PLAN_KEYS: PlanKey[] = ["solo", "studio", "agency"];

export function isPlanKey(value: unknown): value is PlanKey {
  return value === "solo" || value === "studio" || value === "agency";
}

/** Resolve Stripe Price ID for a plan from Deno env. */
export function priceIdForPlan(plan: PlanKey): string | null {
  const map: Record<PlanKey, string | undefined> = {
    solo: Deno.env.get("STRIPE_PRICE_SOLO") ?? undefined,
    studio: Deno.env.get("STRIPE_PRICE_STUDIO") ?? undefined,
    agency: Deno.env.get("STRIPE_PRICE_AGENCY") ?? undefined,
  };
  const priceId = map[plan]?.trim();
  return priceId || null;
}

export function planFromPriceId(priceId: string | null | undefined): PlanKey | null {
  if (!priceId) return null;
  for (const plan of PLAN_KEYS) {
    if (priceIdForPlan(plan) === priceId) return plan;
  }
  return null;
}
