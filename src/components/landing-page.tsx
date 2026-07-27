import { Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
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
  UserRound,
  Wand2,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/hooks/use-auth";
import { PhoneChrome } from "@/components/content-media-preview";
import {
  contentFormatRowStyles,
  contentFormatStyles,
} from "@/components/content-format-styles";
import {
  contentStatusStyles,
  type ContentStatus,
} from "@/components/status-badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { LanguageSwitcher } from "@/components/language-switcher";
import { SiteFooter } from "@/components/site-footer";
import { WhatsAppPhoneField } from "@/components/whatsapp-phone-field";
import {
  buildWhatsAppNotifyUrl,
  startSubscriptionCheckout,
  submitContactLead,
  type ContactLeadIntent,
  type ContactLeadNiche,
  type ContentFormat,
  type SubscriptionPlanKey,
} from "@/lib/api";
import { CONTACT_WHATSAPP } from "@/lib/company";
import { isValidWhatsAppLocal, splitWhatsAppDigits } from "@/lib/whatsapp-countries";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

function getAuthDisplayName(user: User): string {
  const meta = user.user_metadata ?? {};
  const full =
    (typeof meta.full_name === "string" && meta.full_name.trim()) ||
    (typeof meta.name === "string" && meta.name.trim()) ||
    "";
  if (full) return full.split(/\s+/)[0] ?? full;
  return user.email?.split("@")[0] ?? "";
}

function getAuthInitials(user: User): string {
  const meta = user.user_metadata ?? {};
  const full =
    (typeof meta.full_name === "string" && meta.full_name.trim()) ||
    (typeof meta.name === "string" && meta.name.trim()) ||
    "";
  if (full) {
    const parts = full.split(/\s+/).filter(Boolean);
    if (parts.length >= 2) {
      return `${parts[0]![0]!}${parts[1]![0]!}`.toUpperCase();
    }
    return full.slice(0, 2).toUpperCase();
  }
  return (user.email?.[0] ?? "?").toUpperCase();
}

function getAuthAvatarUrl(user: User): string | null {
  const meta = user.user_metadata ?? {};
  const url = meta.avatar_url ?? meta.picture;
  return typeof url === "string" && url.trim() ? url : null;
}

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

const MOCK_FORMAT_CHIPS = [
  "static_feed",
  "carousel",
  "reels",
  "stories",
] as const satisfies readonly ContentFormat[];

const MOCK_CALENDAR_POSTS = [
  { key: "campaign", format: "static_feed", status: "review" },
  { key: "reelsHook", format: "reels", status: "approved" },
  { key: "carouselTips", format: "carousel", status: "draft" },
  { key: "storiesPromo", format: "stories", status: "changes" },
  { key: "feedQuote", format: "static_feed", status: "published" },
  { key: "reelsBts", format: "reels", status: "waiting_material" },
  { key: "carouselLaunch", format: "carousel", status: "review" },
  { key: "storiesPoll", format: "stories", status: "draft" },
] as const satisfies readonly {
  key: string;
  format: ContentFormat;
  status: ContentStatus;
}[];

function CalendarMockList({ idPrefix }: { idPrefix: string }) {
  const { t } = useTranslation();

  return (
    <div className="space-y-2.5 px-2.5 pb-4 pt-2">
      <div className="rounded-xl border border-neutral-200 bg-white px-3 py-2.5 shadow-sm">
        <p className="text-[11px] font-semibold text-neutral-900">
          {t("landing.mockCalendar.blockTitle")}
        </p>
        <p className="mt-0.5 text-[10px] text-neutral-500">
          {t("landing.mockCalendar.blockHint", {
            count: MOCK_CALENDAR_POSTS.length,
          })}
        </p>
      </div>

      {MOCK_CALENDAR_POSTS.map((post, index) => (
        <div
          key={`${idPrefix}-${post.key}`}
          className={cn(
            contentFormatRowStyles[post.format],
            "space-y-2 rounded-lg border border-black/6 p-2.5",
          )}
        >
          <div className="flex items-start gap-2">
            <span className="mt-0.5 text-[10px] text-neutral-400">{index + 1}</span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[11px] font-semibold text-neutral-900">
                {t(`landing.mockCalendar.posts.${post.key}.title`)}
              </p>
              <p className="mt-0.5 text-[10px] capitalize text-neutral-500">
                {t(`landing.mockCalendar.posts.${post.key}.day`)}
              </p>
            </div>
          </div>

          <div className="grid gap-1.5">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[9px] uppercase tracking-wide text-neutral-400">
                {t("project.calendar.columns.datetime")}
              </span>
              <span className="rounded-md border border-neutral-200 bg-white px-2 py-0.5 text-[10px] text-neutral-700">
                {t(`landing.mockCalendar.posts.${post.key}.datetime`)}
              </span>
            </div>
            <div className="flex items-center justify-between gap-2">
              <span className="text-[9px] uppercase tracking-wide text-neutral-400">
                {t("project.calendar.columns.status")}
              </span>
              <span
                className={cn(
                  "inline-flex max-w-[60%] truncate rounded-md border px-2 py-0.5 text-[9px] font-medium",
                  contentStatusStyles[post.status],
                )}
              >
                {t(`project.content.status.${post.status}`)}
              </span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              <span
                className={cn(
                  "rounded-md border px-1.5 py-0.5 text-[9px] font-medium",
                  contentFormatStyles[post.format],
                )}
              >
                {t(`project.detail.formats.${post.format}`)}
              </span>
              <span className="rounded-md border border-neutral-200 bg-white px-1.5 py-0.5 text-[9px] text-neutral-600">
                {t(`landing.mockCalendar.posts.${post.key}.theme`)}
              </span>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function ProductMockup() {
  const { t } = useTranslation();

  return (
    <div className="landing-float relative mx-auto w-full max-w-[320px]">
      <div
        className="absolute -inset-8 landing-drift rounded-[40%] bg-primary/15 blur-3xl"
        aria-hidden
      />
      <PhoneChrome className="relative">
        <div className="flex flex-col bg-neutral-50">
          <div className="shrink-0 border-b border-neutral-200 bg-white px-3 pb-2.5 pt-1">
            <p className="text-[13px] font-semibold text-neutral-900">
              {t("project.calendar.title")}
            </p>
            <div className="mt-2 flex flex-wrap gap-1">
              {MOCK_FORMAT_CHIPS.map((format) => (
                <span
                  key={format}
                  className={cn(
                    "rounded-md border px-1.5 py-0.5 text-[9px] font-medium",
                    contentFormatStyles[format],
                  )}
                >
                  {t(`project.detail.formats.${format}`)}
                </span>
              ))}
            </div>
          </div>

          <div className="landing-phone-scroll-viewport" aria-hidden>
            <div className="landing-phone-scroll-track">
              <CalendarMockList idPrefix="a" />
              <CalendarMockList idPrefix="b" />
            </div>
          </div>
        </div>
      </PhoneChrome>
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
  const { user, loading: authLoading } = useAuth();
  const [checkoutPlan, setCheckoutPlan] = useState<SubscriptionPlanKey | null>(null);
  const displayName = user ? getAuthDisplayName(user) : "";
  const avatarUrl = user ? getAuthAvatarUrl(user) : null;
  const initials = user ? getAuthInitials(user) : "";


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
          {authLoading ? (
            <span className="inline-block h-8 w-8 sm:w-20" aria-hidden />
          ) : user ? (
            <Button asChild variant="ghost" size="sm" className="gap-2 px-1.5 sm:px-2">
              <Link
                to="/home"
                aria-label={t("landing.goToApp")}
                title={t("landing.goToApp")}
              >
                <Avatar className="h-7 w-7 border border-neutral-200 bg-white">
                  {avatarUrl ? <AvatarImage src={avatarUrl} alt="" /> : null}
                  <AvatarFallback className="bg-primary/10 text-[11px] font-semibold text-primary">
                    {initials || <UserRound className="h-3.5 w-3.5" />}
                  </AvatarFallback>
                </Avatar>
                {displayName ? (
                  <span className="hidden max-w-[7rem] truncate sm:inline">{displayName}</span>
                ) : null}
              </Link>
            </Button>
          ) : (
            <Button asChild variant="ghost" size="sm" className="inline-flex px-2 sm:px-3">
              <Link to="/auth" search={{}}>{t("landing.signIn")}</Link>
            </Button>
          )}
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
            <ProductMockup />
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

      <SiteFooter />
    </div>
  );
}
