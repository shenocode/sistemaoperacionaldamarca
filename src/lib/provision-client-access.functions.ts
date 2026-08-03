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

/**
 * Sets the single platform login for a client.
 * Privileged work runs in the `admin-clients` Edge Function on Lovable Cloud,
 * so external hosts never need the service role key.
 */
export const provisionClientAccessFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(provisionInput)
  .handler(async ({ data }): Promise<ProvisionClientAccessResult> => {
    const { callAdminEdge } = await import("@/lib/admin-edge.server");
    return callAdminEdge<ProvisionClientAccessResult>(
      "admin-clients",
      "provisionClientAccess",
      data,
    );
  });
