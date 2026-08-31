import {
  entitlementsForPlan,
  isAssignablePlan,
  type PlanEntitlements,
} from "./plan-entitlements.ts";
import { isAdminMasterEmail } from "./admin-master.ts";
import {
  pickActiveSubscription,
  type AnyClient,
  type SubscriptionRow,
} from "./admin-clients.ts";

export async function loadCallerEntitlements(
  admin: AnyClient,
  userId: string,
  email: string | null | undefined,
): Promise<PlanEntitlements> {
  if (isAdminMasterEmail(email)) {
    return entitlementsForPlan(null, { isMaster: true });
  }

  const { data: rows, error } = await admin
    .from("subscriptions")
    .select("user_id, plan, status, source, updated_at, current_period_end")
    .eq("user_id", userId);
  if (error) throw new Error(error.message);

  const active = pickActiveSubscription((rows ?? []) as SubscriptionRow[]);
  if (active && isAssignablePlan(active.plan)) {
    return entitlementsForPlan(active.plan, { isTeamOwner: true });
  }

  const { data: membership, error: teamError } = await admin
    .from("team_memberships")
    .select("owner_user_id")
    .eq("member_user_id", userId)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (teamError) throw new Error(teamError.message);

  if (membership?.owner_user_id) {
    const { data: ownerRows, error: ownerError } = await admin
      .from("subscriptions")
      .select("user_id, plan, status, source, updated_at, current_period_end")
      .eq("user_id", membership.owner_user_id);
    if (ownerError) throw new Error(ownerError.message);
    const ownerActive = pickActiveSubscription((ownerRows ?? []) as SubscriptionRow[]);
    const ownerPlan = ownerActive && isAssignablePlan(ownerActive.plan) ? ownerActive.plan : null;
    return entitlementsForPlan(ownerPlan, { asCollaborator: true });
  }

  return entitlementsForPlan(null);
}
