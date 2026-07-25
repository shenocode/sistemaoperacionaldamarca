import { createServerFn } from "@tanstack/react-start";
import type { User } from "@supabase/supabase-js";
import { z } from "zod";
import { ADMIN_MASTER_EMAIL, isAdminMasterEmail } from "@/lib/admin-master";
import {
  canInviteAnotherTeamMember,
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
});

const memberIdInput = z.object({
  memberUserId: z.string().uuid(),
});

const resetPasswordInput = z.object({
  memberUserId: z.string().uuid(),
  password: z.string().min(6),
});

const setClientsInput = z.object({
  memberUserId: z.string().uuid(),
  clientIds: z.array(z.string().uuid()),
});

export type TeamClientSummary = {
  id: string;
  name: string;
};

export type TeamMemberListItem = {
  userId: string;
  email: string;
  fullName: string | null;
  clientIds: string[];
  createdAt: string;
};

export type ListMyTeamResult = {
  members: TeamMemberListItem[];
  clients: TeamClientSummary[];
  seatCount: number;
  maxUsers: number | null;
  canManageTeam: boolean;
};

export type ProvisionTeamMemberResult = {
  userId: string;
  email: string;
  created: boolean;
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

function isEmailAlreadyRegistered(message: string): boolean {
  const normalized = message.toLowerCase();
  return (
    normalized.includes("already been registered") ||
    normalized.includes("already registered") ||
    normalized.includes("user already exists") ||
    normalized.includes("email address has already")
  );
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

async function loadOwnerEntitlements(
  admin: AdminClient,
  ownerUserId: string,
  ownerEmail: string | null | undefined,
): Promise<PlanEntitlements> {
  if (isAdminMasterEmail(ownerEmail)) {
    return entitlementsForPlan(null, { isMaster: true });
  }

  const { data: rows, error } = await admin
    .from("subscriptions")
    .select("user_id, plan, status, source, updated_at")
    .eq("user_id", ownerUserId);
  if (error) throw new Error(error.message);

  const active = pickActiveSubscription((rows ?? []) as SubscriptionRow[]);
  const plan = active && isAssignablePlan(active.plan) ? (active.plan as AssignablePlan) : null;
  return entitlementsForPlan(plan, { isTeamOwner: Boolean(plan) });
}

async function requireTeamOwner(
  supabase: AuthedClient,
  callerId: string,
  admin: AdminClient,
): Promise<{ entitlements: PlanEntitlements; email: string }> {
  const { data: isAdmin, error: adminError } = await supabase.rpc("is_admin");
  if (adminError) throw new Error(adminError.message);
  if (!isAdmin) throw new Error("Apenas gestores podem gerenciar a equipe.");

  const caller = await findUserById(admin, callerId);
  const email = (caller?.email ?? "").toLowerCase();
  const entitlements = await loadOwnerEntitlements(admin, callerId, email);

  if (!entitlements.canManageTeam) {
    throw new Error(
      "Seu plano não permite gerenciar equipe. Atualize para Studio ou Agência.",
    );
  }

  // Collaborators inherit features but are not team owners.
  if (!entitlements.isTeamOwner && !entitlements.isMaster) {
    throw new Error("Apenas o gestor dono do plano pode gerenciar a equipe.");
  }

  // Confirm caller is not only a collaborator on someone else's team.
  if (!entitlements.isMaster) {
    const { data: ownSub } = await admin
      .from("subscriptions")
      .select("user_id, plan, status, source, updated_at")
      .eq("user_id", callerId);
    const active = pickActiveSubscription((ownSub ?? []) as SubscriptionRow[]);
    if (!active) {
      throw new Error("Apenas o gestor dono do plano pode gerenciar a equipe.");
    }
  }

  return { entitlements, email };
}

async function countSeats(admin: AdminClient, ownerUserId: string): Promise<number> {
  const { count, error } = await admin
    .from("team_memberships")
    .select("id", { count: "exact", head: true })
    .eq("owner_user_id", ownerUserId);
  if (error) throw new Error(error.message);
  // Owner seat + collaborators
  return 1 + (count ?? 0);
}

async function assertMemberOnTeam(
  admin: AdminClient,
  ownerUserId: string,
  memberUserId: string,
): Promise<void> {
  const { data, error } = await admin
    .from("team_memberships")
    .select("id")
    .eq("owner_user_id", ownerUserId)
    .eq("member_user_id", memberUserId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Este usuário não faz parte da sua equipe.");
}

async function listOwnerClients(
  admin: AdminClient,
  ownerUserId: string,
): Promise<TeamClientSummary[]> {
  const { data, error } = await admin
    .from("clients")
    .select("id, name")
    .eq("created_by", ownerUserId)
    .order("name", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []).map((row) => ({ id: row.id, name: row.name }));
}

export const listMyTeamFn = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<ListMyTeamResult> => {
    const { supabase, userId } = context;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { entitlements } = await requireTeamOwner(supabase, userId, supabaseAdmin);

    const clients = await listOwnerClients(supabaseAdmin, userId);
    const clientIds = clients.map((c) => c.id);

    const { data: memberships, error: teamError } = await supabaseAdmin
      .from("team_memberships")
      .select("member_user_id, created_at")
      .eq("owner_user_id", userId)
      .order("created_at", { ascending: true });
    if (teamError) throw new Error(teamError.message);

    const memberIds = (memberships ?? []).map((row) => row.member_user_id);
    const assignedByMember = new Map<string, string[]>();

    if (memberIds.length > 0 && clientIds.length > 0) {
      const { data: memberRows, error: membersError } = await supabaseAdmin
        .from("client_members")
        .select("client_id, user_id")
        .in("user_id", memberIds)
        .in("client_id", clientIds)
        .eq("role", "owner");
      if (membersError) throw new Error(membersError.message);

      for (const row of memberRows ?? []) {
        const list = assignedByMember.get(row.user_id) ?? [];
        list.push(row.client_id);
        assignedByMember.set(row.user_id, list);
      }
    }

    const { data: profiles, error: profilesError } = memberIds.length
      ? await supabaseAdmin.from("profiles").select("id, full_name").in("id", memberIds)
      : { data: [], error: null };
    if (profilesError) throw new Error(profilesError.message);
    const nameById = new Map((profiles ?? []).map((p) => [p.id, p.full_name]));

    const members: TeamMemberListItem[] = [];
    for (const row of memberships ?? []) {
      const user = await findUserById(supabaseAdmin, row.member_user_id);
      const email = (user?.email ?? "").toLowerCase();
      if (!email) continue;
      members.push({
        userId: row.member_user_id,
        email,
        fullName: nameById.get(row.member_user_id) ?? null,
        clientIds: assignedByMember.get(row.member_user_id) ?? [],
        createdAt: row.created_at,
      });
    }

    const seatCount = await countSeats(supabaseAdmin, userId);

    return {
      members,
      clients,
      seatCount,
      maxUsers: entitlements.maxUsers,
      canManageTeam: entitlements.canManageTeam,
    };
  });

export const provisionTeamMemberFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(provisionInput)
  .handler(async ({ data, context }): Promise<ProvisionTeamMemberResult> => {
    const { supabase, userId: ownerId } = context;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { entitlements } = await requireTeamOwner(supabase, ownerId, supabaseAdmin);

    const email = data.email.trim().toLowerCase();
    if (email === ADMIN_MASTER_EMAIL || isAdminMasterEmail(email)) {
      throw new Error("Não é possível adicionar o administrador à equipe.");
    }

    const seatCount = await countSeats(supabaseAdmin, ownerId);
    // When re-provisioning an existing member, seats stay the same.
    let existingMemberId = await findUserIdByEmail(supabaseAdmin, email);
    let alreadyOnTeam = false;
    if (existingMemberId) {
      const { data: existing } = await supabaseAdmin
        .from("team_memberships")
        .select("id")
        .eq("owner_user_id", ownerId)
        .eq("member_user_id", existingMemberId)
        .maybeSingle();
      alreadyOnTeam = Boolean(existing);
    }

    if (!alreadyOnTeam && !canInviteAnotherTeamMember(entitlements, seatCount)) {
      const max = entitlements.maxUsers ?? 0;
      throw new Error(
        max <= 0
          ? "Seu plano não permite convidar usuários."
          : `Limite de usuários do plano atingido (${max}).`,
      );
    }

    let userId = existingMemberId;
    let created = false;

    if (userId) {
      if (userId === ownerId) {
        throw new Error("Você já é o dono do plano.");
      }

      const { data: otherTeam } = await supabaseAdmin
        .from("team_memberships")
        .select("owner_user_id")
        .eq("member_user_id", userId)
        .neq("owner_user_id", ownerId)
        .maybeSingle();
      if (otherTeam) {
        throw new Error("Este e-mail já pertence à equipe de outro gestor.");
      }

      const { data: ownSubs } = await supabaseAdmin
        .from("subscriptions")
        .select("user_id, plan, status, source, updated_at")
        .eq("user_id", userId);
      const ownActive = pickActiveSubscription((ownSubs ?? []) as SubscriptionRow[]);
      if (ownActive && !alreadyOnTeam) {
        throw new Error(
          "Este e-mail já é um gestor com plano próprio. Use outro e-mail para a equipe.",
        );
      }

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

    if (!alreadyOnTeam) {
      const { error: teamError } = await supabaseAdmin.from("team_memberships").insert({
        owner_user_id: ownerId,
        member_user_id: userId,
      });
      if (teamError) throw new Error(teamError.message);
    }

    return { userId, email, created };
  });

export const removeTeamMemberFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(memberIdInput)
  .handler(async ({ data, context }): Promise<{ memberUserId: string }> => {
    const { supabase, userId: ownerId } = context;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await requireTeamOwner(supabase, ownerId, supabaseAdmin);
    await assertMemberOnTeam(supabaseAdmin, ownerId, data.memberUserId);

    const ownerClients = await listOwnerClients(supabaseAdmin, ownerId);
    const clientIds = ownerClients.map((c) => c.id);

    if (clientIds.length > 0) {
      const { error: membersError } = await supabaseAdmin
        .from("client_members")
        .delete()
        .eq("user_id", data.memberUserId)
        .eq("role", "owner")
        .in("client_id", clientIds);
      if (membersError) throw new Error(membersError.message);
    }

    const { error: teamError } = await supabaseAdmin
      .from("team_memberships")
      .delete()
      .eq("owner_user_id", ownerId)
      .eq("member_user_id", data.memberUserId);
    if (teamError) throw new Error(teamError.message);

    return { memberUserId: data.memberUserId };
  });

export const setTeamMemberClientsFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(setClientsInput)
  .handler(
    async ({
      data,
      context,
    }): Promise<{ memberUserId: string; clientIds: string[] }> => {
      const { supabase, userId: ownerId } = context;
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      await requireTeamOwner(supabase, ownerId, supabaseAdmin);
      await assertMemberOnTeam(supabaseAdmin, ownerId, data.memberUserId);

      const ownerClients = await listOwnerClients(supabaseAdmin, ownerId);
      const ownedIds = new Set(ownerClients.map((c) => c.id));
      const desired = [...new Set(data.clientIds)];

      for (const clientId of desired) {
        if (!ownedIds.has(clientId)) {
          throw new Error("Só é possível atribuir clientes da sua carteira.");
        }
      }

      const desiredSet = new Set(desired);

      let currentSet = new Set<string>();
      if (ownedIds.size > 0) {
        const { data: currentRows, error: currentError } = await supabaseAdmin
          .from("client_members")
          .select("client_id")
          .eq("user_id", data.memberUserId)
          .eq("role", "owner")
          .in("client_id", [...ownedIds]);
        if (currentError) throw new Error(currentError.message);
        currentSet = new Set((currentRows ?? []).map((row) => row.client_id));
      }

      const toAdd = desired.filter((id) => !currentSet.has(id));
      const toRemove = [...currentSet].filter((id) => !desiredSet.has(id));

      if (toRemove.length > 0) {
        const { error: deleteError } = await supabaseAdmin
          .from("client_members")
          .delete()
          .eq("user_id", data.memberUserId)
          .eq("role", "owner")
          .in("client_id", toRemove);
        if (deleteError) throw new Error(deleteError.message);
      }

      if (toAdd.length > 0) {
        const { error: insertError } = await supabaseAdmin.from("client_members").insert(
          toAdd.map((clientId) => ({
            client_id: clientId,
            user_id: data.memberUserId,
            role: "owner" as const,
          })),
        );
        if (insertError) throw new Error(insertError.message);
      }

      return { memberUserId: data.memberUserId, clientIds: desired };
    },
  );

export const resetTeamMemberPasswordFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(resetPasswordInput)
  .handler(async ({ data, context }): Promise<{ memberUserId: string }> => {
    const { supabase, userId: ownerId } = context;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await requireTeamOwner(supabase, ownerId, supabaseAdmin);
    await assertMemberOnTeam(supabaseAdmin, ownerId, data.memberUserId);

    const { error } = await supabaseAdmin.auth.admin.updateUserById(data.memberUserId, {
      password: data.password,
      email_confirm: true,
    });
    if (error) throw new Error(error.message);

    return { memberUserId: data.memberUserId };
  });
