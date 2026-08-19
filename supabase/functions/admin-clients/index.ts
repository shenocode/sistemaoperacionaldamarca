// deno-lint-ignore-file no-explicit-any
// Privileged client operations (platform login + gestor migration), executed on
// Lovable Cloud where the service role key is available. External hosts only
// send the user's JWT — same pattern as admin-team / admin-assinantes.
import { corsHeaders, jsonResponse } from "../_shared/cors.ts";
import { isAdminMasterEmail } from "../_shared/admin-master.ts";
import {
  canCreateAnotherClient,
  entitlementsForPlan,
  isAssignablePlan,
  type AssignablePlan,
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

type ClientGestorInfo = {
  userId: string;
  email: string;
  fullName: string | null;
  isMaster: boolean;
};

async function ensureAuthUser(
  admin: any,
  email: string,
  password: string,
  fullName?: string,
): Promise<{ userId: string; created: boolean }> {
  let userId = await findUserIdByEmail(admin, email);

  if (userId) {
    await setAuthUserPassword(admin, userId, password);
    return { userId, created: false };
  }

  const { data: createdUser, error: createError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: fullName ? { full_name: fullName } : undefined,
  });

  if (createError) {
    if (!isEmailAlreadyRegistered(createError.message)) {
      throw new Error(createError.message);
    }
    userId = await findUserIdByEmail(admin, email);
    if (!userId) {
      throw new Error("Usuário já existe, mas não foi possível localizá-lo.");
    }
    await setAuthUserPassword(admin, userId, password);
    return { userId, created: false };
  }

  if (!createdUser.user) throw new Error("Não foi possível criar o usuário.");
  return { userId: createdUser.user.id, created: true };
}

/**
 * Sets the single platform login for a client.
 * Previous `member` rows are removed so only this email keeps client access
 * (owners/admins are left untouched).
 */
async function provisionClientAccess(supabase: any, admin: any, payload: any) {
  const { data: isAdmin, error: adminError } = await supabase.rpc("is_admin");
  if (adminError) throw new Error(adminError.message);
  if (!isAdmin) throw new Error("Apenas administradores podem criar acesso.");

  const clientId = String(payload?.clientId ?? "");
  const email = String(payload?.email ?? "").trim().toLowerCase();
  const password = String(payload?.password ?? "");
  const fullName = String(payload?.fullName ?? "").trim() || undefined;

  if (!clientId) throw new Error("Cliente inválido.");
  if (!email || !email.includes("@")) throw new Error("E-mail inválido.");
  if (password.length < 6) throw new Error("Senha muito curta.");

  const { data: canManage, error: manageError } = await supabase.rpc("can_manage_client", {
    _client_id: clientId,
  });
  if (manageError) throw new Error(manageError.message);
  if (!canManage) throw new Error("Sem permissão para este cliente.");

  const { data: existingMembers, error: membersError } = await admin
    .from("client_members")
    .select("user_id")
    .eq("client_id", clientId)
    .eq("role", "member");
  if (membersError) throw new Error(membersError.message);

  const existingMemberIds = (existingMembers ?? []).map((row: any) => row.user_id as string);
  const soleMemberId = existingMemberIds.length === 1 ? existingMemberIds[0] : null;

  let userId: string;
  let created = false;

  // Prefer renaming the existing platform user when the new email is free,
  // so we don't leave an orphaned login that still "feels" like the client.
  if (soleMemberId) {
    const soleUser = await findUserById(admin, soleMemberId);
    const currentEmail = (soleUser?.email ?? "").toLowerCase();
    if (currentEmail && currentEmail !== email) {
      const emailTakenBy = await findUserIdByEmail(admin, email);
      if (!emailTakenBy) {
        const { error: renameError } = await admin.auth.admin.updateUserById(soleMemberId, {
          email,
          password,
          email_confirm: true,
        });
        if (renameError) throw new Error(renameError.message);
        userId = soleMemberId;
      } else {
        const ensured = await ensureAuthUser(admin, email, password, fullName);
        userId = ensured.userId;
        created = ensured.created;
      }
    } else {
      const ensured = await ensureAuthUser(admin, email, password, fullName);
      userId = ensured.userId;
      created = ensured.created;
    }
  } else {
    const ensured = await ensureAuthUser(admin, email, password, fullName);
    userId = ensured.userId;
    created = ensured.created;
  }

  const displayName = fullName || email.split("@")[0] || null;
  if (displayName && created) {
    const { error: profileError } = await admin.from("profiles").upsert({
      id: userId,
      full_name: displayName,
    });
    if (profileError) throw new Error(profileError.message);
  }

  const { error: memberError } = await admin.from("client_members").insert({
    client_id: clientId,
    user_id: userId,
    role: "member",
  });
  if (memberError && memberError.code !== "23505") {
    throw new Error(memberError.message);
  }

  // Enforce a single client-facing login: drop every other member on this client.
  const { error: revokeError } = await admin
    .from("client_members")
    .delete()
    .eq("client_id", clientId)
    .eq("role", "member")
    .neq("user_id", userId);
  if (revokeError) throw new Error(revokeError.message);

  return { userId, email, created };
}

