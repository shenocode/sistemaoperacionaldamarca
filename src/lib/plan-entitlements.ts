/** Plan entitlements for SOM subscription tiers. */

export const ASSIGNABLE_PLANS = ["solo", "studio", "agency", "courtesy"] as const;

export type AssignablePlan = (typeof ASSIGNABLE_PLANS)[number];

/** Paid plans available on Stripe checkout (no courtesy). */
export type PaidPlan = "solo" | "studio" | "agency";

export type PlanEntitlements = {
  plan: AssignablePlan | null;
  /** null = unlimited (admin master or courtesy testing). */
  maxClients: number | null;
  /** null = unlimited. Includes the plan owner seat. */
  maxUsers: number | null;
  brandBriefing: boolean;
  library: boolean;
  presets: boolean;
  designAi: boolean;
  /** True when caller is platform admin master (full access). */
  isMaster: boolean;
  /** True when caller owns the subscription (not a team collaborator). */
  isTeamOwner: boolean;
  /** True when caller may invite/manage team members. */
  canManageTeam: boolean;
};

const ENTITLEMENTS: Record<AssignablePlan, Omit<PlanEntitlements, "plan" | "isMaster" | "isTeamOwner" | "canManageTeam">> = {
  solo: {
    maxClients: 1,
    maxUsers: 1,
    brandBriefing: false,
    library: false,
    presets: false,
    designAi: false,
  },
  studio: {
    maxClients: 3,
    maxUsers: 3,
    brandBriefing: true,
    library: true,
    presets: true,
    designAi: true,
  },
  agency: {
    maxClients: 5,
    maxUsers: 10,
    brandBriefing: true,
    library: true,
    presets: true,
    designAi: true,
  },
  courtesy: {
    maxClients: null,
    maxUsers: null,
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

function canManageTeamFor(
  maxUsers: number | null,
  opts: { isMaster?: boolean; isTeamOwner?: boolean },
): boolean {
  if (opts.isMaster) return true;
  if (!opts.isTeamOwner) return false;
  if (maxUsers === null) return true;
  return maxUsers > 1;
}

export function entitlementsForPlan(
  plan: AssignablePlan | null | undefined,
  opts?: {
    isMaster?: boolean;
    isTeamOwner?: boolean;
    /** When true, collaborator inherits features but cannot create clients. */
    asCollaborator?: boolean;
  },
): PlanEntitlements {
  if (opts?.isMaster) {
    return {
      plan: plan ?? null,
      maxClients: null,
      maxUsers: null,
      brandBriefing: true,
      library: true,
      presets: true,
      designAi: true,
      isMaster: true,
      isTeamOwner: true,
      canManageTeam: true,
    };
  }

  if (!plan || !isAssignablePlan(plan)) {
    return {
      plan: null,
      maxClients: 0,
      maxUsers: 0,
      brandBriefing: false,
      library: false,
      presets: false,
      designAi: false,
      isMaster: false,
      isTeamOwner: false,
      canManageTeam: false,
    };
  }

  const base = ENTITLEMENTS[plan];
  const isTeamOwner = opts?.asCollaborator ? false : (opts?.isTeamOwner ?? true);
  const maxClients = opts?.asCollaborator ? 0 : base.maxClients;

  return {
    plan,
    ...base,
    maxClients,
    isMaster: false,
    isTeamOwner,
    canManageTeam: canManageTeamFor(base.maxUsers, { isTeamOwner }),
  };
}

/** Feature flags of a workspace owner, without team/client management. */
export function inheritPlanFeatures(owner: PlanEntitlements): PlanEntitlements {
  if (owner.isMaster) {
    return entitlementsForPlan("courtesy", { asCollaborator: true });
  }
  return entitlementsForPlan(owner.plan, { asCollaborator: true });
}

export function canCreateAnotherClient(
  entitlements: PlanEntitlements,
  currentClientCount: number,
): boolean {
  if (entitlements.isMaster) return true;
  if (!entitlements.isTeamOwner) return false;
  if (entitlements.maxClients === null) return true;
  return currentClientCount < entitlements.maxClients;
}

export function canInviteAnotherTeamMember(
  entitlements: PlanEntitlements,
  currentSeatCount: number,
): boolean {
  if (!entitlements.canManageTeam) return false;
  if (entitlements.isMaster) return true;
  if (entitlements.maxUsers === null) return true;
  return currentSeatCount < entitlements.maxUsers;
}

const PAID_PLAN_ORDER = ["solo", "studio", "agency"] as const satisfies readonly PaidPlan[];

/** Paid tiers above the current plan (empty for courtesy, agency, or no plan). */
export function nextPaidPlans(plan: AssignablePlan | null): PaidPlan[] {
  if (!plan || plan === "courtesy") return [];
  const index = PAID_PLAN_ORDER.indexOf(plan);
  if (index < 0) return [];
  return PAID_PLAN_ORDER.slice(index + 1);
}

export function allPaidPlans(): PaidPlan[] {
  return [...PAID_PLAN_ORDER];
}
