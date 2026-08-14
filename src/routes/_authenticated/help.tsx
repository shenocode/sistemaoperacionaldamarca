import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { HelpForm } from "@/components/help-form";
import { PageHeader } from "@/components/page-header";
import { useAppRole } from "@/hooks/use-app-role";
import { listClients } from "@/lib/api";

export const Route = createFileRoute("/_authenticated/help")({
  head: () => ({
    meta: [
      { title: "Preciso de ajuda — SOM" },
      { name: "description", content: "Envie um pedido de ajuda à plataforma ou ao seu gestor." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: HelpPage,
});

function HelpPage() {
  const { t } = useTranslation();
  const { isAdmin, isAdminMaster, loading } = useAppRole();
  const [selectedClientId, setSelectedClientId] = useState("");

  const clientsQuery = useQuery({
    queryKey: ["clients"],
    queryFn: listClients,
    enabled: !loading && !isAdmin,
  });

  const clients = clientsQuery.data ?? [];

  useEffect(() => {
    if (isAdmin || clients.length === 0) {
      setSelectedClientId("");
      return;
    }
    setSelectedClientId((current) => {
      if (current && clients.some((c) => c.id === current)) return current;
      return clients[0].id;
    });
  }, [isAdmin, clients]);

  if (loading) {
    return (
      <div className="mx-auto max-w-lg px-4 py-6 sm:px-6 sm:py-8 md:p-8">
        <p className="text-sm text-muted-foreground">{t("common.loading")}</p>
      </div>
    );
  }

  if (isAdminMaster) {
    return (
      <div className="mx-auto max-w-lg space-y-6 px-4 py-6 sm:px-6 sm:py-8 md:p-8">
        <PageHeader title={t("help.pageTitle")} description={t("help.adminMasterHint")} />
        <p className="text-sm text-muted-foreground">{t("help.adminMasterInbox")}</p>
      </div>
    );
  }

  const audience = isAdmin ? "gestor" : "client";

  return (
    <div className="mx-auto max-w-lg space-y-6 px-4 py-6 sm:px-6 sm:py-8 md:p-8">
      <PageHeader
        title={t("help.pageTitle")}
        description={
          audience === "gestor" ? t("help.pageSubtitleGestor") : t("help.pageSubtitleClient")
        }
      />

      {!isAdmin && clientsQuery.isLoading ? (
        <p className="text-sm text-muted-foreground">{t("common.loading")}</p>
      ) : !isAdmin && clients.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t("help.noClient")}</p>
      ) : (
        <HelpForm
          idPrefix="help-page"
          audience={audience}
          showIntro={false}
          clientId={selectedClientId}
          clients={clients.map((c) => ({ id: c.id, name: c.name, i18n: c.i18n }))}
          onClientIdChange={setSelectedClientId}
        />
      )}
    </div>
  );
}
