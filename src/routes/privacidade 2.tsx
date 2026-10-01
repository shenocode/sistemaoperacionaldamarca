import { createFileRoute, Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";

const PRIVACY_SECTIONS = ["collect", "use", "providers", "delete"] as const;

export const Route = createFileRoute("/privacidade 2")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Privacidade — SOM" },
      { name: "description", content: "Política de privacidade da plataforma SOM." },
    ],
  }),
  component: PrivacidadePage,
});

function PrivacidadePage() {
  const { t } = useTranslation();
  return (
    <div className="mx-auto max-w-2xl space-y-8 px-4 py-12">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">{t("legal.privacyTitle")}</h1>
        <p className="text-xs text-muted-foreground">{t("legal.updated")}</p>
      </div>
      <div className="space-y-6">
        {PRIVACY_SECTIONS.map((section) => (
          <section key={section} className="space-y-2">
            <h2 className="text-base font-medium text-foreground">
              {t(`legal.privacy.${section}Title`)}
            </h2>
            <p className="text-sm text-muted-foreground">{t(`legal.privacy.${section}Body`)}</p>
          </section>
        ))}
      </div>
      <Button asChild variant="outline" size="sm">
        <Link to="/">{t("legal.backHome")}</Link>
      </Button>
    </div>
  );
}
