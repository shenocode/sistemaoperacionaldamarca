import { createFileRoute, Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { CheckCircle2, FolderKanban, Users, Clock } from "lucide-react";
import { Route as AuthLayout } from "./route";
import { PageHeader } from "@/components/page-header";
import { StatCard } from "@/components/stat-card";
import { EmptyState } from "@/components/empty-state";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

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
  const { t } = useTranslation();
  const { user } = AuthLayout.useRouteContext();

  return (
    <div className="mx-auto max-w-7xl space-y-8 p-8">
      <PageHeader
        title={t("dashboard.title")}
        description={`${t("dashboard.welcome")}, ${user.email}`}
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <StatCard label={t("nav.clients")} value={0} icon={Users} />
        <StatCard label={t("dashboard.pendingApprovals")} value={0} icon={Clock} />
        <StatCard label={t("dashboard.projects")} value={0} icon={FolderKanban} />
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
        <EmptyState icon={Users} title={t("clients.empty")} />
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="rounded-xl">
          <CardHeader>
            <CardTitle className="text-base">{t("dashboard.pendingApprovals")}</CardTitle>
          </CardHeader>
          <CardContent>
            <EmptyState icon={CheckCircle2} title={t("dashboard.noPending")} />
          </CardContent>
        </Card>
        <Card className="rounded-xl">
          <CardHeader>
            <CardTitle className="text-base">{t("dashboard.recentActivity")}</CardTitle>
          </CardHeader>
          <CardContent>
            <EmptyState icon={Clock} title={t("dashboard.noActivity")} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
