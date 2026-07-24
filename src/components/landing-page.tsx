import { Link } from "@tanstack/react-router";
import {
  CalendarDays,
  Check,
  MessageSquareText,
  Palette,
  Share2,
  Sparkles,
  Wand2,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { LanguageSwitcher } from "@/components/language-switcher";
import { cn } from "@/lib/utils";

const FEATURE_KEYS = [
  "calendar",
  "approval",
  "aiCopy",
  "aiDesign",
  "briefing",
  "share",
] as const;

const FEATURE_ICONS = {
  calendar: CalendarDays,
  approval: MessageSquareText,
  aiCopy: Sparkles,
  aiDesign: Palette,
  briefing: Wand2,
  share: Share2,
} as const;

const PLAN_KEYS = ["solo", "studio", "agency"] as const;

function ProductMockup({ status, caption }: { status: string; caption: string }) {
  return (
    <div className="landing-float relative mx-auto w-full max-w-md">
      <div className="absolute -inset-8 landing-drift rounded-[40%] bg-primary/15 blur-3xl" aria-hidden />
      <div className="relative grid gap-4 sm:grid-cols-[1fr_0.85fr] sm:items-end">
        <div className="rounded-[1.75rem] border border-black/8 bg-white p-3 shadow-[0_24px_60px_-28px_oklch(0.35_0.04_220/0.45)]">
          <div className="mb-3 flex items-center justify-between px-1">
            <span className="font-display text-xs font-semibold tracking-wide text-neutral-800">
              @marca.demo
            </span>
            <span className="rounded-md bg-amber-100 px-2 py-0.5 text-[10px] font-medium text-amber-900">
              {status}
            </span>
          </div>
          <div className="aspect-square overflow-hidden rounded-2xl bg-gradient-to-br from-teal-200 via-sky-100 to-emerald-100">
            <div className="flex h-full flex-col justify-between p-5">
              <p className="font-display text-2xl font-semibold leading-tight text-teal-950/90">
                SOM
              </p>
              <p className="max-w-[14ch] text-sm leading-snug text-teal-950/70">{caption}</p>
            </div>
          </div>
          <p className="mt-3 line-clamp-2 px-1 text-xs leading-relaxed text-neutral-600">
            {caption}
          </p>
        </div>
        <div className="space-y-2 rounded-2xl border border-black/8 bg-white/90 p-3 backdrop-blur-sm">
          {["Seg", "Qua", "Sex"].map((day, i) => (
            <div
              key={day}
              className={cn(
                "flex items-center gap-3 rounded-xl px-3 py-2.5 text-xs",
                i === 1 ? "bg-primary/15 text-teal-950" : "bg-neutral-50 text-neutral-700",
              )}
            >
              <span className="w-8 font-medium">{day}</span>
              <span className="h-1.5 flex-1 rounded-full bg-current/20" />
              <span className="font-medium opacity-80">{i === 1 ? "Reels" : "Feed"}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function LandingPage() {
  const { t } = useTranslation();

  return (
    <div className="theme-mint landing-atmosphere relative min-h-screen overflow-x-hidden">
      <div className="landing-grid pointer-events-none absolute inset-x-0 top-0 h-[70vh]" aria-hidden />

      <header className="relative z-20 mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
        <a href="#topo" className="font-display text-2xl font-semibold tracking-tight">
          {t("app.name")}
        </a>
        <nav className="hidden items-center gap-7 text-sm text-neutral-600 md:flex">
          <a href="#produto" className="transition-colors hover:text-neutral-900">
            {t("landing.navFeatures")}
          </a>
          <a href="#como" className="transition-colors hover:text-neutral-900">
            {t("landing.navHow")}
          </a>
          <a href="#planos" className="transition-colors hover:text-neutral-900">
            {t("landing.navPricing")}
          </a>
        </nav>
        <div className="flex items-center gap-2 sm:gap-3">
          <LanguageSwitcher />
          <Button asChild variant="ghost" size="sm" className="hidden sm:inline-flex">
            <Link to="/auth" search={{}}>{t("landing.signIn")}</Link>
          </Button>
          <Button asChild size="sm">
            <Link to="/auth" search={{}}>{t("landing.cta")}</Link>
          </Button>
        </div>
      </header>

      <main id="topo">
        {/* Hero — one composition */}
        <section className="relative mx-auto grid max-w-6xl gap-12 px-6 pb-20 pt-10 lg:grid-cols-[1.05fr_0.95fr] lg:items-center lg:gap-8 lg:pb-28 lg:pt-16">
          <div>
            <p className="landing-rise font-display text-5xl font-semibold tracking-tight text-neutral-900 sm:text-6xl lg:text-7xl">
              {t("app.name")}
            </p>
            <p className="landing-rise landing-rise-delay-1 mt-2 font-display text-base font-medium tracking-wide text-neutral-500 sm:text-lg">
              {t("app.tagline")}
            </p>
            <h1 className="landing-rise landing-rise-delay-2 mt-5 max-w-xl font-display text-2xl font-medium leading-snug tracking-tight text-neutral-800 sm:text-3xl">
              {t("landing.heroTitle")}
            </h1>
            <p className="landing-rise landing-rise-delay-2 mt-4 max-w-lg text-base leading-relaxed text-neutral-600 sm:text-lg">
              {t("landing.heroSubtitle")}
            </p>
            <div className="landing-rise landing-rise-delay-3 mt-8 flex flex-wrap items-center gap-3">
              <Button asChild size="lg" className="px-7">
                <Link to="/auth" search={{}}>{t("landing.cta")}</Link>
              </Button>
              <Button asChild size="lg" variant="outline" className="border-neutral-300 bg-white/60 backdrop-blur-sm">
                <a href="#planos">{t("landing.ctaSecondary")}</a>
              </Button>
            </div>
          </div>
          <div className="landing-rise landing-rise-delay-2">
            <ProductMockup
              status={t("landing.mockStatus")}
              caption={t("landing.mockCaption")}
            />
          </div>
        </section>

        {/* Problem */}
        <section className="border-y border-neutral-900/8 bg-white/50">
          <div className="mx-auto max-w-3xl px-6 py-16 text-center sm:py-20">
            <h2 className="font-display text-3xl font-semibold tracking-tight sm:text-4xl">
              {t("landing.problemTitle")}
            </h2>
            <p className="mt-4 text-base leading-relaxed text-neutral-600 sm:text-lg">
              {t("landing.problemBody")}
            </p>
          </div>
        </section>

        {/* How it works */}
        <section id="como" className="mx-auto max-w-6xl px-6 py-16 sm:py-24">
          <h2 className="max-w-xl font-display text-3xl font-semibold tracking-tight sm:text-4xl">
            {t("landing.howTitle")}
          </h2>
          <ol className="mt-12 grid gap-10 sm:grid-cols-3 sm:gap-8">
            {(["1", "2", "3"] as const).map((step) => (
              <li key={step} className="relative">
                <span className="font-display text-5xl font-semibold text-primary/35">{step}</span>
                <h3 className="mt-2 font-display text-xl font-semibold tracking-tight">
                  {t(`landing.howSteps.${step}.title`)}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-neutral-600 sm:text-base">
                  {t(`landing.howSteps.${step}.body`)}
                </p>
              </li>
            ))}
          </ol>
        </section>

        {/* Features */}
        <section id="produto" className="border-y border-neutral-900/8 bg-white/40">
          <div className="mx-auto max-w-6xl px-6 py-16 sm:py-24">
            <h2 className="max-w-xl font-display text-3xl font-semibold tracking-tight sm:text-4xl">
              {t("landing.featuresTitle")}
            </h2>
            <p className="mt-3 max-w-2xl text-base text-neutral-600">
              {t("landing.featuresSubtitle")}
            </p>
            <ul className="mt-12 grid gap-x-10 gap-y-12 sm:grid-cols-2 lg:grid-cols-3">
              {FEATURE_KEYS.map((key) => {
                const Icon = FEATURE_ICONS[key];
                return (
                  <li key={key}>
                    <Icon className="mb-3 h-5 w-5 text-primary" strokeWidth={1.75} aria-hidden />
                    <h3 className="font-display text-lg font-semibold tracking-tight">
                      {t(`landing.features.${key}.title`)}
                    </h3>
                    <p className="mt-2 text-sm leading-relaxed text-neutral-600">
                      {t(`landing.features.${key}.body`)}
                    </p>
                  </li>
                );
              })}
            </ul>
          </div>
        </section>

        {/* Pricing — cards only for plan selection */}
        <section id="planos" className="mx-auto max-w-6xl px-6 py-16 sm:py-24">
          <div className="max-w-2xl">
            <h2 className="font-display text-3xl font-semibold tracking-tight sm:text-4xl">
              {t("landing.pricingTitle")}
            </h2>
            <p className="mt-3 text-base text-neutral-600">{t("landing.pricingSubtitle")}</p>
          </div>

          <div className="mt-12 grid gap-5 lg:grid-cols-3">
            {PLAN_KEYS.map((plan) => {
              const popular = plan === "studio";
              const features = t(`landing.plans.${plan}.features`, {
                returnObjects: true,
              }) as string[];

              return (
                <article
                  key={plan}
                  className={cn(
                    "flex flex-col rounded-2xl border p-6 transition-colors",
                    popular
                      ? "border-primary bg-primary text-primary-foreground shadow-[0_20px_50px_-24px_oklch(0.45_0.08_175/0.55)]"
                      : "border-neutral-200 bg-white/80",
                  )}
                >
                  <div className="flex items-baseline justify-between gap-2">
                    <h3 className="font-display text-xl font-semibold">
                      {t(`landing.plans.${plan}.name`)}
                    </h3>
                    {popular ? (
                      <span className="rounded-md bg-white/20 px-2 py-0.5 text-[11px] font-medium">
                        {t("landing.pricingPopular")}
                      </span>
                    ) : null}
                  </div>
                  <p
                    className={cn(
                      "mt-2 text-sm leading-relaxed",
                      popular ? "text-primary-foreground/80" : "text-neutral-600",
                    )}
                  >
                    {t(`landing.plans.${plan}.desc`)}
                  </p>
                  <p className="mt-6 font-display text-4xl font-semibold tracking-tight">
                    <span className="text-lg font-medium">R$</span>{" "}
                    {t(`landing.plans.${plan}.price`)}
                    <span
                      className={cn(
                        "ml-1 text-sm font-normal",
                        popular ? "text-primary-foreground/75" : "text-neutral-500",
                      )}
                    >
                      {t("landing.pricingPeriod")}
                    </span>
                  </p>
                  <ul className="mt-6 flex-1 space-y-2.5">
                    {features.map((item) => (
                      <li key={item} className="flex gap-2 text-sm leading-snug">
                        <Check
                          className={cn(
                            "mt-0.5 h-4 w-4 shrink-0",
                            popular ? "text-primary-foreground" : "text-primary",
                          )}
                          strokeWidth={2}
                          aria-hidden
                        />
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                  <Button
                    asChild
                    className={cn(
                      "mt-8 w-full",
                      popular
                        ? "bg-white text-teal-900 hover:bg-white/90"
                        : undefined,
                    )}
                    variant={popular ? "secondary" : "default"}
                  >
                    <Link to="/auth" search={{}}>{t("landing.pricingCta")}</Link>
                  </Button>
                </article>
              );
            })}
          </div>
          <p className="mt-6 text-center text-xs text-neutral-500">{t("landing.pricingNote")}</p>
        </section>

        {/* Final CTA */}
        <section className="border-t border-neutral-900/8 bg-neutral-900 text-white">
          <div className="mx-auto flex max-w-6xl flex-col items-start gap-6 px-6 py-16 sm:flex-row sm:items-center sm:justify-between sm:py-20">
            <div className="max-w-xl">
              <h2 className="font-display text-3xl font-semibold tracking-tight sm:text-4xl">
                {t("landing.finalTitle")}
              </h2>
              <p className="mt-3 text-base text-white/70">{t("landing.finalSubtitle")}</p>
            </div>
            <Button
              asChild
              size="lg"
              className="bg-primary text-primary-foreground hover:bg-primary/90"
            >
              <Link to="/auth" search={{}}>{t("landing.finalCta")}</Link>
            </Button>
          </div>
        </section>
      </main>

      <footer className="border-t border-neutral-900/8 bg-white/60 px-6 py-8">
        <div className="mx-auto flex max-w-6xl flex-col gap-2 sm:flex-row sm:items-baseline sm:justify-between">
          <p className="font-display text-lg font-semibold">{t("app.name")}</p>
          <p className="text-sm text-neutral-500">{t("landing.footerTag")}</p>
        </div>
      </footer>
    </div>
  );
}
