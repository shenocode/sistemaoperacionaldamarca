import { createServerFn } from "@tanstack/react-start";
import type { User } from "@supabase/supabase-js";
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { isAdminMasterEmail } from "@/lib/admin-master";
import {
  canCreateAnotherClient,
  entitlementsForPlan,
  isAssignablePlan,
  type AssignablePlan,
} from "@/lib/plan-entitlements";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { supabaseAdmin as SupabaseAdmin } from "@/integrations/supabase/client.server";
import type { Database } from "@/integrations/supabase/types";

const reassignInput = z.object({
  clientId: z.string().uuid(),
  newGestorUserId: z.string().uuid(),
});

export type ReassignClientGestorResult = {
  clientId: string;
  previousGestorUserId: string | null;
  newGestorUserId: string;
};

export type ClientGestorInfo = {
  userId: string;
  email: string;
  fullName: string | null;
  isMaster: boolean;
};

type AdminClient = typeof SupabaseAdmin;
type AuthedClient = SupabaseClient<Database>;

type SubscriptionRow = {
  user_id: string | null;
  plan: string;
  status: string;
  source: string | null;
  updated_at: string;
};

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
  if (!isAdmin) throw new Error("Apenas o administrador pode migrar clientes.");

  const caller = await findUserById(admin, userId);
  if (!isAdminMasterEmail(caller?.email)) {
    throw new Error("Apenas o administrador pode migrar clientes.");
  }
}

function pickActiveSubscription(rows: SubscriptionRow[]): SubscriptionRow | null {
  const active = rows
    .filter((row) => row.status === "active" || row.status === "trialing")
    .sort((a, b) => {
      if (a.source === "manual" && b.source !== "manual") return -1;
      if (b.source === "manual" && a.source !== "manual") return 1;
      return b.updated_at.localeCompare(a.updated_at);
    });
  return active[0] ?? null;
}

async function resolveGestorInfo(
  admin: AdminClient,
  userId: string,
): Promise<ClientGestorInfo | null> {
  const user = await findUserById(admin, userId);
  const email = (user?.email ?? "").toLowerCase();
  if (!email) return null;

  const { data: profile } = await admin
    .from("profiles")
    .select("full_name")
    .eq("id", userId)
    .maybeSingle();

  return {
    userId,
    email,
    fullName: profile?.full_name ?? null,
    isMaster: isAdminMasterEmail(email),
  };
}

async function assertGestorCanReceiveClient(
  admin: AdminClient,
  gestorUserId: string,
  clientId: string,
  previousCreatedBy: string | null,
): Promise<void> {
  const user = await findUserById(admin, gestorUserId);
  const email = (user?.email ?? "").toLowerCase();
  if (!email) throw new Error("Gestor não encontrado.");

  if (isAdminMasterEmail(email)) return;

  const { data: subs, error: subsError } = await admin
    .from("subscriptions")
    .select("user_id, plan, status, source, updated_at")
    .eq("user_id", gestorUserId);
  if (subsError) throw new Error(subsError.message);

  const active = pickActiveSubscription((subs ?? []) as SubscriptionRow[]);
  const plan = active && isAssignablePlan(active.plan) ? (active.plan as AssignablePlan) : null;
  const entitlements = entitlementsForPlan(plan);

  if (previousCreatedBy === gestorUserId) return;

  const { count, error: countError } = await admin
    .from("clients")
    .select("id", { count: "exact", head: true })
    .eq("created_by", gestorUserId)
    .neq("id", clientId);
  if (countError) throw new Error(countError.message);

  if (!canCreateAnotherClient(entitlements, count ?? 0)) {
    const max = entitlements.maxClients ?? 0;
    throw new Error(
      max <= 0
        ? "O gestor de destino não tem plano ativo para receber clientes."
        : `O gestor de destino atingiu o limite do plano (${max} cliente${max === 1 ? "" : "s"}).`,
    );
  }
}

