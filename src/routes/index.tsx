import { createFileRoute, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { LandingPage } from "@/components/landing-page";
import { resolvePostLoginPath } from "@/lib/api";

const FONT_STYLESHEET =
  "https://fonts.googleapis.com/css2?family=Figtree:ital,wght@0,400..700;1,400..700&family=Syne:wght@500;600;700&display=swap";

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
        content:
          "Do briefing à aprovação: produção de conteúdo, calendário editorial e aprovações com clientes — em um só lugar.",
      },
      { property: "og:title", content: "SOM — Sistema Operacional da Marca" },
      {
        property: "og:description",
        content:
          "O sistema operacional para gestores de conteúdo que produzem, alinham e aprovam posts com clientes.",
      },
    ],
    links: [
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      { rel: "stylesheet", href: FONT_STYLESHEET },
    ],
  }),
  component: LandingPage,
});
