import { createServerFn } from "@tanstack/react-start";
import type { User } from "@supabase/supabase-js";
import { z } from "zod";
import { ADMIN_MASTER_EMAIL, isAdminMasterEmail } from "@/lib/admin-master";
import {
  ASSIGNABLE_PLANS,
  entitlementsForPlan,
  isAssignablePlan,
  type AssignablePlan,
  type PlanEntitlements,
} from "@/lib/plan-entitlements";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { supabaseAdmin as SupabaseAdmin } from "@/integrations/supabase/client.server";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

const provisionInput = z.object({
  email: z.string().trim().email(),
  password: z.string().min(6),
  fullName: z.string().trim().optional(),
  plan: z.enum(ASSIGNABLE_PLANS).default("courtesy"),
});

const setPlanInput = z.object({
  userId: z.string().uuid(),
  plan: z.enum(ASSIGNABLE_PLANS),
});

export type ProvisionGestorAccessResult = {
  userId: string;
  email: string;
  created: boolean;
  plan: AssignablePlan;
};

export type GestorListItem = {
  userId: string;
  email: string;
  fullName: string | null;
  isMaster: boolean;
  plan: AssignablePlan | null;
  planStatus: string | null;
  planSource: "stripe" | "manual" | null;
};

type AdminClient = typeof SupabaseAdmin;
type AuthedClient = SupabaseClient<Database>;

function isEmailAlreadyRegistered(message: string): boolean {
  const normalized = message.toLowerCase();
  return (
    normalized.includes("already been registered") ||
    normalized.includes("already registered") ||
    normalized.includes("user already exists") ||
    normalized.includes("email address has already")
  );
}

async function findUserIdByEmail(admin: AdminClient, email: string): Promise<string | null> {
  let page = 1;
  for (;;) {
    const { data, error } = await admin.auth.admin.listUsers({
      page,
      perPage: 200,
    });
    if (error) throw new Error(error.message);

    const match = data.users.find((user: User) => (user.email ?? "").toLowerCase() === email);
    if (match?.id) return match.id;

    const lastPage = data.lastPage ?? page;
    if (page >= lastPage || data.users.length === 0) return null;
    page += 1;
  }
}

async function findUserById(admin: AdminClient, userId: string): Promise<User | null> {
  const { data, error } = await admin.auth.admin.getUserById(userId);
  if (error) throw new Error(error.message);
  return data.user ?? null;
}

async function requireAdminMaster(
  supabase: AuthedClient,
  userId: string,
  admin: AdminClient,
): Promise<void> {
  const { data: isAdmin, error: adminError } = await supabase.rpc("is_admin");
  if (adminError) throw new Error(adminError.message);
  if (!isAdmin) throw new Error("Apenas o administrador pode liberar gestores.");

  const caller = await findUserById(admin, userId);
  if (!isAdminMasterEmail(caller?.email)) {
    throw new Error("Apenas o administrador pode liberar gestores.");
  }
}

type SubscriptionRow = {
  user_id: string | null;
  plan: string;
  status: string;
  source: string | null;
  updated_at: string;
};

function pickActiveSubscription(rows: SubscriptionRow[]): SubscriptionRow | null {
  const active = rows
    .filter((row) => row.status === "active" || row.status === "trialing")
    .sort((a, b) => {
      // Manual (admin) assignment wins over Stripe when both are active.
      if (a.source === "manual" && b.source !== "manual") return -1;
      if (b.source === "manual" && a.source !== "manual") return 1;
      return b.updated_at.localeCompare(a.updated_at);
    });
  return active[0] ?? null;
}

async function upsertManualPlan(
  admin: AdminClient,
  input: { userId: string; email: string; plan: AssignablePlan },
): Promise<void> {
  const { data: existing } = await admin
    .from("subscriptions")
    .select("id")
    .eq("user_id", input.userId)
    .eq("source", "manual")
    .maybeSingle();

  if (existing?.id) {
    const { error: updateError } = await admin
      .from("subscriptions")
      .update({
        plan: input.plan,
        status: "active",
        email: input.email,
        cancel_at_period_end: false,
      })
      .eq("id", existing.id);
    if (updateError) throw new Error(updateError.message);
    return;
  }

  const { error: insertError } = await admin.from("subscriptions").insert({
    user_id: input.userId,
    email: input.email,
    plan: input.plan,
    status: "active",
    source: "manual",
    stripe_customer_id: null,
    stripe_subscription_id: null,
    stripe_price_id: null,
    current_period_end: null,
    cancel_at_period_end: false,
  });
  if (insertError) throw new Error(insertError.message);
}

