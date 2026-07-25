import { createFileRoute, redirect } from "@tanstack/react-router";
import { getProject, projectDefaultRoute } from "@/lib/api";

export const Route = createFileRoute("/_authenticated/clients/$clientId/projects/$projectId/")({
  beforeLoad: async ({ params }) => {
    let categories: string[] | null = null;
    try {
      const project = await getProject(params.projectId);
      categories = project?.categories ?? null;
    } catch {
      categories = null;
    }
    const { to } = projectDefaultRoute(categories);
    throw redirect({
      to,
      params,
      ...(to === "/clients/$clientId/projects/$projectId/content" ? { search: {} } : {}),
    });
  },
});
