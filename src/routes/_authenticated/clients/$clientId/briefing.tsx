import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { ChevronLeft } from "lucide-react";
import { BrandBriefingForm } from "@/components/brand-briefing-form";
import { PageHeader } from "@/components/page-header";
import { ensureBrandBriefing, getClient } from "@/lib/api";
import { useAppRole } from "@/hooks/use-app-role";
import { useEntitlements } from "@/hooks/use-entitlements";

export const Route = createFileRoute("/_authenticated/clients/$clientId/briefing")({
  head: () => ({
    meta: [{ title: "Briefing — SOM" }, { name: "robots", content: "noindex" }],
  }),
  component: BrandBriefingPage,
});

function BrandBriefingPage() {
  const { clientId } = Route.useParams();
  const { t } = useTranslation();
  const { isClient } = useAppRole();
  const { entitlements, loading: entitlementsLoading } = useEntitlements();
  const briefingAllowed = isClient || entitlements.brandBriefing;

  const clientQuery = useQuery({
    queryKey: ["clients", clientId],
    queryFn: () => getClient(clientId),
  });

  const briefingQuery = useQuery({
    queryKey: ["brand-briefing", clientId],
    queryFn: () => ensureBrandBriefing(clientId),
    enabled: briefingAllowed,
  });

  return (
    <div className="mx-auto max-w-3xl space-y-6 px-4 py-6 sm:px-6 sm:py-8 md:p-8">
      <Link
        to="/clients/$clientId/library"
        params={{ clientId }}
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ChevronLeft className="h-4 w-4" aria-hidden="true" />
        {t("project.tabs.library")}
      </Link>

      <PageHeader
        title={t("briefing.pageTitle")}
        description={
          clientQuery.data
            ? t("briefing.pageDescription", { client: clientQuery.data.name })
            : t("common.loading")
        }
      />

      {entitlementsLoading ? (
        <p className="text-sm text-muted-foreground">{t("common.loading")}</p>
      ) : !briefingAllowed ? (
        <p className="text-sm text-muted-foreground">{t("accessRelease.featureLocked")}</p>
      ) : briefingQuery.isLoading ? (
        <p className="text-sm text-muted-foreground">{t("common.loading")}</p>
      ) : briefingQuery.isError ? (
        <p className="text-sm text-destructive">
          {briefingQuery.error instanceof Error
            ? briefingQuery.error.message
            : t("common.error")}
        </p>
      ) : briefingQuery.data ? (
        <BrandBriefingForm clientId={clientId} briefing={briefingQuery.data} />
      ) : null}
    </div>
  );
}
