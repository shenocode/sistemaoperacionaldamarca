import { useQuery } from "@tanstack/react-query";
import { isAdminMasterEmail } from "@/lib/admin-master";
import { isAdmin } from "@/lib/api";
import { useAuth } from "@/hooks/use-auth";

export function useAppRole() {
  const { user, loading: authLoading } = useAuth();
  const query = useQuery({
    queryKey: ["app-role", "is-admin"],
    queryFn: isAdmin,
    staleTime: 60_000,
  });

  const isAdminUser = query.data === true;
  const isAdminMaster = isAdminUser && isAdminMasterEmail(user?.email);

  return {
    isAdmin: isAdminUser,
    isAdminMaster,
    isClient: query.data === false,
    loading: query.isLoading || authLoading,
    error: query.error,
  };
}
