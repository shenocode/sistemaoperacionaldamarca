import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { ChevronLeft } from "lucide-react";
import { GestorSubscriptionCard } from "@/components/gestor-subscription-card";
import { PageHeader } from "@/components/page-header";
import { getMyProfile } from "@/lib/api";

export const Route = createFileRoute("/_authenticated/profile/assinatura 3")({
  head: () => ({
    meta: [
      { title: "Assinatura — SOM" },
      { name: "description", content: "Plano atual, limites de uso e opções de upgrade." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: GestorSubscriptionPage,
});

function GestorSubscriptionPage() {
  const { t } = useTranslation();
  const profileQuery = useQuery({
    queryKey: ["my-profile"],
    queryFn: getMyProfile,
  });

  return (
    <>
      <Link
        to="/profile"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ChevronLeft className="h-4 w-4" aria-hidden="true" />
        {t("gestorProfile.hub.back")}
      </Link>
      <PageHeader
        title={t("gestorProfile.subscription.title")}
        description={t("gestorProfile.subscription.subtitle")}
      />
      <GestorSubscriptionCard email={profileQuery.data?.email} />
    </>
  );
}
