import { createFileRoute, Link } from "@tanstack/react-router";
import { Check, X } from "lucide-react";
import { useTranslation } from "react-i18next";
import { LanguageSwitcher } from "@/components/language-switcher";
import { SiteFooter } from "@/components/site-footer";
import { SomLogo } from "@/components/som-logo";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";

const DOES = ["ops", "copy", "ideas", "links", "web", "learning", "publish"] as const;
const DOES_NOT = [
  "replace",
  "feed",
  "insights",
  "train",
  "video",
  "autoPost",
  "viral",
  "guarantee",
] as const;
const FAQ = [
  "learn",
  "instagram",
  "web",
  "publish",
  "video",
  "insights",
  "voice",
  "quota",
] as const;

export const Route = createFileRoute("/recursos")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Recursos e limites — SOM" },
      {
        name: "description",
        content:
          "O que o SOM faz e o que não faz: operação da marca, IA de copy, limites do Instagram, publicação e FAQ.",
      },
    ],
  }),
  component: RecursosPage,
});

function RecursosPage() {
  const { t } = useTranslation();

  return (
    <div className="flex min-h-screen flex-col bg-white">
      <header className="border-b border-neutral-900/10 px-4 py-4 sm:px-6">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-4">
          <SomLogo size="sm" title={t("app.fullName")} className="h-14 sm:h-16" />
          <LanguageSwitcher />
        </div>
      </header>

      <main className="mx-auto w-full max-w-3xl flex-1 space-y-12 px-4 py-12 sm:px-6">
        <div className="space-y-3">
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
            {t("legal.resourcesTitle")}
          </h1>
          <p className="text-xs text-muted-foreground">{t("legal.resourcesUpdated")}</p>
          <p className="text-base leading-relaxed text-neutral-700">{t("legal.resourcesLead")}</p>
        </div>

        <div className="grid gap-6 sm:grid-cols-2">
          <section className="rounded-xl border border-neutral-900/10 bg-neutral-50/80 p-5">
            <h2 className="text-base font-semibold text-foreground">{t("legal.doesTitle")}</h2>
            <ul className="mt-4 space-y-4">
              {DOES.map((item) => (
                <li key={item} className="flex gap-2.5">
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-700" aria-hidden />
                  <div className="space-y-1">
                    <p className="text-sm font-medium text-foreground">
                      {t(`legal.does.${item}Title`)}
                    </p>
                    <p className="text-sm leading-relaxed text-muted-foreground">
                      {t(`legal.does.${item}Body`)}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          </section>

          <section className="rounded-xl border border-neutral-900/10 p-5">
            <h2 className="text-base font-semibold text-foreground">{t("legal.doesNotTitle")}</h2>
            <ul className="mt-4 space-y-4">
              {DOES_NOT.map((item) => (
                <li key={item} className="flex gap-2.5">
                  <X className="mt-0.5 h-4 w-4 shrink-0 text-neutral-500" aria-hidden />
                  <div className="space-y-1">
                    <p className="text-sm font-medium text-foreground">
                      {t(`legal.doesNot.${item}Title`)}
                    </p>
                    <p className="text-sm leading-relaxed text-muted-foreground">
                      {t(`legal.doesNot.${item}Body`)}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        </div>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold tracking-tight">{t("legal.contextTitle")}</h2>
          <p className="text-sm leading-relaxed text-muted-foreground">{t("legal.contextLead")}</p>
          <ol className="list-decimal space-y-2 pl-5 text-sm leading-relaxed text-muted-foreground">
            {(["briefing", "notes", "links", "repeat", "search"] as const).map((item) => (
              <li key={item}>{t(`legal.context.${item}`)}</li>
            ))}
          </ol>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold tracking-tight">{t("legal.faqTitle")}</h2>
          <Accordion type="single" collapsible className="w-full">
            {FAQ.map((item) => (
              <AccordionItem key={item} value={item}>
                <AccordionTrigger className="text-sm">
                  {t(`legal.faq.${item}Q`)}
                </AccordionTrigger>
                <AccordionContent className="text-sm leading-relaxed text-muted-foreground">
                  {t(`legal.faq.${item}A`)}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </section>

        <Button asChild variant="outline" size="sm">
          <Link to="/">{t("legal.backHome")}</Link>
        </Button>
      </main>

      <SiteFooter />
    </div>
  );
}
