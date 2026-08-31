import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
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
  isAdmin,
  listClients,
  listPendingApprovals,
  resolvePostLoginPath,
  type ClientWithProjects,
} from "@/lib/api";
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
  const { t } = useTranslation();
  const { user } = AuthLayout.useRouteContext();
  const { isAdminMaster, loading: roleLoading } = useAppRole();
  const settingsDialog = useClientSettingsDialog();

  const clientsQuery = useQuery({ queryKey: ["clients"], queryFn: listClients });
  const pendingQuery = useQuery({
    queryKey: ["dashboard", "pending"],
    queryFn: listPendingApprovals,
    enabled: !roleLoading && !isAdminMaster,
  });

  const clients = clientsQuery.data ?? [];
  const pending = pendingQuery.data ?? [];
  const projectCount = useMemo(
    () => clients.reduce((sum, client) => sum + client.projects.length, 0),
    [clients],
  );

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
            value={projectCount}
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
