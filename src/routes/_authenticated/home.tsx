import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { FolderKanban } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/empty-state";
import { Card, CardContent } from "@/components/ui/card";
import {
  claimClientAccess,
  clearAuthNext,
  extractAccessTokenFromPath,
  getClientHomeTarget,
  isAdmin,
  listAccessibleProjects,
  readAuthNext,
} from "@/lib/api";

export const Route = createFileRoute("/_authenticated/home")({
  ssr: false,
  beforeLoad: async () => {
    const pending = readAuthNext();
    if (pending) {
      const access = extractAccessTokenFromPath(pending);
      if (access) {
        try {
          await claimClientAccess(access);
        } catch {
          // Still send the user to the intended path; content route may retry.
        }
      }
      clearAuthNext();
      throw redirect({ href: pending as "/" });
    }

    if (await isAdmin()) throw redirect({ to: "/dashboard" });
    const target = await getClientHomeTarget();
    if (target.type === "project") {
      throw redirect({
        to: "/clients/$clientId/projects/$projectId/feed",
        params: { clientId: target.clientId, projectId: target.projectId },
      });
    }
  },
  head: () => ({
    meta: [
      { title: "Meus projetos — SOM" },
      { name: "description", content: "Projetos disponíveis para revisão." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: ClientHomePage,
});

function ClientHomePage() {
  const { t } = useTranslation();
  const projectsQuery = useQuery({
    queryKey: ["client-home", "projects"],
    queryFn: listAccessibleProjects,
  });

  const projects = projectsQuery.data ?? [];

  return (
    <div className="mx-auto max-w-3xl px-4 py-6 sm:px-6 sm:py-8 md:p-8">
      <PageHeader title={t("clientHome.title")} description={t("clientHome.subtitle")} />
      {projectsQuery.isLoading ? (
        <p className="text-sm text-muted-foreground">{t("common.loading")}</p>
      ) : projects.length === 0 ? (
        <EmptyState
          icon={FolderKanban}
          title={t("clientHome.empty")}
          description={t("clientHome.emptyHint")}
        />
      ) : (
        <ul className="mt-6 space-y-3">
          {projects.map((project) => (
            <li key={project.projectId}>
              <Link
                to="/clients/$clientId/projects/$projectId/feed"
                params={{ clientId: project.clientId, projectId: project.projectId }}
                className="block"
              >
                <Card className="transition-colors hover:bg-muted/40">
                  <CardContent className="flex items-center gap-3 p-4">
                    {project.clientLogoUrl ? (
                      <img
                        src={project.clientLogoUrl}
                        alt=""
                        className="h-10 w-10 shrink-0 rounded-full object-cover"
                      />
                    ) : (
                      <FolderKanban className="h-5 w-5 shrink-0 text-muted-foreground" />
                    )}
                    <div className="min-w-0">
                      <p className="truncate font-medium">{project.projectName}</p>
                      <p className="truncate text-sm text-muted-foreground">{project.clientName}</p>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
