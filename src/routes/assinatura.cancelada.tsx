import { createFileRoute, Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/assinatura/cancelada")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Checkout cancelado — SOM" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AssinaturaCanceladaPage,
});

function AssinaturaCanceladaPage() {
  const { t } = useTranslation();

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/40 px-4">
      <div className="w-full max-w-md space-y-6 rounded-lg border bg-card p-8 text-center shadow-sm">
        <h1 className="text-2xl font-semibold tracking-tight">{t("subscription.cancelTitle")}</h1>
        <p className="text-sm text-muted-foreground">{t("subscription.cancelBody")}</p>
        <div className="flex flex-col gap-2 sm:flex-row sm:justify-center">
          <Button asChild>
            <Link to="/" hash="planos">
              {t("subscription.cancelCta")}
            </Link>
          </Button>
          <Button asChild variant="outline">
            <Link to="/">{t("subscription.backHome")}</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
