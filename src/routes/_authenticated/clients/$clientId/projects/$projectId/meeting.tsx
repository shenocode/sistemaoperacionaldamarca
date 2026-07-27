import { createFileRoute, Outlet } from "@tanstack/react-router";
import { claimClientAccess } from "@/lib/api";

export type MeetingSearch = {
  access?: string;
};

export function validateMeetingSearch(search: Record<string, unknown>): MeetingSearch {
  const result: MeetingSearch = {};
  if (typeof search.access === "string" && search.access.length > 0) {
    result.access = search.access;
  }
  return result;
}

export const Route = createFileRoute(
  "/_authenticated/clients/$clientId/projects/$projectId/meeting",
)({
  validateSearch: validateMeetingSearch,
  beforeLoad: async ({ search }) => {
    if (!search.access) return;
    try {
      await claimClientAccess(search.access);
    } catch {
      // Already a member, admin, or stale token — page/RLS decide access.
    }
  },
  component: () => <Outlet />,
});
