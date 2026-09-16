import { createFileRoute, Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";

const TERM_SECTIONS = [
  "service",
  "billing",
  "cancel",
  "late",
  "limits",
  "data",
  "ai",
  "account",
] as const;

export const Route = createFileRoute("/termos")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Termos de uso — SOM" },
      { name: "description", content: "Termos de uso da plataforma SOM." },
    ],
  }),
  component: TermosPage,
});

function TermosPage() {
  const { t } = useTranslation();
  return (
    <div className="mx-auto max-w-2xl space-y-8 px-4 py-12">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">{t("legal.termsTitle")}</h1>
        <p className="text-xs text-muted-foreground">{t("legal.updated")}</p>
      </div>
      <div className="space-y-6">
        {TERM_SECTIONS.map((section) => (
          <section key={section} className="space-y-2">
            <h2 className="text-base font-medium text-foreground">
              {t(`legal.terms.${section}Title`)}
            </h2>
            <p className="text-sm text-muted-foreground">{t(`legal.terms.${section}Body`)}</p>
          </section>
        ))}
      </div>
      <p className="text-sm text-muted-foreground">
        {t("legal.resourcesSeeAlso")}{" "}
        <Link to="/recursos" className="font-medium text-foreground underline-offset-2 hover:underline">
          {t("legal.resourcesTitle")}.
        </Link>
      </p>
      <Button asChild variant="outline" size="sm">
        <Link to="/">{t("legal.backHome")}</Link>
      </Button>
    </div>
  );
}
