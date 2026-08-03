import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const reassignInput = z.object({
  clientId: z.string().uuid(),
  newGestorUserId: z.string().uuid(),
});

export type ReassignClientGestorResult = {
  clientId: string;
  previousGestorUserId: string | null;
  newGestorUserId: string;
};

export type ClientGestorInfo = {
  userId: string;
  email: string;
  fullName: string | null;
  isMaster: boolean;
};

/** Current owning gestor for a client (admin master only). */
export const getClientGestorFn = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .validator(z.object({ clientId: z.string().uuid() }))
  .handler(async ({ data }): Promise<ClientGestorInfo | null> => {
    const { callAdminEdge } = await import("@/lib/admin-edge.server");
    return callAdminEdge<ClientGestorInfo | null>("admin-clients", "getClientGestor", data);
  });

/**
 * Moves a client to another gestor via Edge Function on Lovable Cloud
 * (service role stays off Netlify). Admin master only.
 */
export const reassignClientGestorFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(reassignInput)
  .handler(async ({ data }): Promise<ReassignClientGestorResult> => {
    const { callAdminEdge } = await import("@/lib/admin-edge.server");
    return callAdminEdge<ReassignClientGestorResult>(
      "admin-clients",
      "reassignClientGestor",
      data,
    );
  });
