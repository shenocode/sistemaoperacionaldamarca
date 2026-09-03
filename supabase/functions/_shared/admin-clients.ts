// deno-lint-ignore-file no-explicit-any
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

export type AnyClient = ReturnType<typeof createClient>;

export function getEnv() {
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !anonKey || !serviceRoleKey) {
    throw new Error("Supabase env missing");
  }
  return { supabaseUrl, anonKey, serviceRoleKey };
}

/** Client acting as the caller (RLS applies) + service-role admin client. */
export function createClients(authHeader: string) {
  const { supabaseUrl, anonKey, serviceRoleKey } = getEnv();
  const supabase = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });
  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return { supabase, admin };
}

function userEmailMatches(user: any, target: string): boolean {
  if ((user?.email ?? "").toLowerCase() === target) return true;
  const identities = Array.isArray(user?.identities) ? user.identities : [];
  return identities.some(
    (identity: any) => (identity?.identity_data?.email ?? "").toLowerCase() === target,
  );
}

export async function findUserIdByEmail(
  admin: AnyClient,
  email: string,
): Promise<string | null> {
  const target = email.trim().toLowerCase();
  if (!target) return null;

  const { data: byEmail, error: rpcError } = await admin.rpc("auth_user_id_by_email", {
    _email: target,
  });
  if (!rpcError && typeof byEmail === "string" && byEmail) return byEmail;

  const adminApi = admin.auth.admin as any;
  if (typeof adminApi.getUserByEmail === "function") {
    const { data, error } = await adminApi.getUserByEmail(target);
    if (!error && data?.user?.id) return data.user.id;
  }

  const perPage = 200;
  let page = 1;
  for (;;) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage });
    if (error) throw new Error(error.message);
    const users = data.users ?? [];
    const match = users.find((user: any) => userEmailMatches(user, target));
    if (match?.id) return match.id;
    if (users.length < perPage) return null;
    page += 1;
    if (page > 50) return null;
  }
}

/** Password reset must also confirm e-mail and clear a temporary Auth ban. */
export async function setAuthUserPassword(
  admin: AnyClient,
  userId: string,
  password: string,
): Promise<void> {
  const { error } = await admin.auth.admin.updateUserById(userId, {
    password,
    email_confirm: true,
    ban_duration: "none",
  });
  if (error) throw new Error(error.message);
}

export async function findUserById(admin: AnyClient, userId: string): Promise<any | null> {
  const { data, error } = await admin.auth.admin.getUserById(userId);
  if (error) throw new Error(error.message);
  return data.user ?? null;
}

export function isEmailAlreadyRegistered(message: string): boolean {
  const normalized = message.toLowerCase();
  return (
    normalized.includes("already been registered") ||
    normalized.includes("already registered") ||
    normalized.includes("user already exists") ||
    normalized.includes("email address has already")
  );
}

export type SubscriptionRow = {
  user_id: string | null;
  plan: string;
  status: string;
  source: string | null;
  updated_at: string;
  current_period_end?: string | null;
};

const PAST_DUE_GRACE_MS = 3 * 24 * 60 * 60 * 1000;

export function isSubscriptionActiveStatus(
  status: string | null | undefined,
  periodEnd?: string | null,
): boolean {
  if (status === "active" || status === "trialing") return true;
  if (status !== "past_due") return false;
  if (!periodEnd) return false;
  const end = new Date(periodEnd).getTime();
  if (Number.isNaN(end)) return false;
  return end > Date.now() - PAST_DUE_GRACE_MS;
}

export function pickActiveSubscription(rows: SubscriptionRow[]): SubscriptionRow | null {
  const sourceRank = (source: string | null) => {
    if (source === "stripe") return 0;
    if (source === "manual") return 1;
    return 2;
  };
  const active = rows
    .filter((row) => isSubscriptionActiveStatus(row.status, row.current_period_end))
    .sort((a, b) => {
      const bySource = sourceRank(a.source) - sourceRank(b.source);
      if (bySource !== 0) return bySource;
      return b.updated_at.localeCompare(a.updated_at);
    });
  return active[0] ?? null;
}

export function pickPrimarySubscription(rows: SubscriptionRow[]): SubscriptionRow | null {
  const active = pickActiveSubscription(rows);
  if (active) return active;
  return [...rows].sort((a, b) => b.updated_at.localeCompare(a.updated_at))[0] ?? null;
}

export async function requireAuthedUser(supabase: AnyClient): Promise<any> {
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) throw new Error("Não autenticado");
  return data.user;
}
