/** Plan entitlements for SOM subscription tiers. */

export const ASSIGNABLE_PLANS = ["solo", "studio", "agency", "courtesy"] as const;

export type AssignablePlan = (typeof ASSIGNABLE_PLANS)[number];

/** Paid plans available on Stripe checkout (no courtesy). */
export type PaidPlan = "solo" | "studio" | "agency";

export type PlanEntitlements = {
  plan: AssignablePlan | null;
  /** null = unlimited (admin master or courtesy testing). */
  maxClients: number | null;
  brandBriefing: boolean;
  library: boolean;
  presets: boolean;
  designAi: boolean;
  /** True when caller is platform admin master (full access). */
  isMaster: boolean;
};

const ENTITLEMENTS: Record<AssignablePlan, Omit<PlanEntitlements, "plan" | "isMaster">> = {
  solo: {
    maxClients: 1,
    brandBriefing: false,
    library: false,
    presets: false,
    designAi: false,
  },
  studio: {
    maxClients: 3,
    brandBriefing: true,
    library: true,
    presets: true,
    designAi: true,
  },
  agency: {
    maxClients: 10,
    brandBriefing: true,
    library: true,
    presets: true,
    designAi: true,
  },
  courtesy: {
    maxClients: null,
    brandBriefing: true,
    library: true,
    presets: true,
    designAi: true,
  },
};

export function isAssignablePlan(value: unknown): value is AssignablePlan {
  return (
    typeof value === "string" &&
    (ASSIGNABLE_PLANS as readonly string[]).includes(value)
  );
}

export function entitlementsForPlan(
  plan: AssignablePlan | null | undefined,
  opts?: { isMaster?: boolean },
): PlanEntitlements {
  if (opts?.isMaster) {
    return {
      plan: plan ?? null,
      maxClients: null,
      brandBriefing: true,
      library: true,
      presets: true,
      designAi: true,
      isMaster: true,
    };
  }

  if (!plan || !isAssignablePlan(plan)) {
    return {
      plan: null,
      maxClients: 0,
      brandBriefing: false,
      library: false,
      presets: false,
      designAi: false,
      isMaster: false,
    };
  }

  return {
    plan,
    ...ENTITLEMENTS[plan],
    isMaster: false,
  };
}

export function canCreateAnotherClient(
  entitlements: PlanEntitlements,
  currentClientCount: number,
): boolean {
  if (entitlements.isMaster) return true;
  if (entitlements.maxClients === null) return true;
  return currentClientCount < entitlements.maxClients;
}
