import { createFileRoute, Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { ChevronRight, CreditCard, UserRound } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent } from "@/components/ui/card";

export const Route = createFileRoute("/_authenticated/profile/index 3")({
  head: () => ({
    meta: [
      { title: "Meu Perfil — SOM" },
      { name: "description", content: "Escolha o que deseja gerenciar na sua conta." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: GestorProfileHubPage,
});

function GestorProfileHubPage() {
  const { t } = useTranslation();

  return (
    <>
      <PageHeader title={t("gestorProfile.title")} description={t("gestorProfile.hub.subtitle")} />

      <div className="grid gap-3">
        <Link to="/profile/assinatura" className="block">
          <Card className="rounded-xl transition-colors hover:bg-muted/40">
            <CardContent className="flex items-center gap-4 p-5">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-muted">
                <CreditCard className="h-5 w-5" aria-hidden="true" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-medium tracking-tight">{t("gestorProfile.subscription.title")}</p>
                <p className="mt-0.5 text-sm text-muted-foreground">
                  {t("gestorProfile.hub.subscriptionDescription")}
                </p>
              </div>
              <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
            </CardContent>
          </Card>
        </Link>

        <Link to="/profile/conta" className="block">
          <Card className="rounded-xl transition-colors hover:bg-muted/40">
            <CardContent className="flex items-center gap-4 p-5">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-muted">
                <UserRound className="h-5 w-5" aria-hidden="true" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-medium tracking-tight">{t("gestorProfile.hub.accountTitle")}</p>
                <p className="mt-0.5 text-sm text-muted-foreground">
                  {t("gestorProfile.hub.accountDescription")}
                </p>
              </div>
              <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
            </CardContent>
          </Card>
        </Link>
      </div>
    </>
  );
}
