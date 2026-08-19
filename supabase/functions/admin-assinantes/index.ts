// deno-lint-ignore-file no-explicit-any
// Privileged "assinantes" (gestores) operations. Runs on Lovable Cloud where
// SUPABASE_SERVICE_ROLE_KEY is injected, so external hosts (Netlify) never need it.
import { corsHeaders, jsonResponse } from "../_shared/cors.ts";
import { ADMIN_MASTER_EMAIL, isAdminMasterEmail } from "../_shared/admin-master.ts";
import {
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
  pickPrimarySubscription,
  isSubscriptionActiveStatus,
  requireAuthedUser,
  setAuthUserPassword,
  type SubscriptionRow,
} from "../_shared/admin-clients.ts";

async function requireAdminMaster(supabase: any, admin: any, userId: string) {
  const { data: isAdmin, error } = await supabase.rpc("is_admin");
  if (error) throw new Error(error.message);
  if (!isAdmin) throw new Error("Apenas o administrador pode liberar gestores.");
  const caller = await findUserById(admin, userId);
  if (!isAdminMasterEmail(caller?.email)) {
    throw new Error("Apenas o administrador pode liberar gestores.");
  }
}

async function ensureAdminRole(admin: any, userId: string) {
  const { error } = await admin.from("user_roles").insert({ user_id: userId, role: "admin" });
  if (error && error.code !== "23505") throw new Error(error.message);
}

async function revokeAdminRole(admin: any, userId: string) {
  const { error } = await admin
    .from("user_roles")
    .delete()
    .eq("user_id", userId)
    .eq("role", "admin");
  if (error) throw new Error(error.message);
}

