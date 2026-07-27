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
      { rel: "preload", as: "style", href: FONT_STYLESHEET },
      { rel: "stylesheet", href: FONT_STYLESHEET },
      { rel: "canonical", href: "https://som-sistemaoperacionaldamarca.netlify.app/" },
    ],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@graph": [
            {
              "@type": "Organization",
              name: "SOM — Sistema Operacional da Marca",
              url: "https://som-sistemaoperacionaldamarca.netlify.app/",
              logo: "https://som-sistemaoperacionaldamarca.netlify.app/favicon.ico",
            },
            {
              "@type": "WebSite",
              name: "SOM — Sistema Operacional da Marca",
              url: "https://som-sistemaoperacionaldamarca.netlify.app/",
              inLanguage: "pt-BR",
              description:
                "Do briefing à aprovação: produção de conteúdo, calendário editorial e aprovações com clientes — em um só lugar.",
            },
          ],
        }),
      },
    ],
  }),
  component: LandingPage,
});
