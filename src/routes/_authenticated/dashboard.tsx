import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { useEffect, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { FolderKanban, Users, Clock } from "lucide-react";
import { Route as AuthLayout } from "./route";
import { ClientCard } from "@/components/client-card";
import {
  ClientSettingsDialog,
  useClientSettingsDialog,
} from "@/components/client-settings-dialog";
import { DashboardBusinessSection } from "@/components/dashboard-business-section";
import { PageHeader } from "@/components/page-header";
import { StatCard } from "@/components/stat-card";
import { EmptyState } from "@/components/empty-state";
import { Button } from "@/components/ui/button";
import {
  countProjects,
  ensureFieldsTranslated,
  getCanonicalText,
  isAdmin,
  listClients,
  listPendingApprovals,
  resolvePostLoginPath,
  updateProject,
  type ClientWithProjects,
} from "@/lib/api";
import {
  fieldsNeedLocaleBackfill,
  normalizeAppLocale,
  parseRowI18n,
} from "@/lib/i18n-content";
import { useAppRole } from "@/hooks/use-app-role";

export const Route = createFileRoute("/_authenticated/dashboard")({
  beforeLoad: async () => {
    if (!(await isAdmin())) {
      const dest = await resolvePostLoginPath();
      if (dest.to === "/clients/$clientId/projects/$projectId/feed") {
        throw redirect({ to: dest.to, params: dest.params, search: dest.search });
      }
      throw redirect({ to: dest.to });
    }
  },
  head: () => ({
    meta: [
      { title: "Dashboard — SOM" },
      { name: "description", content: "Visão geral da sua operação SOM." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: DashboardPage,
});

function DashboardPage() {
  const { t, i18n } = useTranslation();
  const { user } = AuthLayout.useRouteContext();
  const queryClient = useQueryClient();
  const { isAdminMaster, loading: roleLoading } = useAppRole();
  const uiLocale = normalizeAppLocale(i18n.resolvedLanguage ?? i18n.language);
  const settingsDialog = useClientSettingsDialog();

  const clientsQuery = useQuery({ queryKey: ["clients"], queryFn: listClients });
  const projectsCountQuery = useQuery({
    queryKey: ["dashboard", "projects-count"],
    queryFn: countProjects,
    enabled: !roleLoading && !isAdminMaster,
  });
  const pendingQuery = useQuery({
    queryKey: ["dashboard", "pending"],
    queryFn: listPendingApprovals,
    enabled: !roleLoading && !isAdminMaster,
  });

  const clients = clientsQuery.data ?? [];
  const pending = pendingQuery.data ?? [];

  const projectBackfillKey = useMemo(
    () =>
      clients
        .flatMap((c) => c.projects.map((p) => `${p.id}:${p.updated_at}`))
        .join("|"),
    [clients],
  );

  // Backfill project names shown on client cards.
  useEffect(() => {
    if (!clients.length) return;
    let cancelled = false;
    void (async () => {
      let improved = 0;
      for (const client of clients) {
        for (const project of client.projects) {
          if (!fieldsNeedLocaleBackfill(project.i18n, { name: project.name }, uiLocale)) {
            continue;
          }
          try {
            const nextI18n = await ensureFieldsTranslated(parseRowI18n(project.i18n), {
              name: project.name,
            });
            if (!fieldsNeedLocaleBackfill(nextI18n, { name: project.name }, uiLocale)) {
              await updateProject(project.id, {
                name: getCanonicalText(nextI18n, "name", project.name),
                i18n: nextI18n,
              });
              improved += 1;
            }
          } catch {
            // Skip; AI or RLS may be unavailable.
          }
        }
      }
      if (!cancelled && improved > 0) {
        void queryClient.invalidateQueries({ queryKey: ["clients"] });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [projectBackfillKey, queryClient, uiLocale, clients]);

  return (
    <div className="mx-auto max-w-7xl space-y-8 px-4 py-6 sm:px-6 sm:py-8 md:p-8">
      <PageHeader
        title={t("dashboard.title")}
        description={`${t("dashboard.welcome")}, ${user.email}`}
      />

      {!roleLoading && isAdminMaster ? (
        <DashboardBusinessSection />
      ) : null}
      {!roleLoading && !isAdminMaster ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <StatCard label={t("nav.clients")} value={clients.length} icon={Users} />
          <StatCard
            label={t("dashboard.pendingApprovals")}
            value={pending.length}
            icon={Clock}
          />
          <StatCard
            label={t("dashboard.projects")}
            value={projectsCountQuery.data ?? 0}
            icon={FolderKanban}
          />
        </div>
      ) : null}

      <section aria-labelledby="clients-heading" className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 id="clients-heading" className="text-lg font-semibold tracking-tight">
            {t("dashboard.clientsSection")}
          </h2>
          <Button asChild variant="ghost" size="sm">
            <Link to="/clients">{t("dashboard.viewAll")}</Link>
          </Button>
        </div>
        {clients.length === 0 ? (
          <EmptyState icon={Users} title={t("clients.empty")} />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {clients.slice(0, 6).map((client) => (
              <ClientCard
                key={client.id}
                client={client}
                onOpenSettings={(c: ClientWithProjects) => void settingsDialog.openSettings(c)}
              />
            ))}
          </div>
        )}
      </section>

      <ClientSettingsDialog {...settingsDialog} />
    </div>
  );
}
