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

export async function findUserIdByEmail(
  admin: AnyClient,
  email: string,
): Promise<string | null> {
  const target = email.trim().toLowerCase();
  let page = 1;
  for (;;) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw new Error(error.message);
    const match = data.users.find(
      (user: any) => (user.email ?? "").toLowerCase() === target,
    );
    if (match?.id) return match.id;
    const lastPage = (data as any).lastPage ?? page;
    if (page >= lastPage || data.users.length === 0) return null;
    page += 1;
  }
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
};

export function pickActiveSubscription(rows: SubscriptionRow[]): SubscriptionRow | null {
  const active = rows
    .filter((row) => row.status === "active" || row.status === "trialing")
    .sort((a, b) => {
      if (a.source === "manual" && b.source !== "manual") return -1;
      if (b.source === "manual" && a.source !== "manual") return 1;
      return b.updated_at.localeCompare(a.updated_at);
    });
  return active[0] ?? null;
}

export function pickPrimarySubscription(rows: SubscriptionRow[]): SubscriptionRow | null {
  const active = pickActiveSubscription(rows);
  if (active) return active;
  return [...rows].sort((a, b) => b.updated_at.localeCompare(a.updated_at))[0] ?? null;
}

export function isSubscriptionActiveStatus(status: string | null | undefined): boolean {
  return status === "active" || status === "trialing";
}

export async function requireAuthedUser(supabase: AnyClient): Promise<any> {
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) throw new Error("Não autenticado");
  return data.user;
}
