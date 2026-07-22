import { createFileRoute, Link, Outlet, useLocation } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/clients/$clientId/projects/$projectId")({
  head: () => ({ meta: [{ title: "Projeto — SOM" }, { name: "robots", content: "noindex" }] }),
  component: ProjectLayout,
});

function ProjectLayout() {
  const { clientId, projectId } = Route.useParams();
  const { t } = useTranslation();
  const { pathname } = useLocation();

  const tabs = [
    { to: "library", label: t("project.tabs.library") },
    { to: "content", label: t("project.tabs.content") },
    { to: "calendar", label: t("project.tabs.calendar") },
    { to: "settings", label: t("project.tabs.settings") },
  ] as const;

  const base = `/clients/${clientId}/projects/${projectId}`;

  return (
    <div className="p-8">
      <Link to="/clients/$clientId" params={{ clientId }} className="text-sm text-muted-foreground hover:underline">
        ← {t("clients.projects")}
      </Link>
      <h1 className="mt-2 text-2xl font-semibold tracking-tight">Project {projectId}</h1>

      <div className="mt-6 flex gap-1 border-b">
        {tabs.map((tab) => {
          const href = `${base}/${tab.to}`;
          const active = pathname.startsWith(href);
          return (
            <a
              key={tab.to}
              href={href}
              className={cn(
                "px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors",
                active
                  ? "border-primary text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground",
              )}
            >
              {tab.label}
            </a>
          );
        })}
      </div>

      <div className="mt-6">
        <Outlet />
      </div>
    </div>
  );
}
