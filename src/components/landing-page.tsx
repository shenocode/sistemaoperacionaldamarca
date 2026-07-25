import { Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  CalendarDays,
  Check,
  Clapperboard,
  Film,
  Image,
  Images,
  LayoutGrid,
  MessageSquareText,
  Palette,
  Share2,
  Sparkles,
  Wand2,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { LanguageSwitcher } from "@/components/language-switcher";
import { WhatsAppPhoneField } from "@/components/whatsapp-phone-field";
import {
  buildWhatsAppNotifyUrl,
  startSubscriptionCheckout,
  submitContactLead,
  type ContactLeadIntent,
  type ContactLeadNiche,
  type SubscriptionPlanKey,
} from "@/lib/api";
import { isValidWhatsAppLocal, splitWhatsAppDigits } from "@/lib/whatsapp-countries";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

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

const ASSET_KEYS = [
  "feed",
  "carousel",
  "reels",
  "stories",
  "video",
  "art",
] as const;

const ASSET_ICONS = {
  feed: Image,
  carousel: Images,
  reels: Clapperboard,
  stories: LayoutGrid,
  video: Film,
  art: Palette,
} as const;

const PLAN_KEYS = ["solo", "studio", "agency"] as const satisfies readonly SubscriptionPlanKey[];

/** Commercial contact for access / subscription requests. */
const CONTACT_WHATSAPP = "5511993397398";
const CONTACT_WHATSAPP_DISPLAY = "+55 11 99339-7398";
const COMPANY_URL = "https://solucyona.lovable.app/#inicio";
const COMPANY_NAME = "Solucyona Comunicação e Tecnologia";

function ProductMockup({
  status,
  caption,
  brandName,
}: {
  status: string;
  caption: string;
  brandName: string;
}) {
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
                {brandName}
              </p>
              <p className="max-w-[14ch] text-sm leading-snug text-teal-950/85">{caption}</p>
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

function ContactForm() {
  const { t, i18n } = useTranslation();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [niche, setNiche] = useState<ContactLeadNiche | "">("");
  const [intent, setIntent] = useState<ContactLeadIntent | "">("");
  const [submitting, setSubmitting] = useState(false);

  const nicheLabel = (value: ContactLeadNiche) => {
    if (value === "agency") return t("landing.contactNicheAgency");
    if (value === "social_media") return t("landing.contactNicheSocialMedia");
    return t("landing.contactNicheBrandOwner");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!niche) {
      toast.error(t("landing.contactNicheRequired"));
      return;
    }
    if (!intent) {
      toast.error(t("landing.contactIntentRequired"));
      return;
    }
    const { local } = splitWhatsAppDigits(whatsapp);
    if (!isValidWhatsAppLocal(local)) return;

    const trimmedName = name.trim();
    const trimmedEmail = email.trim();
    const fullWhatsapp = whatsapp.replace(/\D/g, "");
    const bodyKey =
      intent === "trial"
        ? "landing.contactWhatsAppBodyTrial"
        : "landing.contactWhatsAppBodyHuman";
    const body = t(bodyKey, {
      name: trimmedName,
      email: trimmedEmail,
      whatsapp: fullWhatsapp,
      niche: nicheLabel(niche),
    });
    const url = buildWhatsAppNotifyUrl(CONTACT_WHATSAPP, body);
    if (!url) return;

    setSubmitting(true);
    try {
      await submitContactLead({
        name: trimmedName,
        email: trimmedEmail,
        whatsapp: fullWhatsapp,
        intent,
        niche,
        locale: i18n.language,
      });
    } catch {
      toast.error(t("landing.contactLeadSaveFailed"));
    } finally {
      setSubmitting(false);
    }

    window.open(url, "_blank", "noopener,noreferrer");
  };

  return (
    <form onSubmit={handleSubmit} className="mx-auto mt-10 max-w-lg space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="contact-name">{t("landing.contactName")}</Label>
        <Input
          id="contact-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          className="bg-white/80"
          autoComplete="name"
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="contact-email">{t("landing.contactEmail")}</Label>
        <Input
          id="contact-email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          className="bg-white/80"
          autoComplete="email"
        />
      </div>
      <WhatsAppPhoneField
        idPrefix="contact"
        value={whatsapp}
        onChange={setWhatsapp}
        label={t("landing.contactWhatsapp")}
        countryLabel={t("landing.contactCountry")}
        hint={t("landing.contactWhatsappHint")}
        required
        inputClassName="bg-white/80"
      />
      <fieldset className="space-y-3">
        <legend className="text-sm font-medium leading-none">
          {t("landing.contactNicheLabel")}
        </legend>
        <RadioGroup
          value={niche}
          onValueChange={(value) => setNiche(value as ContactLeadNiche)}
          className="gap-3"
          required
        >
          {(
            [
              { value: "agency" as const, labelKey: "landing.contactNicheAgency" },
              { value: "social_media" as const, labelKey: "landing.contactNicheSocialMedia" },
              { value: "brand_owner" as const, labelKey: "landing.contactNicheBrandOwner" },
            ] as const
          ).map((option) => (
            <label
              key={option.value}
              htmlFor={`contact-niche-${option.value}`}
              className={cn(
                "flex cursor-pointer items-start gap-3 rounded-md border border-neutral-900/10 bg-white/80 px-3 py-3 text-sm transition-colors",
                niche === option.value && "border-neutral-900/40 bg-white",
              )}
            >
              <RadioGroupItem
                id={`contact-niche-${option.value}`}
                value={option.value}
                className="mt-0.5"
              />
              <span>{t(option.labelKey)}</span>
            </label>
          ))}
        </RadioGroup>
      </fieldset>
      <fieldset className="space-y-3">
        <legend className="text-sm font-medium leading-none">
          {t("landing.contactIntentLabel")}
        </legend>
        <RadioGroup
          value={intent}
          onValueChange={(value) => setIntent(value as ContactLeadIntent)}
          className="gap-3"
          required
        >
          {(
            [
              { value: "trial" as const, labelKey: "landing.contactIntentTrial" },
              { value: "human" as const, labelKey: "landing.contactIntentHuman" },
            ] as const
          ).map((option) => (
            <label
              key={option.value}
              htmlFor={`contact-intent-${option.value}`}
              className={cn(
                "flex cursor-pointer items-start gap-3 rounded-md border border-neutral-900/10 bg-white/80 px-3 py-3 text-sm transition-colors",
                intent === option.value && "border-neutral-900/40 bg-white",
              )}
            >
              <RadioGroupItem
                id={`contact-intent-${option.value}`}
                value={option.value}
                className="mt-0.5"
              />
              <span>{t(option.labelKey)}</span>
            </label>
          ))}
        </RadioGroup>
      </fieldset>
      <Button type="submit" size="lg" className="w-full sm:w-auto" disabled={submitting}>
        {t("landing.contactSubmit")}
      </Button>
    </form>
  );
}

export function LandingPage() {
  const { t } = useTranslation();
  const [checkoutPlan, setCheckoutPlan] = useState<SubscriptionPlanKey | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const hash = window.location.hash;
    if (hash !== "#contato" && hash !== "#planos") return;
    const id = hash.slice(1);
    requestAnimationFrame(() => {
      document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }, []);

  const handleSubscribe = async (plan: SubscriptionPlanKey) => {
    setCheckoutPlan(plan);
    try {
      await startSubscriptionCheckout(plan);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err));
      setCheckoutPlan(null);
    }
  };

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
          <a href="#ativos" className="transition-colors hover:text-neutral-900">
            {t("landing.navAssets")}
          </a>
          <a href="#como" className="transition-colors hover:text-neutral-900">
            {t("landing.navHow")}
          </a>
          <a href="#planos" className="transition-colors hover:text-neutral-900">
            {t("landing.navPricing")}
          </a>
          <a href="#contato" className="transition-colors hover:text-neutral-900">
            {t("landing.navContact")}
          </a>
        </nav>
        <div className="flex items-center gap-2 sm:gap-3">
          <LanguageSwitcher />
          <Button asChild variant="ghost" size="sm" className="hidden sm:inline-flex">
            <Link to="/auth" search={{}}>{t("landing.signIn")}</Link>
          </Button>
          <Button asChild size="sm">
            <a href="#contato">{t("landing.cta")}</a>
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
            <p className="landing-rise landing-rise-delay-1 mt-2 font-display text-base font-medium tracking-wide text-neutral-600 sm:text-lg">
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
                <a href="#contato">{t("landing.cta")}</a>
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
              brandName={t("app.name")}
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

        {/* Content assets */}
        <section id="ativos" className="border-y border-neutral-900/8 bg-white/50">
          <div className="mx-auto max-w-6xl px-6 py-16 sm:py-24">
            <h2 className="max-w-2xl font-display text-3xl font-semibold tracking-tight sm:text-4xl">
              {t("landing.assetsTitle")}
            </h2>
            <p className="mt-3 max-w-2xl text-base text-neutral-600">
              {t("landing.assetsSubtitle")}
            </p>
            <ul className="mt-10 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {ASSET_KEYS.map((key) => {
                const Icon = ASSET_ICONS[key];
                return (
                  <li
                    key={key}
                    className="flex gap-3 rounded-xl border border-neutral-200/80 bg-white/70 p-3.5"
                  >
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                      <Icon className="h-4 w-4 text-primary" strokeWidth={1.75} aria-hidden />
                    </div>
                    <div className="min-w-0">
                      <h3 className="font-display text-sm font-semibold tracking-tight">
                        {t(`landing.assets.${key}.title`)}
                      </h3>
                      <p className="mt-1 text-xs leading-relaxed text-neutral-600 sm:text-sm">
                        {t(`landing.assets.${key}.body`)}
                      </p>
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
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
                        popular ? "text-primary-foreground/90" : "text-neutral-600",
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
                    className={cn(
                      "mt-8 w-full",
                      popular
                        ? "bg-white text-teal-900 hover:bg-white/90"
                        : undefined,
                    )}
                    variant={popular ? "secondary" : "default"}
                    disabled={checkoutPlan !== null}
                    onClick={() => handleSubscribe(plan)}
                  >
                    {checkoutPlan === plan
                      ? t("landing.pricingCtaLoading")
                      : t("landing.pricingCta")}
                  </Button>
                </article>
              );
            })}
          </div>
          <p className="mt-6 text-center text-xs text-neutral-600">{t("landing.pricingNote")}</p>
        </section>

        {/* Contact */}
        <section id="contato" className="border-y border-neutral-900/8 bg-white/50">
          <div className="mx-auto max-w-3xl px-6 py-16 sm:py-24">
            <h2 className="text-center font-display text-3xl font-semibold tracking-tight sm:text-4xl">
              {t("landing.contactTitle")}
            </h2>
            <p className="mx-auto mt-3 max-w-xl text-center text-base text-neutral-600">
              {t("landing.contactSubtitle")}
            </p>
            <ContactForm />
          </div>
        </section>

        {/* Final CTA */}
        <section className="border-t border-neutral-900/8 bg-neutral-900 text-white">
          <div className="mx-auto flex max-w-6xl flex-col items-start gap-6 px-6 py-16 sm:flex-row sm:items-center sm:justify-between sm:py-20">
            <div className="max-w-xl">
              <h2 className="font-display text-3xl font-semibold tracking-tight sm:text-4xl">
                {t("landing.finalTitle")}
              </h2>
              <p className="mt-3 text-base text-white/90">{t("landing.finalSubtitle")}</p>
            </div>
            <Button
              asChild
              size="lg"
              className="bg-primary text-primary-foreground hover:bg-primary/90"
            >
              <a href="#planos">{t("landing.finalCta")}</a>
            </Button>
          </div>
        </section>
      </main>

      <footer className="border-t border-neutral-900/8 bg-white/60 px-6 py-8">
        <div className="mx-auto flex max-w-6xl flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="font-display text-lg font-semibold">{t("app.name")}</p>
            <p className="text-sm text-neutral-600">{t("landing.footerTag")}</p>
          </div>
          <div className="flex flex-col gap-1 text-sm text-neutral-600 sm:items-end sm:text-right">
            <a
              href={COMPANY_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium text-neutral-800 underline-offset-4 hover:underline"
            >
              {COMPANY_NAME}
            </a>
            <a
              href={`https://wa.me/${CONTACT_WHATSAPP}`}
              target="_blank"
              rel="noopener noreferrer"
              className="underline-offset-4 hover:underline"
            >
              {t("landing.footerWhatsapp", { number: CONTACT_WHATSAPP_DISPLAY })}
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
