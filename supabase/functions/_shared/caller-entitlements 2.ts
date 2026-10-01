import {
  entitlementsForPlan,
  inheritPlanFeatures,
  isAssignablePlan,
  type PlanEntitlements,
} from "./plan-entitlements.ts";
import { isAdminMasterEmail } from "./admin-master.ts";
import {
  findUserById,
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
    const owner = await findUserById(admin, membership.owner_user_id);
    if (isAdminMasterEmail(owner?.email)) {
      return inheritPlanFeatures(entitlementsForPlan(null, { isMaster: true }));
    }

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

/** Client login inherits paid features from the brand owner (gestor). */
export async function loadClientInheritedEntitlements(
  admin: AnyClient,
  clientUserId: string,
): Promise<PlanEntitlements> {
  const { data: member, error: memberError } = await admin
    .from("client_members")
    .select("client_id")
    .eq("user_id", clientUserId)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (memberError) throw new Error(memberError.message);
  if (!member?.client_id) return entitlementsForPlan(null);

  const { data: client, error: clientError } = await admin
    .from("clients")
    .select("created_by")
    .eq("id", member.client_id)
    .maybeSingle();
  if (clientError) throw new Error(clientError.message);
  if (!client?.created_by) return entitlementsForPlan(null);

  const owner = await findUserById(admin, client.created_by);
  const ownerEntitlements = await loadCallerEntitlements(
    admin,
    client.created_by,
    owner?.email,
  );
  return inheritPlanFeatures(ownerEntitlements);
}

/** Gestor: own/team plan. Client: paid features of the brand owner. */
export async function loadViewerEntitlements(
  admin: AnyClient,
  userId: string,
  email: string | null | undefined,
): Promise<PlanEntitlements> {
  if (isAdminMasterEmail(email)) {
    return entitlementsForPlan(null, { isMaster: true });
  }

  const caller = await loadCallerEntitlements(admin, userId, email);
  if (caller.plan || caller.isTeamOwner || caller.isMaster) {
    return caller;
  }

  return loadClientInheritedEntitlements(admin, userId);
}
