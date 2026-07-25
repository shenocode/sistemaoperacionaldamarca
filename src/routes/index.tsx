import { createFileRoute } from "@tanstack/react-router";
import { LandingPage } from "@/components/landing-page";

const FONT_STYLESHEET =
  "https://fonts.googleapis.com/css2?family=Figtree:ital,wght@0,400..700;1,400..700&family=Syne:wght@500;600;700&display=swap";

export const Route = createFileRoute("/")({
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
