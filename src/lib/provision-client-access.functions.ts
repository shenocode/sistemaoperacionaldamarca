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

    const { error: memberError } = await supabaseAdmin.from("client_members").insert({
      client_id: data.clientId,
      user_id: userId,
      role: "member",
    });
    if (memberError && memberError.code !== "23505") {
      throw new Error(memberError.message);
    }

    return { userId, email, created };
  });
