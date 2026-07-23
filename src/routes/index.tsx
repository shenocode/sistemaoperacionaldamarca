import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { LanguageSwitcher } from "@/components/language-switcher";
import { resolvePostLoginPath } from "@/lib/api";

export const Route = createFileRoute("/")({
  beforeLoad: async () => {
    const { data } = await supabase.auth.getSession();
    if (data.session) {
      const dest = await resolvePostLoginPath();
      if (dest.to === "/clients/$clientId/projects/$projectId/content") {
        throw redirect({ to: dest.to, params: dest.params, search: dest.search });
      }
      throw redirect({ to: dest.to });
    }
  },
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
        content: "Aprovações de conteúdo e gestão de produção para marcas e clientes, em um só lugar.",
      },
    ],
  }),
  component: Landing,
});

function Landing() {
  const { t } = useTranslation();

  return (
    <div className="theme-mint flex min-h-screen flex-col bg-background">
      <header className="flex items-center justify-between border-b px-6 py-4">
        <div className="flex items-baseline gap-2">
          <span className="text-lg font-semibold tracking-tight">{t("app.name")}</span>
          <span className="text-xs text-muted-foreground">{t("app.tagline")}</span>
        </div>
        <div className="flex items-center gap-3">
          <LanguageSwitcher />
          <Button asChild size="sm">
            <Link to="/auth" search={{}}>{t("landing.cta")}</Link>
          </Button>
        </div>
      </header>
      <main className="flex flex-1 items-center justify-center px-6">
        <div className="max-w-2xl text-center">
          <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">{t("landing.heroTitle")}</h1>
          <p className="mt-4 text-lg text-muted-foreground">{t("landing.heroSubtitle")}</p>
          <div className="mt-8">
            <Button asChild size="lg">
              <Link to="/auth" search={{}}>{t("landing.cta")}</Link>
            </Button>
          </div>
        </div>
      </main>
    </div>
  );
}
