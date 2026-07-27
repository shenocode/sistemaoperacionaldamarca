import { createFileRoute, Link, Outlet } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { ChevronLeft } from "lucide-react";
import { cn } from "@/lib/utils";
import { getClient, getProject, projectCategoryConfig, type ProjectTabId } from "@/lib/api";
import { useAppRole } from "@/hooks/use-app-role";
import { useEntitlements } from "@/hooks/use-entitlements";

export const Route = createFileRoute("/_authenticated/clients/$clientId/projects/$projectId")({
  head: () => ({ meta: [{ title: "Projeto — SOM" }, { name: "robots", content: "noindex" }] }),
  component: ProjectLayout,
});

const TAB_PATHS: Record<
  ProjectTabId,
  | "/clients/$clientId/projects/$projectId/feed"
  | "/clients/$clientId/projects/$projectId/calendar"
  | "/clients/$clientId/projects/$projectId/content"
  | "/clients/$clientId/projects/$projectId/meeting"
  | "/clients/$clientId/projects/$projectId/library"
  | "/clients/$clientId/projects/$projectId/settings"
> = {
  feed: "/clients/$clientId/projects/$projectId/feed",
  calendar: "/clients/$clientId/projects/$projectId/calendar",
  content: "/clients/$clientId/projects/$projectId/content",
  meeting: "/clients/$clientId/projects/$projectId/meeting",
  library: "/clients/$clientId/projects/$projectId/library",
  settings: "/clients/$clientId/projects/$projectId/settings",
};

function ProjectLayout() {
  const { clientId, projectId } = Route.useParams();
  const { t } = useTranslation();
  const { isAdmin, isClient } = useAppRole();
  const { entitlements } = useEntitlements();

  const projectQuery = useQuery({
    queryKey: ["projects", "detail", projectId],
    queryFn: () => getProject(projectId),
  });

  const clientQuery = useQuery({
    queryKey: ["clients", clientId],
    queryFn: () => getClient(clientId),
  });

  const categoryConfig = projectCategoryConfig(projectQuery.data?.categories);

  // Clientes veem as mesmas abas do projeto; dashboard e gestão ficam
  // bloqueados por isAdmin / canManageClient (ações de escrita e rotas admin).
  const tabs = categoryConfig.tabs
    .map((tabId) => ({
      id: tabId,
      to: TAB_PATHS[tabId],
      label: t(`project.tabs.${tabId}`),
      requiresLibrary: tabId === "library",
    }))
    .filter((tab) => {
      if (tab.requiresLibrary) {
        return isClient || entitlements.library;
      }
      return true;
    });

  return (
    <div
      className={cn(
        "mx-auto w-full overflow-x-clip px-4 py-6 sm:px-6 sm:py-8 md:p-8",
        isClient ? "max-w-6xl" : "max-w-7xl",
      )}
    >
      {isAdmin ? (
        <Link
          to="/clients/$clientId"
          params={{ clientId }}
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ChevronLeft className="h-4 w-4" aria-hidden="true" />
          {clientQuery.data?.name ?? t("project.back")}
        </Link>
      ) : (
        <Link
          to="/home"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ChevronLeft className="h-4 w-4" aria-hidden="true" />
          {t("nav.myProjects")}
        </Link>
      )}
      <div className="mt-3 flex items-start gap-3">
        {clientQuery.data?.logo_url ? (
          <img
            src={clientQuery.data.logo_url}
            alt=""
            className="mt-0.5 h-14 w-14 shrink-0 rounded-full object-cover sm:h-20 sm:w-20 md:h-24 md:w-24"
          />
        ) : null}
        <div className="min-w-0 flex-1">
          <h1 className="text-xl font-semibold tracking-tight break-words sm:text-2xl">
            {projectQuery.data?.name ?? t("common.loading")}
          </h1>
          {projectQuery.data?.description ? (
            <p className="mt-1 line-clamp-2 text-sm text-muted-foreground sm:line-clamp-none">
              {projectQuery.data.description}
            </p>
          ) : null}
        </div>
      </div>

      {!categoryConfig.experienceReady ? (
        <p className="mt-4 rounded-lg border border-dashed px-3 py-2 text-xs text-muted-foreground">
          {t("project.categoryExperiencePending")}
        </p>
      ) : null}

      <div
        role="tablist"
        className="-mx-4 mt-6 flex gap-1 overflow-x-auto overscroll-x-contain border-b px-4 [scrollbar-width:none] sm:-mx-6 sm:px-6 md:mx-0 md:px-0 [&::-webkit-scrollbar]:hidden"
      >
        {tabs.map((tab) => (
          <Link
            key={tab.id}
            to={tab.to}
            params={{ clientId, projectId }}
            {...(tab.to === "/clients/$clientId/projects/$projectId/content"
              ? { search: {} }
              : {})}
            role="tab"
            className="shrink-0 border-b-2 -mb-px px-3 py-2 text-sm font-medium transition-colors sm:px-4"
            inactiveProps={{
              className: "border-transparent text-muted-foreground hover:text-foreground",
            }}
            activeProps={{ className: "border-primary text-primary" }}
          >
            {tab.label}
          </Link>
        ))}
      </div>

      <div className="mt-6 min-w-0">
        <Outlet />
      </div>
    </div>
  );
}