async function upsertManualPlan(
  admin: any,
  input: { userId: string; email: string; plan: AssignablePlan },
) {
  const { data: existing } = await admin
    .from("subscriptions")
    .select("id")
    .eq("user_id", input.userId)
    .eq("source", "manual")
    .maybeSingle();

  if (existing?.id) {
    const { error } = await admin
      .from("subscriptions")
      .update({
        plan: input.plan,
        status: "active",
        email: input.email,
        cancel_at_period_end: false,
      })
      .eq("id", existing.id);
    if (error) throw new Error(error.message);
    return;
  }

  const { error } = await admin.from("subscriptions").insert({
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
  if (error) throw new Error(error.message);
}

async function listAssinantes(supabase: any, admin: any, callerId: string) {
  await requireAdminMaster(supabase, admin, callerId);

  const { data: subscriptions, error: subsError } = await admin
    .from("subscriptions")
    .select("user_id, plan, status, source, updated_at");
  if (subsError) throw new Error(subsError.message);

  const subsByUser = new Map<string, SubscriptionRow[]>();
  for (const row of subscriptions ?? []) {
    if (!row.user_id) continue;
    const list = subsByUser.get(row.user_id) ?? [];
    list.push(row as SubscriptionRow);
    subsByUser.set(row.user_id, list);
  }

  const masterUserId = await findUserIdByEmail(admin, ADMIN_MASTER_EMAIL);
  const candidateIds = new Set<string>(subsByUser.keys());
  if (masterUserId) candidateIds.add(masterUserId);
  if (candidateIds.size === 0) return [];

  const ids = [...candidateIds];

  const { data: profiles, error: profilesError } = await admin
    .from("profiles")
    .select("id, full_name")
    .in("id", ids);
  if (profilesError) throw new Error(profilesError.message);

  const { data: clients, error: clientsError } = await admin
    .from("clients")
    .select("id, name, created_by")
    .in("created_by", ids)
    .order("name", { ascending: true });
  if (clientsError) throw new Error(clientsError.message);

  const clientsByOwner = new Map<string, { id: string; name: string }[]>();
  for (const client of clients ?? []) {
    if (!client.created_by) continue;
    const list = clientsByOwner.get(client.created_by) ?? [];
    list.push({ id: client.id, name: client.name });
    clientsByOwner.set(client.created_by, list);
  }

  const nameById = new Map((profiles ?? []).map((p: any) => [p.id, p.full_name]));

  const items: any[] = [];
  for (const id of ids) {
    const user = await findUserById(admin, id);
    const email = (user?.email ?? "").toLowerCase();
    if (!email) continue;

    const isMaster = isAdminMasterEmail(email);
    const primary = pickPrimarySubscription(subsByUser.get(id) ?? []);
    const plan = primary && isAssignablePlan(primary.plan) ? primary.plan : null;
    const planStatus = isMaster ? "active" : (primary?.status ?? null);
    const isActive = isMaster || isSubscriptionActiveStatus(planStatus);
    const ownerClients = clientsByOwner.get(id) ?? [];
    const entitlements = entitlementsForPlan(plan, { isMaster, isTeamOwner: true });

    items.push({
      userId: id,
      email,
      fullName: nameById.get(id) ?? null,
      isMaster,
      plan,
      planStatus,
      planSource:
        primary?.source === "stripe" || primary?.source === "manual" ? primary.source : null,
      isActive,
      clientCount: ownerClients.length,
      clients: ownerClients,
      maxClients: entitlements.maxClients,
    });
  }

  items.sort((a, b) => {
    if (a.isMaster !== b.isMaster) return a.isMaster ? -1 : 1;
    if (a.isActive !== b.isActive) return a.isActive ? -1 : 1;
    return (a.fullName || a.email).localeCompare(b.fullName || b.email, "pt-BR");
  });

  return items;
}

async function provisionGestor(supabase: any, admin: any, callerId: string, payload: any) {
  await requireAdminMaster(supabase, admin, callerId);

  const email = String(payload?.email ?? "").trim().toLowerCase();
  const password = String(payload?.password ?? "");
  if (!email.includes("@")) throw new Error("E-mail inválido.");
  if (password.length < 6) throw new Error("Senha muito curta.");
  if (isAdminMasterEmail(email)) {
    throw new Error("Não é possível alterar o acesso do administrador por aqui.");
  }

  const requestedId = String(payload?.userId ?? "").trim();
  let userId = requestedId || (await findUserIdByEmail(admin, email));
  let created = false;

  if (userId) {
    const existing = await findUserById(admin, userId);
    if (!existing) throw new Error("Usuário não encontrado.");
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

  await ensureAdminRole(admin, userId!);

  const plan: AssignablePlan = isAssignablePlan(payload?.plan) ? payload.plan : "courtesy";
  await upsertManualPlan(admin, { userId: userId!, email, plan });

  return { userId, email, created, plan };
}

async function setStatus(supabase: any, admin: any, callerId: string, payload: any) {
  await requireAdminMaster(supabase, admin, callerId);
  const targetId = String(payload?.userId ?? "");
  const active = Boolean(payload?.active);

  const user = await findUserById(admin, targetId);
  const email = (user?.email ?? "").toLowerCase();
  if (!email) throw new Error("Usuário não encontrado.");
  if (isAdminMasterEmail(email)) throw new Error("Não é possível desativar o administrador.");

  const { data: rows, error } = await admin
    .from("subscriptions")
    .select("id, plan, status, source, updated_at, user_id")
    .eq("user_id", targetId);
  if (error) throw new Error(error.message);
  if (!rows || rows.length === 0) throw new Error("Assinante sem registro de assinatura.");

  if (active) {
    const primary = pickPrimarySubscription(rows as SubscriptionRow[]);
    const plan: AssignablePlan =
      primary && isAssignablePlan(primary.plan) ? primary.plan : "courtesy";
    await upsertManualPlan(admin, { userId: targetId, email, plan });
    await ensureAdminRole(admin, targetId);
  } else {
    const { error: cancelError } = await admin
      .from("subscriptions")
      .update({ status: "canceled", cancel_at_period_end: false })
      .eq("user_id", targetId)
      .in("status", ["active", "trialing", "past_due", "incomplete"]);
    if (cancelError) throw new Error(cancelError.message);
    await revokeAdminRole(admin, targetId);
  }

  return { userId: targetId, active };
}

async function setPlan(supabase: any, admin: any, callerId: string, payload: any) {
  await requireAdminMaster(supabase, admin, callerId);
  const targetId = String(payload?.userId ?? "");
  if (!isAssignablePlan(payload?.plan)) throw new Error("Plano inválido.");
  const plan: AssignablePlan = payload.plan;

  const user = await findUserById(admin, targetId);
  const email = (user?.email ?? "").toLowerCase();
  if (!email) throw new Error("Usuário não encontrado.");
  if (isAdminMasterEmail(email)) {
    throw new Error("O administrador não precisa de plano atribuído.");
  }

  await upsertManualPlan(admin, { userId: targetId, email, plan });
  await ensureAdminRole(admin, targetId);
  return { userId: targetId, plan };
}

async function myEntitlements(supabase: any, admin: any, callerId: string) {
  const user = await findUserById(admin, callerId);
  if (isAdminMasterEmail(user?.email)) {
    return entitlementsForPlan(null, { isMaster: true });
  }

  const { data: isAdmin, error: adminError } = await supabase.rpc("is_admin");
  if (adminError) throw new Error(adminError.message);
  if (!isAdmin) return entitlementsForPlan(null);

  const { data: rows, error } = await admin
    .from("subscriptions")
    .select("user_id, plan, status, source, updated_at")
    .eq("user_id", callerId);
  if (error) throw new Error(error.message);

  const active = pickActiveSubscription((rows ?? []) as SubscriptionRow[]);
  if (active && isAssignablePlan(active.plan)) {
    return entitlementsForPlan(active.plan, { isTeamOwner: true });
  }

  const { data: membership, error: teamError } = await admin
    .from("team_memberships")
    .select("owner_user_id")
    .eq("member_user_id", callerId)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (teamError) throw new Error(teamError.message);

  if (membership?.owner_user_id) {
    const { data: ownerRows, error: ownerError } = await admin
      .from("subscriptions")
      .select("user_id, plan, status, source, updated_at")
      .eq("user_id", membership.owner_user_id);
    if (ownerError) throw new Error(ownerError.message);
    const ownerActive = pickActiveSubscription((ownerRows ?? []) as SubscriptionRow[]);
    const ownerPlan = ownerActive && isAssignablePlan(ownerActive.plan) ? ownerActive.plan : null;
    return entitlementsForPlan(ownerPlan, { asCollaborator: true });
  }

  return entitlementsForPlan(null);
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
    const action = body.action ?? "";
    const payload = body.payload ?? {};

    switch (action) {
      case "listAssinantes":
        return jsonResponse({ data: await listAssinantes(supabase, admin, caller.id) });
      case "listGestores": {
        const all = await listAssinantes(supabase, admin, caller.id);
        return jsonResponse({
          data: all
            .filter((item) => item.isMaster || item.isActive)
            .map(({ userId, email, fullName, isMaster, plan, planStatus, planSource }) => ({
              userId,
              email,
              fullName,
              isMaster,
              plan,
              planStatus,
              planSource,
            })),
        });
      }
      case "provisionGestor":
        return jsonResponse({ data: await provisionGestor(supabase, admin, caller.id, payload) });
      case "setStatus":
        return jsonResponse({ data: await setStatus(supabase, admin, caller.id, payload) });
      case "setPlan":
        return jsonResponse({ data: await setPlan(supabase, admin, caller.id, payload) });
      case "myEntitlements":
        return jsonResponse({ data: await myEntitlements(supabase, admin, caller.id) });
      default:
        return jsonResponse({ error: "Ação inválida" }, 400);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro interno";
    console.error("admin-assinantes:", message);
    return jsonResponse({ error: message }, 400);
  }
});
