// deno-lint-ignore-file no-explicit-any
// Privileged team (equipe) operations, executed on Lovable Cloud where the
// service role key is available. External hosts only send the user's JWT.
import { corsHeaders, jsonResponse } from "../_shared/cors.ts";
import { isAdminMasterEmail } from "../_shared/admin-master.ts";
import {
  canInviteAnotherTeamMember,
  entitlementsForPlan,
  isAssignablePlan,
  type PlanEntitlements,
} from "../_shared/plan-entitlements.ts";
import {
  createClients,
  findUserById,
  findUserIdByEmail,
  isEmailAlreadyRegistered,
  pickActiveSubscription,
  requireAuthedUser,
  setAuthUserPassword,
  type SubscriptionRow,
} from "../_shared/admin-clients.ts";

async function loadOwnerEntitlements(
  admin: any,
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
  const plan = active && isAssignablePlan(active.plan) ? active.plan : null;
  return entitlementsForPlan(plan, { isTeamOwner: Boolean(plan) });
}

async function requireTeamOwner(supabase: any, admin: any, callerId: string) {
  const { data: isAdmin, error } = await supabase.rpc("is_admin");
  if (error) throw new Error(error.message);
  if (!isAdmin) throw new Error("Apenas gestores podem gerenciar a equipe.");

  const caller = await findUserById(admin, callerId);
  const email = (caller?.email ?? "").toLowerCase();
  const entitlements = await loadOwnerEntitlements(admin, callerId, email);

  if (!entitlements.canManageTeam) {
    throw new Error("Seu plano não permite gerenciar equipe. Atualize para Studio ou Agência.");
  }
  if (!entitlements.isTeamOwner && !entitlements.isMaster) {
    throw new Error("Apenas o gestor dono do plano pode gerenciar a equipe.");
  }
  if (!entitlements.isMaster) {
    const { data: ownSub } = await admin
      .from("subscriptions")
      .select("user_id, plan, status, source, updated_at")
      .eq("user_id", callerId);
    const active = pickActiveSubscription((ownSub ?? []) as SubscriptionRow[]);
    if (!active) throw new Error("Apenas o gestor dono do plano pode gerenciar a equipe.");
  }

  return { entitlements, email };
}

async function countSeats(admin: any, ownerUserId: string): Promise<number> {
  const { count, error } = await admin
    .from("team_memberships")
    .select("id", { count: "exact", head: true })
    .eq("owner_user_id", ownerUserId);
  if (error) throw new Error(error.message);
  return 1 + (count ?? 0);
}

