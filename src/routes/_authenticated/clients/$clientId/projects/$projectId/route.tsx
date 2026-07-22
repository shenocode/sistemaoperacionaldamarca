import { createFileRoute, Link, Outlet } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { ChevronLeft } from "lucide-react";
import { cn } from "@/lib/utils";
import { getClient, getProject } from "@/lib/api";

export const Route = createFileRoute("/_authenticated/clients/$clientId/projects/$projectId")({
  head: () => ({ meta: [{ title: "Projeto — SOM" }, { name: "robots", content: "noindex" }] }),
  component: ProjectLayout,
});

function ProjectLayout() {
  const { clientId, projectId } = Route.useParams();
  const { t } = useTranslation();

  const projectQuery = useQuery({
    queryKey: ["projects", "detail", projectId],
    queryFn: () => getProject(projectId),
  });

  const clientQuery = useQuery({
    queryKey: ["clients", clientId],
    queryFn: () => getClient(clientId),
  });

  const tabs = [
    { to: "/clients/$clientId/projects/$projectId/library", label: t("project.tabs.library") },
    { to: "/clients/$clientId/projects/$projectId/content", label: t("project.tabs.content") },
    { to: "/clients/$clientId/projects/$projectId/calendar", label: t("project.tabs.calendar") },
    { to: "/clients/$clientId/projects/$projectId/settings", label: t("project.tabs.settings") },
  ] as const;

  return (
    <div className="mx-auto max-w-7xl p-8">
      <Link
        to="/clients/$clientId"
        params={{ clientId }}
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ChevronLeft className="h-4 w-4" aria-hidden="true" />
        {clientQuery.data?.name ?? t("project.back")}
      </Link>
      <h1 className="mt-3 text-2xl font-semibold tracking-tight">
        {projectQuery.data?.name ?? t("common.loading")}
      </h1>
      {projectQuery.data?.description ? (
        <p className="mt-1 text-sm text-muted-foreground">{projectQuery.data.description}</p>
      ) : null}

      <div role="tablist" className="mt-6 flex gap-1 border-b">
        {tabs.map((tab) => (
          <Link
            key={tab.to}
            to={tab.to}
            params={{ clientId, projectId }}
            role="tab"
            className={cn(
              "px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors",
              "border-transparent text-muted-foreground hover:text-foreground",
            )}
            activeProps={{ className: "border-primary text-foreground" }}
          >
            {tab.label}
          </Link>
        ))}
      </div>

      <div className="mt-6">
        <Outlet />
      </div>
    </div>
  );
}