async function requireAdminMaster(supabase: any, admin: any, callerId: string) {
  const { data: isAdmin, error: adminError } = await supabase.rpc("is_admin");
  if (adminError) throw new Error(adminError.message);
  if (!isAdmin) throw new Error("Apenas o administrador pode migrar clientes.");

  const caller = await findUserById(admin, callerId);
  if (!isAdminMasterEmail(caller?.email)) {
    throw new Error("Apenas o administrador pode migrar clientes.");
  }
}

async function resolveGestorInfo(admin: any, userId: string): Promise<ClientGestorInfo | null> {
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
  admin: any,
  gestorUserId: string,
  clientId: string,
  previousCreatedBy: string | null,
) {
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

async function getClientGestor(supabase: any, admin: any, callerId: string, payload: any) {
  await requireAdminMaster(supabase, admin, callerId);
  const clientId = String(payload?.clientId ?? "");
  if (!clientId) throw new Error("Cliente inválido.");

  const { data: client, error: clientError } = await admin
    .from("clients")
    .select("created_by")
    .eq("id", clientId)
    .maybeSingle();
  if (clientError) throw new Error(clientError.message);
  if (!client) throw new Error("Cliente não encontrado.");

  const { data: owners, error: ownersError } = await admin
    .from("client_members")
    .select("user_id")
    .eq("client_id", clientId)
    .eq("role", "owner");
  if (ownersError) throw new Error(ownersError.message);

  const ownerIds = (owners ?? []).map((row: any) => row.user_id as string);
  const preferredId =
    (client.created_by && ownerIds.includes(client.created_by) ? client.created_by : null) ??
    client.created_by ??
    ownerIds[0] ??
    null;

  if (!preferredId) return null;
  return resolveGestorInfo(admin, preferredId);
}

async function reassignClientGestor(supabase: any, admin: any, callerId: string, payload: any) {
  await requireAdminMaster(supabase, admin, callerId);

  const clientId = String(payload?.clientId ?? "");
  const newGestorUserId = String(payload?.newGestorUserId ?? "");
  if (!clientId || !newGestorUserId) throw new Error("Dados inválidos.");

  const { data: client, error: clientError } = await admin
    .from("clients")
    .select("id, created_by, name")
    .eq("id", clientId)
    .maybeSingle();
  if (clientError) throw new Error(clientError.message);
  if (!client) throw new Error("Cliente não encontrado.");

  const { data: adminRole, error: roleError } = await admin
    .from("user_roles")
    .select("user_id")
    .eq("user_id", newGestorUserId)
    .eq("role", "admin")
    .maybeSingle();
  if (roleError) throw new Error(roleError.message);
  if (!adminRole) {
    throw new Error("O usuário selecionado não é um gestor.");
  }

  const { data: memberRow, error: memberLookupError } = await admin
    .from("client_members")
    .select("role")
    .eq("client_id", clientId)
    .eq("user_id", newGestorUserId)
    .maybeSingle();
  if (memberLookupError) throw new Error(memberLookupError.message);
  if (memberRow?.role === "member") {
    throw new Error("Este usuário é o login do cliente nesta conta. Escolha outro gestor.");
  }

  await assertGestorCanReceiveClient(admin, newGestorUserId, clientId, client.created_by);

  const previousGestorUserId = client.created_by as string | null;

  if (previousGestorUserId !== newGestorUserId) {
    const { error: updateError } = await admin
      .from("clients")
      .update({ created_by: newGestorUserId })
      .eq("id", clientId);
    if (updateError) throw new Error(updateError.message);
  }

  const { error: revokeOwnersError } = await admin
    .from("client_members")
    .delete()
    .eq("client_id", clientId)
    .eq("role", "owner")
    .neq("user_id", newGestorUserId);
  if (revokeOwnersError) throw new Error(revokeOwnersError.message);

  if (memberRow?.role !== "owner") {
    const { error: insertOwnerError } = await admin.from("client_members").insert({
      client_id: clientId,
      user_id: newGestorUserId,
      role: "owner",
    });
    if (insertOwnerError && insertOwnerError.code !== "23505") {
      throw new Error(insertOwnerError.message);
    }
    if (insertOwnerError?.code === "23505") {
      const { error: promoteError } = await admin
        .from("client_members")
        .update({ role: "owner" })
        .eq("client_id", clientId)
        .eq("user_id", newGestorUserId);
      if (promoteError) throw new Error(promoteError.message);
    }
  }

  return {
    clientId,
    previousGestorUserId,
    newGestorUserId,
  };
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
      case "provisionClientAccess":
        return jsonResponse({ data: await provisionClientAccess(supabase, admin, payload) });
      case "getClientGestor":
        return jsonResponse({
          data: await getClientGestor(supabase, admin, caller.id, payload),
        });
      case "reassignClientGestor":
        return jsonResponse({
          data: await reassignClientGestor(supabase, admin, caller.id, payload),
        });
      default:
        return jsonResponse({ error: "Ação inválida" }, 400);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro interno";
    console.error("admin-clients:", message);
    return jsonResponse({ error: message }, 400);
  }
});
