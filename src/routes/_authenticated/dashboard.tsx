import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { formatDistanceToNow } from "date-fns";
import { ptBR, enUS, es } from "date-fns/locale";
import { CheckCircle2, FolderKanban, Users, Clock } from "lucide-react";
import { Route as AuthLayout } from "./route";
import { PageHeader } from "@/components/page-header";
import { StatCard } from "@/components/stat-card";
import { EmptyState } from "@/components/empty-state";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StatusBadge, type ContentStatus } from "@/components/status-badge";
import {
  countProjects,
  listClients,
  listPendingApprovals,
  listRecentActivity,
} from "@/lib/api";
import type { LanguageCode } from "@/i18n";

const dateLocales = { "pt-BR": ptBR, "en-US": enUS, "es-ES": es };

export const Route = createFileRoute("/_authenticated/dashboard")({
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
  const locale = dateLocales[(i18n.language as LanguageCode) ?? "pt-BR"] ?? ptBR;

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

  return (
    <div className="mx-auto max-w-7xl space-y-8 p-8">
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
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {clients.slice(0, 6).map((client) => (
              <Link
                key={client.id}
                to="/clients/$clientId"
                params={{ clientId: client.id }}
                className="rounded-xl border p-4 transition-colors hover:bg-muted/40"
              >
                <p className="font-medium">{client.name}</p>
              </Link>
            ))}
          </div>
        )}
      </section>

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
                        className="flex items-center justify-between gap-3 rounded-md border p-3 text-sm transition-colors hover:bg-muted/40"
                      >
                        <div>
                          <p className="font-medium">{item.title}</p>
                          <p className="text-xs text-muted-foreground">
                            {item.projects.clients.name} · {item.projects.name}
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
                    <p>{event.summary}</p>
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
