import { useQuery } from "@tanstack/react-query";
import { isAdmin } from "@/lib/api";

export function useAppRole() {
  const query = useQuery({
    queryKey: ["app-role", "is-admin"],
    queryFn: isAdmin,
    staleTime: 60_000,
  });

  return {
    isAdmin: query.data === true,
    isClient: query.data === false,
    loading: query.isLoading,
    error: query.error,
  };
}
