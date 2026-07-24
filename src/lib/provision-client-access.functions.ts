import { createServerFn } from "@tanstack/react-start";
import type { User } from "@supabase/supabase-js";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { supabaseAdmin as SupabaseAdmin } from "@/integrations/supabase/client.server";

const provisionInput = z.object({
  clientId: z.string().uuid(),
  email: z.string().trim().email(),
  password: z.string().min(6),
  fullName: z.string().trim().optional(),
});

export type ProvisionClientAccessResult = {
  userId: string;
  email: string;
  created: boolean;
};

type AdminClient = typeof SupabaseAdmin;

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

async function ensureAuthUser(
  admin: AdminClient,
  email: string,
  password: string,
  fullName?: string,
): Promise<{ userId: string; created: boolean }> {
  let userId = await findUserIdByEmail(admin, email);

  if (userId) {
    const { error: updateError } = await admin.auth.admin.updateUserById(userId, {
      password,
      email_confirm: true,
    });
    if (updateError) throw new Error(updateError.message);
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
    const { error: updateError } = await admin.auth.admin.updateUserById(userId, {
      password,
      email_confirm: true,
    });
    if (updateError) throw new Error(updateError.message);
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
export const provisionClientAccessFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(provisionInput)
  .handler(async ({ data, context }): Promise<ProvisionClientAccessResult> => {
    const { supabase } = context;

    const { data: isAdmin, error: adminError } = await supabase.rpc("is_admin");
    if (adminError) throw new Error(adminError.message);
    if (!isAdmin) throw new Error("Apenas administradores podem criar acesso.");

    const { data: canManage, error: manageError } = await supabase.rpc("can_manage_client", {
      _client_id: data.clientId,
    });
    if (manageError) throw new Error(manageError.message);
    if (!canManage) throw new Error("Sem permissão para este cliente.");

    const email = data.email.trim().toLowerCase();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: existingMembers, error: membersError } = await supabaseAdmin
      .from("client_members")
      .select("user_id")
      .eq("client_id", data.clientId)
      .eq("role", "member");
    if (membersError) throw new Error(membersError.message);

    const existingMemberIds = (existingMembers ?? []).map((row) => row.user_id);
    const soleMemberId = existingMemberIds.length === 1 ? existingMemberIds[0] : null;

    let userId: string;
    let created = false;

    // Prefer renaming the existing platform user when the new email is free,
    // so we don't leave an orphaned login that still "feels" like the client.
    if (soleMemberId) {
      const { data: soleUser, error: soleUserError } =
        await supabaseAdmin.auth.admin.getUserById(soleMemberId);
      if (soleUserError) throw new Error(soleUserError.message);

      const currentEmail = (soleUser.user?.email ?? "").toLowerCase();
      if (currentEmail && currentEmail !== email) {
        const emailTakenBy = await findUserIdByEmail(supabaseAdmin, email);
        if (!emailTakenBy) {
          const { error: renameError } = await supabaseAdmin.auth.admin.updateUserById(
            soleMemberId,
            {
              email,
              password: data.password,
              email_confirm: true,
            },
          );
          if (renameError) throw new Error(renameError.message);
          userId = soleMemberId;
        } else {
          const ensured = await ensureAuthUser(
            supabaseAdmin,
            email,
            data.password,
            data.fullName,
          );
          userId = ensured.userId;
          created = ensured.created;
        }
      } else {
        const ensured = await ensureAuthUser(
          supabaseAdmin,
          email,
          data.password,
          data.fullName,
        );
        userId = ensured.userId;
        created = ensured.created;
      }
    } else {
      const ensured = await ensureAuthUser(
        supabaseAdmin,
        email,
        data.password,
        data.fullName,
      );
      userId = ensured.userId;
      created = ensured.created;
    }

    const displayName = data.fullName?.trim() || email.split("@")[0] || null;
    if (displayName && created) {
      const { error: profileError } = await supabaseAdmin.from("profiles").upsert({
        id: userId,
        full_name: displayName,
      });
      if (profileError) throw new Error(profileError.message);
    }

    const { error: memberError } = await supabaseAdmin.from("client_members").insert({
      client_id: data.clientId,
      user_id: userId,
      role: "member",
    });
    if (memberError && memberError.code !== "23505") {
      throw new Error(memberError.message);
    }

    // Enforce a single client-facing login: drop every other member on this client.
    const { error: revokeError } = await supabaseAdmin
      .from("client_members")
      .delete()
      .eq("client_id", data.clientId)
      .eq("role", "member")
      .neq("user_id", userId);
    if (revokeError) throw new Error(revokeError.message);

    return { userId, email, created };
  });
