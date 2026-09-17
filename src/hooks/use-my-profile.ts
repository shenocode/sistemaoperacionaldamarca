import { useQuery } from "@tanstack/react-query";
import { getMyProfile } from "@/lib/api";
import { useAuth } from "@/hooks/use-auth";

export function useMyProfile(options?: { enabled?: boolean }) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["my-profile"],
    queryFn: getMyProfile,
    enabled: options?.enabled ?? Boolean(user),
    staleTime: 60_000,
  });
}
