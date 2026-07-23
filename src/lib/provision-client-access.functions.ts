import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

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

    const { data: existingUserId, error: lookupError } = await supabaseAdmin.rpc(
      "admin_get_user_id_by_email",
      { _email: email },
    );
    if (lookupError) throw new Error(lookupError.message);

    let userId = (existingUserId as string | null) ?? null;
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
      if (createError) throw new Error(createError.message);
      if (!createdUser.user) throw new Error("Não foi possível criar o usuário.");
      userId = createdUser.user.id;
      created = true;
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
