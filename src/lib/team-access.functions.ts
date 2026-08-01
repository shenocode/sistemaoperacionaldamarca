import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const provisionInput = z.object({
  email: z.string().trim().email(),
  password: z.string().min(6),
  fullName: z.string().trim().optional(),
  whatsapp: z
    .string()
    .trim()
    .regex(/^\d{8,20}$/, "WhatsApp inválido")
    .optional(),
});

const memberIdInput = z.object({
  memberUserId: z.string().uuid(),
});

const resetPasswordInput = z.object({
  memberUserId: z.string().uuid(),
  password: z.string().min(6),
});

const setClientsInput = z.object({
  memberUserId: z.string().uuid(),
  clientIds: z.array(z.string().uuid()),
});

export type TeamClientSummary = {
  id: string;
  name: string;
};

export type TeamMemberListItem = {
  userId: string;
  email: string;
  fullName: string | null;
  clientIds: string[];
  createdAt: string;
};

export type ListMyTeamResult = {
  members: TeamMemberListItem[];
  clients: TeamClientSummary[];
  seatCount: number;
  maxUsers: number | null;
  canManageTeam: boolean;
};

export type ProvisionTeamMemberResult = {
  userId: string;
  email: string;
  created: boolean;
};

export const listMyTeamFn = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async (): Promise<ListMyTeamResult> => {
    const { callAdminEdge } = await import("@/lib/admin-edge.server");
    return callAdminEdge<ListMyTeamResult>("admin-team", "listMyTeam");
  });

export const provisionTeamMemberFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(provisionInput)
  .handler(async ({ data }): Promise<ProvisionTeamMemberResult> => {
    const { callAdminEdge } = await import("@/lib/admin-edge.server");
    return callAdminEdge<ProvisionTeamMemberResult>("admin-team", "provisionMember", data);
  });

export const removeTeamMemberFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(memberIdInput)
  .handler(async ({ data }): Promise<{ memberUserId: string }> => {
    const { callAdminEdge } = await import("@/lib/admin-edge.server");
    return callAdminEdge("admin-team", "removeMember", data);
  });

export const setTeamMemberClientsFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(setClientsInput)
  .handler(async ({ data }): Promise<{ memberUserId: string; clientIds: string[] }> => {
    const { callAdminEdge } = await import("@/lib/admin-edge.server");
    return callAdminEdge("admin-team", "setMemberClients", data);
  });

export const resetTeamMemberPasswordFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(resetPasswordInput)
  .handler(async ({ data }): Promise<{ memberUserId: string }> => {
    const { callAdminEdge } = await import("@/lib/admin-edge.server");
    return callAdminEdge("admin-team", "resetMemberPassword", data);
  });
