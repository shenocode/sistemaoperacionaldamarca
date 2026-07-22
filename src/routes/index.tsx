import { createFileRoute, Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { LanguageSwitcher } from "@/components/language-switcher";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "SOM — Sistema Operacional da Marca" },
      {
        name: "description",
        content: "Aprovações de conteúdo e gestão de produção para marcas e clientes, em um só lugar.",
      },
      { property: "og:title", content: "SOM — Sistema Operacional da Marca" },
      {
        property: "og:description",
        content: "Aprovações de conteúdo e gestão de produção para marcas e clientes.",
      },
    ],
  }),
  component: Landing,
});

function Landing() {
  const { t } = useTranslation();
  const { session, loading } = useAuth();

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="flex items-center justify-between border-b px-6 py-4">
        <div className="flex items-baseline gap-2">
          <span className="text-lg font-semibold tracking-tight">{t("app.name")}</span>
          <span className="text-xs text-muted-foreground">{t("app.tagline")}</span>
        </div>
        <div className="flex items-center gap-3">
          <LanguageSwitcher />
          {!loading && (
            <Button asChild size="sm">
              <Link to={session ? "/dashboard" : "/auth"}>
                {session ? t("landing.goToApp") : t("landing.cta")}
              </Link>
            </Button>
          )}
        </div>
      </header>
      <main className="flex flex-1 items-center justify-center px-6">
        <div className="max-w-2xl text-center">
          <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">{t("landing.heroTitle")}</h1>
          <p className="mt-4 text-lg text-muted-foreground">{t("landing.heroSubtitle")}</p>
          <div className="mt-8">
            <Button asChild size="lg">
              <Link to={session ? "/dashboard" : "/auth"}>
                {session ? t("landing.goToApp") : t("landing.cta")}
              </Link>
            </Button>
          </div>
        </div>
      </main>
    </div>
  );
}
