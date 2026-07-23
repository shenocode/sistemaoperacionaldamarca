import { createFileRoute, Outlet } from "@tanstack/react-router";
import { claimClientAccess } from "@/lib/api";

export type ContentSearch = {
  filter?: "review";
  access?: string;
};

export function validateContentSearch(search: Record<string, unknown>): ContentSearch {
  const result: ContentSearch = {};
  if (search.filter === "review") result.filter = "review";
  if (typeof search.access === "string" && search.access.length > 0) {
    result.access = search.access;
  }
  return result;
}

export const Route = createFileRoute("/_authenticated/clients/$clientId/projects/$projectId/content")({
  validateSearch: validateContentSearch,
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