export const listGestoresFn = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<GestorListItem[]> => {
    const { supabase, userId } = context;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await requireAdminMaster(supabase, userId, supabaseAdmin);

    const { data: roles, error: rolesError } = await supabaseAdmin
      .from("user_roles")
      .select("user_id")
      .eq("role", "admin");
    if (rolesError) throw new Error(rolesError.message);

    const adminIds = [...new Set((roles ?? []).map((row) => row.user_id))];
    if (adminIds.length === 0) return [];

    const { data: profiles, error: profilesError } = await supabaseAdmin
      .from("profiles")
      .select("id, full_name")
      .in("id", adminIds);
    if (profilesError) throw new Error(profilesError.message);

    const { data: subscriptions, error: subsError } = await supabaseAdmin
      .from("subscriptions")
      .select("user_id, plan, status, source, updated_at")
      .in("user_id", adminIds);
    if (subsError) throw new Error(subsError.message);

    const subsByUser = new Map<string, SubscriptionRow[]>();
    for (const row of subscriptions ?? []) {
      if (!row.user_id) continue;
      const list = subsByUser.get(row.user_id) ?? [];
      list.push(row as SubscriptionRow);
      subsByUser.set(row.user_id, list);
    }

    const nameById = new Map((profiles ?? []).map((p) => [p.id, p.full_name]));

    const items: GestorListItem[] = [];
    for (const id of adminIds) {
      const user = await findUserById(supabaseAdmin, id);
      const email = (user?.email ?? "").toLowerCase();
      if (!email) continue;
      const active = pickActiveSubscription(subsByUser.get(id) ?? []);
      const plan = active && isAssignablePlan(active.plan) ? active.plan : null;
      items.push({
        userId: id,
        email,
        fullName: nameById.get(id) ?? null,
        isMaster: isAdminMasterEmail(email),
        plan,
        planStatus: active?.status ?? null,
        planSource:
          active?.source === "stripe" || active?.source === "manual"
            ? active.source
            : null,
      });
    }

    items.sort((a, b) => {
      if (a.isMaster !== b.isMaster) return a.isMaster ? -1 : 1;
      return (a.fullName || a.email).localeCompare(b.fullName || b.email, "pt-BR");
    });

    return items;
  });

export const provisionGestorAccessFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(provisionInput)
  .handler(async ({ data, context }): Promise<ProvisionGestorAccessResult> => {
    const { supabase, userId: callerId } = context;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await requireAdminMaster(supabase, callerId, supabaseAdmin);

    const email = data.email.trim().toLowerCase();
    if (email === ADMIN_MASTER_EMAIL) {
      throw new Error("Não é possível alterar o acesso do administrador por aqui.");
    }

    let userId = await findUserIdByEmail(supabaseAdmin, email);
    let created = false;

    if (userId) {
      const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(userId, {
        password: data.password,
        email_confirm: true,
      });
      if (updateError) throw new Error(updateError.message);
    } else {
      const { data: createdUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
        email,
        password: data.password,
        email_confirm: true,
        user_metadata: data.fullName ? { full_name: data.fullName } : undefined,
      });

      if (createError) {
        if (!isEmailAlreadyRegistered(createError.message)) {
          throw new Error(createError.message);
        }
        userId = await findUserIdByEmail(supabaseAdmin, email);
        if (!userId) {
          throw new Error("Usuário já existe, mas não foi possível localizá-lo.");
        }
        const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(userId, {
          password: data.password,
          email_confirm: true,
        });
        if (updateError) throw new Error(updateError.message);
      } else {
        if (!createdUser.user) throw new Error("Não foi possível criar o usuário.");
        userId = createdUser.user.id;
        created = true;
      }
    }

    const displayName = data.fullName?.trim() || email.split("@")[0] || null;
    if (displayName) {
      const { error: profileError } = await supabaseAdmin.from("profiles").upsert({
        id: userId,
        full_name: displayName,
      });
      if (profileError) throw new Error(profileError.message);
    }

    const { error: roleError } = await supabaseAdmin.from("user_roles").insert({
      user_id: userId,
      role: "admin",
    });
    if (roleError && roleError.code !== "23505") {
      throw new Error(roleError.message);
    }

    const plan = data.plan;
    await upsertManualPlan(supabaseAdmin, { userId, email, plan });

    return { userId, email, created, plan };
  });

export const setGestorPlanFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(setPlanInput)
  .handler(async ({ data, context }): Promise<{ userId: string; plan: AssignablePlan }> => {
    const { supabase, userId: callerId } = context;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await requireAdminMaster(supabase, callerId, supabaseAdmin);

    const user = await findUserById(supabaseAdmin, data.userId);
    const email = (user?.email ?? "").toLowerCase();
    if (!email) throw new Error("Usuário não encontrado.");
    if (isAdminMasterEmail(email)) {
      throw new Error("O administrador não precisa de plano atribuído.");
    }

    await upsertManualPlan(supabaseAdmin, {
      userId: data.userId,
      email,
      plan: data.plan,
    });

    return { userId: data.userId, plan: data.plan };
  });

export const getMyEntitlementsFn = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<PlanEntitlements> => {
    const { supabase, userId } = context;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const user = await findUserById(supabaseAdmin, userId);
    if (isAdminMasterEmail(user?.email)) {
      return entitlementsForPlan(null, { isMaster: true });
    }

    const { data: isAdmin, error: adminError } = await supabase.rpc("is_admin");
    if (adminError) throw new Error(adminError.message);
    if (!isAdmin) {
      return entitlementsForPlan(null);
    }

    const { data: rows, error } = await supabaseAdmin
      .from("subscriptions")
      .select("user_id, plan, status, source, updated_at")
      .eq("user_id", userId);
    if (error) throw new Error(error.message);

    const active = pickActiveSubscription((rows ?? []) as SubscriptionRow[]);
    const plan = active && isAssignablePlan(active.plan) ? active.plan : null;
    return entitlementsForPlan(plan);
  });
