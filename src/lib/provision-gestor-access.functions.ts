import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { ASSIGNABLE_PLANS, type AssignablePlan, type PlanEntitlements } from "@/lib/plan-entitlements";
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
  plan: z.enum(ASSIGNABLE_PLANS).default("courtesy"),
});

const setPlanInput = z.object({
  userId: z.string().uuid(),
  plan: z.enum(ASSIGNABLE_PLANS),
});

const setStatusInput = z.object({
  userId: z.string().uuid(),
  active: z.boolean(),
});

export type ProvisionGestorAccessResult = {
  userId: string;
  email: string;
  created: boolean;
  plan: AssignablePlan;
};

export type GestorListItem = {
  userId: string;
  email: string;
  fullName: string | null;
  isMaster: boolean;
  plan: AssignablePlan | null;
  planStatus: string | null;
  planSource: "stripe" | "manual" | null;
};

export type AssinanteClientSummary = {
  id: string;
  name: string;
};

export type AssinanteListItem = GestorListItem & {
  isActive: boolean;
  clientCount: number;
  clients: AssinanteClientSummary[];
  maxClients: number | null;
};

export const listGestoresFn = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async (): Promise<GestorListItem[]> => {
    const { callAdminEdge } = await import("@/lib/admin-edge.server");
    return callAdminEdge<GestorListItem[]>("admin-assinantes", "listGestores");
  });

export const listAssinantesFn = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async (): Promise<AssinanteListItem[]> => {
    const { callAdminEdge } = await import("@/lib/admin-edge.server");
    return callAdminEdge<AssinanteListItem[]>("admin-assinantes", "listAssinantes");
  });

export const setAssinanteStatusFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(setStatusInput)
  .handler(async ({ data }): Promise<{ userId: string; active: boolean }> => {
    const { callAdminEdge } = await import("@/lib/admin-edge.server");
    return callAdminEdge("admin-assinantes", "setStatus", data);
  });

export const provisionGestorAccessFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(provisionInput)
  .handler(async ({ data }): Promise<ProvisionGestorAccessResult> => {
    const { callAdminEdge } = await import("@/lib/admin-edge.server");
    return callAdminEdge<ProvisionGestorAccessResult>(
      "admin-assinantes",
      "provisionGestor",
      data,
    );
  });

export const setGestorPlanFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(setPlanInput)
  .handler(async ({ data }): Promise<{ userId: string; plan: AssignablePlan }> => {
    const { callAdminEdge } = await import("@/lib/admin-edge.server");
    return callAdminEdge("admin-assinantes", "setPlan", data);
  });

export const getMyEntitlementsFn = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async (): Promise<PlanEntitlements> => {
    const { callAdminEdge } = await import("@/lib/admin-edge.server");
    return callAdminEdge<PlanEntitlements>("admin-assinantes", "myEntitlements");
  });
