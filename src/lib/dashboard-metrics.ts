import type { AssignablePlan, PaidPlan } from "@/lib/plan-entitlements";
import { ASSIGNABLE_PLANS } from "@/lib/plan-entitlements";

/** Display prices from landing (BRL/month). Not Stripe invoice amounts. */
export const PLAN_MONTHLY_PRICE_BRL: Record<PaidPlan, number> = {
  solo: 97,
  studio: 347,
  agency: 697,
};

export type DashboardAssinanteInput = {
  isMaster: boolean;
  isActive: boolean;
  plan: AssignablePlan | null;
  clientCount: number;
};

export type MonthlySeriesPoint = {
  /** YYYY-MM */
  month: string;
  subscribers: number;
  leads: number;
};

export type PlanMixItem = {
  plan: AssignablePlan;
  count: number;
};

export type DashboardBusinessStats = {
  activeSubscribers: number;
  estimatedMrr: number;
  leadsThisMonth: number;
  totalClients: number;
  monthlySeries: MonthlySeriesPoint[];
  planMix: PlanMixItem[];
};

function isPaidPlan(plan: AssignablePlan | null): plan is PaidPlan {
  return plan === "solo" || plan === "studio" || plan === "agency";
}

function monthKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

/** Last `months` calendar months including the current month, oldest first. */
export function buildMonthKeys(months = 6, now = new Date()): string[] {
  const keys: string[] = [];
  const cursor = new Date(now.getFullYear(), now.getMonth(), 1);
  for (let i = months - 1; i >= 0; i -= 1) {
    const d = new Date(cursor.getFullYear(), cursor.getMonth() - i, 1);
    keys.push(monthKey(d));
  }
  return keys;
}

export function countByMonth(isoDates: string[], monthKeys: string[]): Record<string, number> {
  const counts: Record<string, number> = Object.fromEntries(monthKeys.map((k) => [k, 0]));
  for (const iso of isoDates) {
    const key = monthKey(new Date(iso));
    if (key in counts) counts[key] += 1;
  }
  return counts;
}

export function computeDashboardBusinessStats(input: {
  assinantes: DashboardAssinanteInput[];
  subscriptionCreatedAts: string[];
  leadCreatedAts: string[];
  now?: Date;
}): DashboardBusinessStats {
  const now = input.now ?? new Date();
  const currentMonth = monthKey(now);
  const monthKeys = buildMonthKeys(6, now);

  const activeNonMaster = input.assinantes.filter((a) => a.isActive && !a.isMaster);

  const activeSubscribers = activeNonMaster.length;

  const estimatedMrr = activeNonMaster.reduce((sum, a) => {
    if (!isPaidPlan(a.plan)) return sum;
    return sum + PLAN_MONTHLY_PRICE_BRL[a.plan];
  }, 0);

  const leadsThisMonth = input.leadCreatedAts.filter(
    (iso) => monthKey(new Date(iso)) === currentMonth,
  ).length;

  const totalClients = activeNonMaster.reduce((sum, a) => sum + (a.clientCount || 0), 0);

  const subCounts = countByMonth(input.subscriptionCreatedAts, monthKeys);
  const leadCounts = countByMonth(input.leadCreatedAts, monthKeys);
  const monthlySeries: MonthlySeriesPoint[] = monthKeys.map((month) => ({
    month,
    subscribers: subCounts[month] ?? 0,
    leads: leadCounts[month] ?? 0,
  }));

  const planCounts = Object.fromEntries(ASSIGNABLE_PLANS.map((p) => [p, 0])) as Record<
    AssignablePlan,
    number
  >;
  for (const a of activeNonMaster) {
    if (a.plan && a.plan in planCounts) planCounts[a.plan] += 1;
  }
  const planMix: PlanMixItem[] = ASSIGNABLE_PLANS.map((plan) => ({
    plan,
    count: planCounts[plan],
  }));

  return {
    activeSubscribers,
    estimatedMrr,
    leadsThisMonth,
    totalClients,
    monthlySeries,
    planMix,
  };
}

export function formatMrrBrl(value: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 0,
  }).format(value);
}
