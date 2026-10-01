import { createFileRoute, redirect } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { HelpRequestsInbox } from "@/components/help-requests-inbox";
import { PageHeader } from "@/components/page-header";
import { useAppRole } from "@/hooks/use-app-role";
import { isAdmin, listReceivedHelpRequests, resolvePostLoginPath } from "@/lib/api";

export const Route = createFileRoute("/_authenticated/help-inbox 2")({
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
      { title: "Ajuda — SOM" },
      { name: "description", content: "Pedidos de ajuda recebidos." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: HelpInboxPage,
});

function HelpInboxPage() {
  const { t } = useTranslation();
  const { isAdminMaster, loading: roleLoading } = useAppRole();

  const gestorHelpQuery = useQuery({
    queryKey: ["help-requests", "gestor_platform"],
    queryFn: () => listReceivedHelpRequests({ kind: "gestor_platform" }),
    enabled: isAdminMaster,
  });

  const clientHelpQuery = useQuery({
    queryKey: ["help-requests", "client_gestor"],
    queryFn: () => listReceivedHelpRequests({ kind: "client_gestor" }),
    enabled: !roleLoading,
  });

  return (
    <div className="mx-auto max-w-3xl space-y-8 px-4 py-6 sm:px-6 sm:py-8 md:p-8">
      <PageHeader title={t("helpInbox.title")} description={t("helpInbox.subtitle")} />

      {isAdminMaster ? (
        <HelpRequestsInbox
          title={t("helpInbox.fromGestoresTitle")}
          description={t("helpInbox.fromGestoresSubtitle")}
          requests={gestorHelpQuery.data}
          loading={gestorHelpQuery.isLoading}
          error={gestorHelpQuery.isError}
          kind="gestor_platform"
        />
      ) : null}

      <HelpRequestsInbox
        title={t("helpInbox.fromClientsTitle")}
        description={t("helpInbox.fromClientsSubtitle")}
        requests={clientHelpQuery.data}
        loading={clientHelpQuery.isLoading}
        error={clientHelpQuery.isError}
        kind="client_gestor"
      />
    </div>
  );
}