async function assertMemberOnTeam(admin: any, ownerUserId: string, memberUserId: string) {
  const { data, error } = await admin
    .from("team_memberships")
    .select("id")
    .eq("owner_user_id", ownerUserId)
    .eq("member_user_id", memberUserId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Este usuário não faz parte da sua equipe.");
}

async function listOwnerClients(admin: any, ownerUserId: string) {
  const { data, error } = await admin
    .from("clients")
    .select("id, name")
    .eq("created_by", ownerUserId)
    .order("name", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []).map((row: any) => ({ id: row.id, name: row.name }));
}

async function listMyTeam(supabase: any, admin: any, ownerId: string) {
  const { entitlements } = await requireTeamOwner(supabase, admin, ownerId);

  const clients = await listOwnerClients(admin, ownerId);
  const clientIds = clients.map((c: any) => c.id);

  const { data: memberships, error: teamError } = await admin
    .from("team_memberships")
    .select("member_user_id, created_at")
    .eq("owner_user_id", ownerId)
    .order("created_at", { ascending: true });
  if (teamError) throw new Error(teamError.message);

  const memberIds = (memberships ?? []).map((row: any) => row.member_user_id);
  const assignedByMember = new Map<string, string[]>();

  if (memberIds.length > 0 && clientIds.length > 0) {
    const { data: memberRows, error: membersError } = await admin
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
    ? await admin.from("profiles").select("id, full_name").in("id", memberIds)
    : { data: [], error: null };
  if (profilesError) throw new Error(profilesError.message);
  const nameById = new Map((profiles ?? []).map((p: any) => [p.id, p.full_name]));

  const members: any[] = [];
  for (const row of memberships ?? []) {
    const user = await findUserById(admin, row.member_user_id);
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

  return {
    members,
    clients,
    seatCount: await countSeats(admin, ownerId),
    maxUsers: entitlements.maxUsers,
    canManageTeam: entitlements.canManageTeam,
  };
}

async function provisionTeamMember(supabase: any, admin: any, ownerId: string, payload: any) {
  const { entitlements } = await requireTeamOwner(supabase, admin, ownerId);

  const email = String(payload?.email ?? "").trim().toLowerCase();
  const password = String(payload?.password ?? "");
  if (!email.includes("@")) throw new Error("E-mail inválido.");
  if (password.length < 6) throw new Error("Senha muito curta.");
  if (isAdminMasterEmail(email)) {
    throw new Error("Não é possível adicionar o administrador à equipe.");
  }

  const seatCount = await countSeats(admin, ownerId);
  const existingMemberId = await findUserIdByEmail(admin, email);
  let alreadyOnTeam = false;
  if (existingMemberId) {
    const { data: existing } = await admin
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
    if (userId === ownerId) throw new Error("Você já é o dono do plano.");

    const { data: otherTeam } = await admin
      .from("team_memberships")
      .select("owner_user_id")
      .eq("member_user_id", userId)
      .neq("owner_user_id", ownerId)
      .maybeSingle();
    if (otherTeam) throw new Error("Este e-mail já pertence à equipe de outro gestor.");

    const { data: ownSubs } = await admin
      .from("subscriptions")
      .select("user_id, plan, status, source, updated_at")
      .eq("user_id", userId);
    const ownActive = pickActiveSubscription((ownSubs ?? []) as SubscriptionRow[]);
    if (ownActive && !alreadyOnTeam) {
      throw new Error(
        "Este e-mail já é um gestor com plano próprio. Use outro e-mail para a equipe.",
      );
    }

    await setAuthUserPassword(admin, userId, password);
  } else {
    const { data: createdUser, error: createError } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: payload?.fullName ? { full_name: payload.fullName } : undefined,
    });
    if (createError) {
      if (!isEmailAlreadyRegistered(createError.message)) throw new Error(createError.message);
      userId = await findUserIdByEmail(admin, email);
      if (!userId) throw new Error("Usuário já existe, mas não foi possível localizá-lo.");
      await setAuthUserPassword(admin, userId, password);
    } else {
      if (!createdUser.user) throw new Error("Não foi possível criar o usuário.");
      userId = createdUser.user.id;
      created = true;
    }
  }

  const displayName = String(payload?.fullName ?? "").trim() || email.split("@")[0] || null;
  const whatsapp = String(payload?.whatsapp ?? "").replace(/\D/g, "") || null;
  if (displayName || whatsapp) {
    const { error } = await admin.from("profiles").upsert({
      id: userId,
      ...(displayName ? { full_name: displayName } : {}),
      ...(whatsapp ? { whatsapp } : {}),
    });
    if (error) throw new Error(error.message);
  }

  const { error: roleError } = await admin
    .from("user_roles")
    .insert({ user_id: userId, role: "admin" });
  if (roleError && roleError.code !== "23505") throw new Error(roleError.message);

  if (!alreadyOnTeam) {
    const { error } = await admin
      .from("team_memberships")
      .insert({ owner_user_id: ownerId, member_user_id: userId });
    if (error) throw new Error(error.message);
  }

  return { userId, email, created };
}

async function removeTeamMember(supabase: any, admin: any, ownerId: string, payload: any) {
  await requireTeamOwner(supabase, admin, ownerId);
  const memberUserId = String(payload?.memberUserId ?? "");
  await assertMemberOnTeam(admin, ownerId, memberUserId);

  const ownerClients = await listOwnerClients(admin, ownerId);
  const clientIds = ownerClients.map((c: any) => c.id);

  if (clientIds.length > 0) {
    const { error } = await admin
      .from("client_members")
      .delete()
      .eq("user_id", memberUserId)
      .eq("role", "owner")
      .in("client_id", clientIds);
    if (error) throw new Error(error.message);
  }

  const { error } = await admin
    .from("team_memberships")
    .delete()
    .eq("owner_user_id", ownerId)
    .eq("member_user_id", memberUserId);
  if (error) throw new Error(error.message);

  return { memberUserId };
}

async function setTeamMemberClients(supabase: any, admin: any, ownerId: string, payload: any) {
  await requireTeamOwner(supabase, admin, ownerId);
  const memberUserId = String(payload?.memberUserId ?? "");
  await assertMemberOnTeam(admin, ownerId, memberUserId);

  const ownerClients = await listOwnerClients(admin, ownerId);
  const ownedIds = new Set<string>(ownerClients.map((c: any) => c.id));
  const desired = [...new Set<string>((payload?.clientIds ?? []) as string[])];

  for (const clientId of desired) {
    if (!ownedIds.has(clientId)) {
      throw new Error("Só é possível atribuir clientes da sua carteira.");
    }
  }

  const desiredSet = new Set(desired);
  let currentSet = new Set<string>();
  if (ownedIds.size > 0) {
    const { data: currentRows, error } = await admin
      .from("client_members")
      .select("client_id")
      .eq("user_id", memberUserId)
      .eq("role", "owner")
      .in("client_id", [...ownedIds]);
    if (error) throw new Error(error.message);
    currentSet = new Set((currentRows ?? []).map((row: any) => row.client_id));
  }

  const toAdd = desired.filter((id) => !currentSet.has(id));
  const toRemove = [...currentSet].filter((id) => !desiredSet.has(id));

  if (toRemove.length > 0) {
    const { error } = await admin
      .from("client_members")
      .delete()
      .eq("user_id", memberUserId)
      .eq("role", "owner")
      .in("client_id", toRemove);
    if (error) throw new Error(error.message);
  }

  if (toAdd.length > 0) {
    const { error } = await admin.from("client_members").insert(
      toAdd.map((clientId) => ({ client_id: clientId, user_id: memberUserId, role: "owner" })),
    );
    if (error) throw new Error(error.message);
  }

  return { memberUserId, clientIds: desired };
}

async function resetMemberPassword(supabase: any, admin: any, ownerId: string, payload: any) {
  await requireTeamOwner(supabase, admin, ownerId);
  const memberUserId = String(payload?.memberUserId ?? "");
  const password = String(payload?.password ?? "");
  if (password.length < 6) throw new Error("Senha muito curta.");
  await assertMemberOnTeam(admin, ownerId, memberUserId);

  await setAuthUserPassword(admin, memberUserId, password);

  return { memberUserId };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse({ error: "Method not allowed" }, 405);

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return jsonResponse({ error: "Não autenticado" }, 401);

    const { supabase, admin } = createClients(authHeader);
    const caller = await requireAuthedUser(supabase);

    const body = (await req.json().catch(() => ({}))) as { action?: string; payload?: any };
    const payload = body.payload ?? {};

    switch (body.action) {
      case "listMyTeam":
        return jsonResponse({ data: await listMyTeam(supabase, admin, caller.id) });
      case "provisionMember":
        return jsonResponse({
          data: await provisionTeamMember(supabase, admin, caller.id, payload),
        });
      case "removeMember":
        return jsonResponse({ data: await removeTeamMember(supabase, admin, caller.id, payload) });
      case "setMemberClients":
        return jsonResponse({
          data: await setTeamMemberClients(supabase, admin, caller.id, payload),
        });
      case "resetMemberPassword":
        return jsonResponse({
          data: await resetMemberPassword(supabase, admin, caller.id, payload),
        });
      default:
        return jsonResponse({ error: "Ação inválida" }, 400);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro interno";
    console.error("admin-team:", message);
    return jsonResponse({ error: message }, 400);
  }
});
