import { useQuery } from "@tanstack/react-query";
import { getMyEntitlements } from "@/lib/api";
import { entitlementsForPlan, type PlanEntitlements } from "@/lib/plan-entitlements";
import { useAppRole } from "@/hooks/use-app-role";

const EMPTY: PlanEntitlements = entitlementsForPlan(null);

export function useEntitlements() {
  const { isAdmin, isAdminMaster, loading: roleLoading } = useAppRole();

  const query = useQuery({
    queryKey: ["entitlements", "me"],
    queryFn: getMyEntitlements,
    enabled: isAdmin,
    staleTime: 0,
    refetchOnMount: "always",
  });

  const entitlements: PlanEntitlements = isAdminMaster
    ? entitlementsForPlan(null, { isMaster: true })
    : (query.data ?? EMPTY);

  return {
    entitlements,
    loading: roleLoading || (isAdmin && !isAdminMaster && query.isLoading),
    error: query.error,
    refetch: query.refetch,
  };
}
