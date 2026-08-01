import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { formatDistanceToNow } from "date-fns";
import { ptBR, enUS, es } from "date-fns/locale";
import { CheckCircle2, FolderKanban, Users, Clock } from "lucide-react";
import { Route as AuthLayout } from "./route";
import { ClientCard } from "@/components/client-card";
import {
  ClientSettingsDialog,
  useClientSettingsDialog,
} from "@/components/client-settings-dialog";
import { PageHeader } from "@/components/page-header";
import { StatCard } from "@/components/stat-card";
import { EmptyState } from "@/components/empty-state";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StatusBadge, type ContentStatus } from "@/components/status-badge";
import {
  countProjects,
  isAdmin,
  listClients,
  listPendingApprovals,
  listRecentActivity,
  resolvePostLoginPath,
  updateActivityEventI18n,
  updateContentI18n,
} from "@/lib/api";
import { getLocalizedText, normalizeAppLocale } from "@/lib/i18n-content";
import { backfillRowsForLocale } from "@/hooks/use-i18n-backfill";
import type { LanguageCode } from "@/i18n";

const dateLocales = { "pt-BR": ptBR, "en-US": enUS, "es-ES": es };

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
  const locale = dateLocales[(i18n.language as LanguageCode) ?? "pt-BR"] ?? ptBR;
  const uiLocale = normalizeAppLocale(i18n.resolvedLanguage ?? i18n.language);
  const settingsDialog = useClientSettingsDialog();

  const clientsQuery = useQuery({ queryKey: ["clients"], queryFn: listClients });
  const projectsCountQuery = useQuery({
    queryKey: ["dashboard", "projects-count"],
    queryFn: countProjects,
  });
  const pendingQuery = useQuery({
    queryKey: ["dashboard", "pending"],
    queryFn: listPendingApprovals,
  });
  const activityQuery = useQuery({
    queryKey: ["dashboard", "activity"],
    queryFn: () => listRecentActivity(12),
  });

  const clients = clientsQuery.data ?? [];
  const pending = pendingQuery.data ?? [];
  const activity = activityQuery.data ?? [];

  useEffect(() => {
    if (!pending.length) return;
    let cancelled = false;
    void (async () => {
      const improved = await backfillRowsForLocale({
        rows: pending,
        locale: uiLocale,
        getKey: (r) => r.id,
        getI18n: (r) => r.i18n,
        getFields: (r) => ({ title: r.title }),
        persist: (r, nextI18n) => updateContentI18n(r.id, nextI18n).then(() => undefined),
        concurrency: 2,
      });
      if (!cancelled && improved > 0) {
        void queryClient.invalidateQueries({ queryKey: ["dashboard", "pending"] });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [pending, queryClient, uiLocale]);

  useEffect(() => {
    if (!activity.length) return;
    let cancelled = false;
    void (async () => {
      const improved = await backfillRowsForLocale({
        rows: activity,
        locale: uiLocale,
        getKey: (r) => r.id,
        getI18n: (r) => r.i18n,
        getFields: (r) => ({ summary: r.summary }),
        persist: (r, nextI18n) => updateActivityEventI18n(r.id, nextI18n),
        concurrency: 2,
      });
      if (!cancelled && improved > 0) {
        void queryClient.invalidateQueries({ queryKey: ["dashboard", "activity"] });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [activity, queryClient, uiLocale]);

  return (
    <div className="mx-auto max-w-7xl space-y-8 px-4 py-6 sm:px-6 sm:py-8 md:p-8">
      <PageHeader
        title={t("dashboard.title")}
        description={`${t("dashboard.welcome")}, ${user.email}`}
      />

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
                onOpenSettings={(c) => void settingsDialog.openSettings(c)}
              />
            ))}
          </div>
        )}
      </section>

      <ClientSettingsDialog {...settingsDialog} />

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="rounded-xl">
          <CardHeader>
            <CardTitle className="text-base">{t("dashboard.pendingApprovals")}</CardTitle>
          </CardHeader>
          <CardContent>
            {pending.length === 0 ? (
              <EmptyState icon={CheckCircle2} title={t("dashboard.noPending")} />
            ) : (
              <ul className="space-y-3">
                {pending.map((item) => (
                    <li key={item.id}>
                      <Link
                        to="/clients/$clientId/projects/$projectId/content/$contentId"
                        params={{
                          clientId: item.projects.client_id,
                          projectId: item.projects.id,
                          contentId: item.id,
                        }}
                        search={{}}
                        className="flex items-center justify-between gap-3 rounded-md border p-3 text-sm transition-colors hover:bg-muted/40"
                      >
                        <div>
                          <p className="font-medium">
                            {getLocalizedText(item.i18n, "title", item.title, uiLocale)}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {getLocalizedText(
                              item.projects.clients.i18n,
                              "name",
                              item.projects.clients.name,
                              uiLocale,
                            )}{" "}
                            ·{" "}
                            {getLocalizedText(
                              item.projects.i18n,
                              "name",
                              item.projects.name,
                              uiLocale,
                            )}
                          </p>
                        </div>
                        <StatusBadge status={item.status as ContentStatus} />
                      </Link>
                    </li>
                  ))}
              </ul>
            )}
          </CardContent>
        </Card>
        <Card className="rounded-xl">
          <CardHeader>
            <CardTitle className="text-base">{t("dashboard.recentActivity")}</CardTitle>
          </CardHeader>
          <CardContent>
            {activity.length === 0 ? (
              <EmptyState icon={Clock} title={t("dashboard.noActivity")} />
            ) : (
              <ul className="space-y-3">
                {activity.map((event) => (
                  <li key={event.id} className="flex items-start justify-between gap-3 text-sm">
                    <p>{getLocalizedText(event.i18n, "summary", event.summary, uiLocale)}</p>
                    <span className="shrink-0 text-xs text-muted-foreground">
                      {formatDistanceToNow(new Date(event.created_at), {
                        addSuffix: true,
                        locale,
                      })}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
