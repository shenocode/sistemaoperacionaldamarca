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
  findUserByIdype as _unused,
} from "../_shared/admin-clients.ts";

export {};