/** Current owning gestor for a client (admin master only). */
export const getClientGestorFn = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .validator(z.object({ clientId: z.string().uuid() }))
  .handler(async ({ data, context }): Promise<ClientGestorInfo | null> => {
    const { supabase, userId } = context;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await requireAdminMaster(supabase, userId, supabaseAdmin);

    const { data: client, error: clientError } = await supabaseAdmin
      .from("clients")
      .select("created_by")
      .eq("id", data.clientId)
      .maybeSingle();
    if (clientError) throw new Error(clientError.message);
    if (!client) throw new Error("Cliente não encontrado.");

    const { data: owners, error: ownersError } = await supabaseAdmin
      .from("client_members")
      .select("user_id")
      .eq("client_id", data.clientId)
      .eq("role", "owner");
    if (ownersError) throw new Error(ownersError.message);

    const ownerIds = (owners ?? []).map((row) => row.user_id);
    const preferredId =
      (client.created_by && ownerIds.includes(client.created_by)
        ? client.created_by
        : null) ??
      client.created_by ??
      ownerIds[0] ??
      null;

    if (!preferredId) return null;
    return resolveGestorInfo(supabaseAdmin, preferredId);
  });

/**
 * Moves a client to another gestor: updates `clients.created_by` and
 * `client_members` owner rows. Client platform logins (`member`) are preserved.
 * Admin master only.
 */
export const reassignClientGestorFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(reassignInput)
  .handler(async ({ data, context }): Promise<ReassignClientGestorResult> => {
    const { supabase, userId: callerId } = context;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await requireAdminMaster(supabase, callerId, supabaseAdmin);

    const { data: client, error: clientError } = await supabaseAdmin
      .from("clients")
      .select("id, created_by, name")
      .eq("id", data.clientId)
      .maybeSingle();
    if (clientError) throw new Error(clientError.message);
    if (!client) throw new Error("Cliente não encontrado.");

    const { data: adminRole, error: roleError } = await supabaseAdmin
      .from("user_roles")
      .select("user_id")
      .eq("user_id", data.newGestorUserId)
      .eq("role", "admin")
      .maybeSingle();
    if (roleError) throw new Error(roleError.message);
    if (!adminRole) {
      throw new Error("O usuário selecionado não é um gestor.");
    }

    const { data: memberRow, error: memberLookupError } = await supabaseAdmin
      .from("client_members")
      .select("role")
      .eq("client_id", data.clientId)
      .eq("user_id", data.newGestorUserId)
      .maybeSingle();
    if (memberLookupError) throw new Error(memberLookupError.message);
    if (memberRow?.role === "member") {
      throw new Error(
        "Este usuário é o login do cliente nesta conta. Escolha outro gestor.",
      );
    }

    await assertGestorCanReceiveClient(
      supabaseAdmin,
      data.newGestorUserId,
      data.clientId,
      client.created_by,
    );

    const previousGestorUserId = client.created_by;

    if (previousGestorUserId !== data.newGestorUserId) {
      const { error: updateError } = await supabaseAdmin
        .from("clients")
        .update({ created_by: data.newGestorUserId })
        .eq("id", data.clientId);
      if (updateError) throw new Error(updateError.message);
    }

    const { error: revokeOwnersError } = await supabaseAdmin
      .from("client_members")
      .delete()
      .eq("client_id", data.clientId)
      .eq("role", "owner")
      .neq("user_id", data.newGestorUserId);
    if (revokeOwnersError) throw new Error(revokeOwnersError.message);

    if (memberRow?.role === "owner") {
      // Already owner — nothing else to insert.
    } else {
      const { error: insertOwnerError } = await supabaseAdmin.from("client_members").insert({
        client_id: data.clientId,
        user_id: data.newGestorUserId,
        role: "owner",
      });
      if (insertOwnerError && insertOwnerError.code !== "23505") {
        throw new Error(insertOwnerError.message);
      }
      if (insertOwnerError?.code === "23505") {
        const { error: promoteError } = await supabaseAdmin
          .from("client_members")
          .update({ role: "owner" })
          .eq("client_id", data.clientId)
          .eq("user_id", data.newGestorUserId);
        if (promoteError) throw new Error(promoteError.message);
      }
    }

    return {
      clientId: data.clientId,
      previousGestorUserId,
      newGestorUserId: data.newGestorUserId,
    };
  });
