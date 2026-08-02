import { Link } from "@tanstack/react-router";
import { useEffect, useRef, useState, type RefObject } from "react";
import type { User } from "@supabase/supabase-js";
import {
  CalendarDays,
  Check,
  ChevronLeft,
  Clapperboard,
  Film,
  History,
  Image,
  Images,
  LayoutGrid,
  MessageSquareText,
  Palette,
  Play,
  Save,
  Share2,
  Sparkles,
  SquareStack,
  UserRound,
  Wand2,
  X,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/hooks/use-auth";
import { PhoneChrome } from "@/components/content-media-preview";
import {
  contentFormatRowStyles,
  contentFormatStyles,
} from "@/components/content-format-styles";
import { CONTENT_STATUSES } from "@/components/content-status-select";
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
import { SomLogo, SomMark } from "@/components/som-logo";
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

const MARINA_ASSETS = {
  logo: "/landing/marina/logo.png",
  handle: "marinamazon",
  post: "/landing/marina/post-awareness.jpg",
  tiles: [
    "/landing/marina/tile-01-atendimento.jpg",
    "/landing/marina/tile-02-paixoes.jpg",
    "/landing/marina/tile-03-quem-e.jpg",
    "/landing/marina/tile-04-amadurecer.jpg",
    "/landing/marina/tile-05-jung.jpg",
    "/landing/marina/tile-06-solidao.jpg",
    "/landing/marina/tile-07-depoimento.jpg",
    "/landing/marina/tile-08-neuro.jpg",
  ],
} as const;

const MOCK_FEED_TILES = [
  {
    key: "campaign",
    format: "static_feed" as const,
    image: MARINA_ASSETS.post,
    tapTarget: true,
  },
  {
    key: "reelsHook",
    format: "reels" as const,
    image: MARINA_ASSETS.tiles[0],
    tapTarget: false,
  },
  {
    key: "carouselTips",
    format: "carousel" as const,
    image: MARINA_ASSETS.tiles[1],
    tapTarget: false,
  },
  {
    key: "storiesPromo",
    format: "stories" as const,
    image: MARINA_ASSETS.tiles[2],
    tapTarget: false,
  },
  {
    key: "feedQuote",
    format: "static_feed" as const,
    image: MARINA_ASSETS.tiles[3],
    tapTarget: false,
  },
  {
    key: "reelsBts",
    format: "reels" as const,
    image: MARINA_ASSETS.tiles[4],
    tapTarget: false,
  },
  {
    key: "carouselLaunch",
    format: "carousel" as const,
    image: MARINA_ASSETS.tiles[5],
    tapTarget: false,
  },
  {
    key: "storiesPoll",
    format: "stories" as const,
    image: MARINA_ASSETS.tiles[6],
    tapTarget: false,
  },
  {
    key: "campaignAlt",
    format: "static_feed" as const,
    image: MARINA_ASSETS.tiles[7],
    tapTarget: false,
  },
] as const;

const DETAIL_POST = MOCK_CALENDAR_POSTS[0];

type MockScene = "detail" | "calendar" | "feed";

const TIMING = {
  detailHoldTopMs: 1400,
  detailScrollMs: 6000,
  statusPauseMs: 500,
  statusTapMs: 1100,
  approvedHoldMs: 2400,
  calendarScrollMs: 5500,
  feedPauseMs: 400,
  tapMs: 1000,
  detailEnterMs: 400,
} as const;

function prefersReducedMotion() {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function wait(ms: number, signal: { cancelled: boolean }) {
  return new Promise<void>((resolve) => {
    if (signal.cancelled || ms <= 0) {
      resolve();
      return;
    }
    const start = performance.now();
    const tick = (now: number) => {
      if (signal.cancelled || now - start >= ms) {
        resolve();
        return;
      }
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
}

function animateScrollTop(
  el: HTMLElement,
  to: number,
  durationMs: number,
  signal: { cancelled: boolean },
) {
  return new Promise<void>((resolve) => {
    const from = el.scrollTop;
    const delta = to - from;
    if (durationMs <= 0 || Math.abs(delta) < 1) {
      el.scrollTop = to;
      resolve();
      return;
    }
    const start = performance.now();
    const step = (now: number) => {
      if (signal.cancelled) {
        resolve();
        return;
      }
      const t = Math.min(1, (now - start) / durationMs);
      const eased = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
      el.scrollTop = from + delta * eased;
      if (t < 1) {
        requestAnimationFrame(step);
      } else {
        resolve();
      }
    };
    requestAnimationFrame(step);
  });
}

function CalendarMockList() {
  const { t } = useTranslation();

  return (
    <div className="space-y-2.5 px-2.5 pb-3 pt-2">
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
          key={post.key}
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

function FeedMockSection({
  sectionRef,
  tapping,
}: {
  sectionRef: RefObject<HTMLDivElement | null>;
  tapping: boolean;
}) {
  const { t } = useTranslation();

  return (
    <div ref={sectionRef} className="bg-white pb-4 pt-3">
      <p className="mb-2 px-3 text-center text-[10px] font-medium text-neutral-500">
        {t("landing.mockFeed.title")}
      </p>
      <div className="overflow-hidden border-y border-neutral-200">
        <div className="flex items-center justify-center border-b border-neutral-100 px-3 py-1.5">
          <p className="text-[11px] font-semibold text-neutral-900">
            @{MARINA_ASSETS.handle}
          </p>
        </div>
        <div className="grid grid-cols-3 gap-px bg-neutral-200">
          {MOCK_FEED_TILES.map((tile) => (
            <div
              key={tile.key}
              className={cn(
                "relative aspect-square overflow-hidden bg-neutral-100",
                tile.tapTarget && tapping && "landing-mock-tap",
              )}
            >
              <img
                src={tile.image}
                alt=""
                className="h-full w-full object-cover"
                draggable={false}
              />
              {tile.format === "carousel" ? (
                <SquareStack className="absolute right-1 top-1 h-3 w-3 text-white drop-shadow" />
              ) : null}
              {tile.format === "reels" ? (
                <Play className="absolute right-1 top-1 h-3 w-3 fill-white text-white drop-shadow" />
              ) : null}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function DetailMockScreen({
  statusSectionRef,
  approvedButtonRef,
  currentStatus,
  tappingApproved,
}: {
  statusSectionRef: RefObject<HTMLDivElement | null>;
  approvedButtonRef: RefObject<HTMLButtonElement | null>;
  currentStatus: ContentStatus;
  tappingApproved: boolean;
}) {
  const { t } = useTranslation();
  const post = DETAIL_POST!;

  return (
    <div className="space-y-3 px-2.5 pb-6 pt-2">
      <div className="rounded-xl border border-neutral-200 bg-white p-2.5 shadow-sm">
        <p className="mb-2 text-[11px] font-semibold text-neutral-900">
          {t("project.detail.preview")}
        </p>
        <div className="overflow-hidden rounded-xl border border-neutral-200 bg-white">
          <div className="flex items-center gap-2 border-b border-neutral-100 px-2.5 py-2">
            <div className="h-6 w-6 shrink-0 overflow-hidden rounded-full bg-[#710000]">
              <img
                src={MARINA_ASSETS.logo}
                alt=""
                className="h-full w-full scale-110 object-cover"
                draggable={false}
              />
            </div>
            <div className="min-w-0">
              <p className="truncate text-[10px] font-semibold text-neutral-900">
                @{MARINA_ASSETS.handle}
              </p>
              <p className="text-[8px] text-neutral-500">
                {t(`project.detail.formats.${post.format}`)}
              </p>
            </div>
          </div>
          <div className="relative aspect-square overflow-hidden bg-neutral-100">
            <img
              src={MARINA_ASSETS.post}
              alt=""
              className="absolute inset-0 h-full w-full object-cover object-center"
              draggable={false}
            />
          </div>
          <p className="px-2.5 py-2 text-[9px] leading-relaxed text-neutral-600">
            <span className="font-semibold text-neutral-900">
              {MARINA_ASSETS.handle}{" "}
            </span>
            {t("landing.mockDetail.caption")}
          </p>
        </div>
      </div>

      <div className="space-y-2 rounded-xl border border-neutral-200 bg-white p-2.5">
        <div className="space-y-1">
          <p className="text-[9px] uppercase tracking-wide text-neutral-400">
            {t("project.calendar.columns.title")}
          </p>
          <div className="rounded-md border border-neutral-200 bg-neutral-50 px-2 py-1.5 text-[11px] font-medium text-neutral-900">
            {t(`landing.mockCalendar.posts.${post.key}.title`)}
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1">
            <p className="text-[9px] uppercase tracking-wide text-neutral-400">
              {t("project.calendar.columns.format")}
            </p>
            <span
              className={cn(
                "inline-flex rounded-md border px-1.5 py-1 text-[9px] font-medium",
                contentFormatStyles[post.format],
              )}
            >
              {t(`project.detail.formats.${post.format}`)}
            </span>
          </div>
          <div className="space-y-1">
            <p className="text-[9px] uppercase tracking-wide text-neutral-400">
              {t("project.calendar.columns.theme")}
            </p>
            <div className="rounded-md border border-neutral-200 bg-neutral-50 px-2 py-1 text-[10px] text-neutral-700">
              {t(`landing.mockCalendar.posts.${post.key}.theme`)}
            </div>
          </div>
        </div>
        <div className="space-y-1">
          <p className="text-[9px] uppercase tracking-wide text-neutral-400">
            {t("landing.mockDetail.captionLabel")}
          </p>
          <div className="rounded-md border border-neutral-200 bg-neutral-50 px-2 py-1.5 text-[10px] leading-relaxed text-neutral-700">
            {t("landing.mockDetail.caption")}
          </div>
        </div>
      </div>

      <div className="space-y-2 rounded-xl border border-neutral-200 bg-white p-2.5">
        <span className="inline-flex rounded-md bg-primary/15 px-1.5 py-0.5 text-[9px] font-semibold text-primary">
          {t("project.detail.media")}
        </span>
        <div className="flex gap-1">
          <span className="rounded-md border border-neutral-200 bg-white px-2 py-1 text-[9px] font-medium text-neutral-900">
            {t("project.detail.sourceFile")}
          </span>
          <span className="rounded-md bg-neutral-100 px-2 py-1 text-[9px] text-neutral-500">
            {t("project.detail.sourceUrl")}
          </span>
        </div>
        <p className="text-[8px] leading-snug text-neutral-500">
          {t("project.detail.mediaHint")}
        </p>
        <div className="flex items-center gap-1.5 rounded-md border border-neutral-200 bg-neutral-50 px-2 py-1.5">
          <p className="min-w-0 flex-1 truncate text-[8px] text-neutral-600">
            {t("landing.mockDetail.mediaFile")}
          </p>
          <X className="h-3 w-3 shrink-0 text-neutral-400" aria-hidden />
        </div>
      </div>

      <div className="space-y-2.5 rounded-xl border border-neutral-200 bg-white p-2.5">
        <div className="space-y-1.5">
          <span className="inline-flex rounded-md bg-primary/15 px-1.5 py-0.5 text-[9px] font-semibold text-primary">
            {t("project.detail.versionNote")}
          </span>
          <div className="rounded-md border border-neutral-200 bg-neutral-50 px-2 py-2 text-[10px] text-neutral-400">
            {t("project.detail.versionNotePlaceholder")}
          </div>
          <div className="flex flex-wrap gap-1.5">
            <span className="inline-flex items-center gap-1 rounded-md border border-neutral-200 bg-white px-2 py-1.5 text-[9px] font-medium text-neutral-800">
              <Save className="h-3 w-3" aria-hidden />
              {t("common.save")}
            </span>
            <span className="inline-flex items-center gap-1 rounded-md bg-primary px-2 py-1.5 text-[9px] font-medium text-primary-foreground">
              <History className="h-3 w-3" aria-hidden />
              {t("project.detail.saveVersion")}
            </span>
          </div>
        </div>

        <div
          ref={statusSectionRef}
          className="space-y-2 border-t border-neutral-100 pt-2.5"
        >
          <span className="inline-flex rounded-md bg-primary/15 px-1.5 py-0.5 text-[9px] font-semibold text-primary">
            {t("project.content.columns.status")}
          </span>
          <div className="flex flex-wrap gap-1.5">
            {CONTENT_STATUSES.map((value) => {
              const isCurrent = value === currentStatus;
              const isApprovedTarget = value === "approved";
              return (
                <button
                  key={value}
                  ref={isApprovedTarget ? approvedButtonRef : undefined}
                  type="button"
                  tabIndex={-1}
                  className={cn(
                    "rounded-md border px-2 py-1 text-[8px] font-medium shadow-sm",
                    isCurrent
                      ? contentStatusStyles[value]
                      : "border-neutral-200 bg-white text-neutral-700",
                    isApprovedTarget && tappingApproved && "landing-mock-tap",
                  )}
                >
                  {t(`project.content.status.${value}`)}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

function ProductMockup() {
  const { t } = useTranslation();
  const [scene, setScene] = useState<MockScene>("detail");
  const [tapping, setTapping] = useState(false);
  const [tappingApproved, setTappingApproved] = useState(false);
  const [detailStatus, setDetailStatus] = useState<ContentStatus>("review");
  const calendarViewportRef = useRef<HTMLDivElement>(null);
  const feedSectionRef = useRef<HTMLDivElement>(null);
  const detailViewportRef = useRef<HTMLDivElement>(null);
  const statusSectionRef = useRef<HTMLDivElement>(null);
  const approvedButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (prefersReducedMotion()) return;

    const signal = { cancelled: false };

    const runLoop = async () => {
      while (!signal.cancelled) {
        setScene("detail");
        setTapping(false);
        setTappingApproved(false);
        setDetailStatus("review");

        for (let i = 0; i < 30 && !signal.cancelled; i += 1) {
          if (detailViewportRef.current && statusSectionRef.current) break;
          await wait(16, signal);
        }
        if (signal.cancelled) break;

        const detailViewport = detailViewportRef.current;
        const statusSection = statusSectionRef.current;
        if (detailViewport) detailViewport.scrollTop = 0;

        await wait(TIMING.detailHoldTopMs, signal);
        if (signal.cancelled) break;

        if (detailViewport && statusSection) {
          const target =
            statusSection.offsetTop - detailViewport.clientHeight * 0.28;
          await animateScrollTop(
            detailViewport,
            Math.max(0, target),
            TIMING.detailScrollMs,
            signal,
          );
        } else {
          await wait(TIMING.detailScrollMs, signal);
        }
        if (signal.cancelled) break;

        await wait(TIMING.statusPauseMs, signal);
        if (signal.cancelled) break;

        setTappingApproved(true);
        await wait(TIMING.statusTapMs, signal);
        if (signal.cancelled) break;
        setTappingApproved(false);
        setDetailStatus("approved");

        await wait(TIMING.approvedHoldMs, signal);
        if (signal.cancelled) break;

        setScene("calendar");
        setDetailStatus("review");

        for (let i = 0; i < 30 && !signal.cancelled; i += 1) {
          if (calendarViewportRef.current && feedSectionRef.current) break;
          await wait(16, signal);
        }
        if (signal.cancelled) break;

        const calendarViewport = calendarViewportRef.current;
        const feedSection = feedSectionRef.current;
        if (calendarViewport && feedSection) {
          calendarViewport.scrollTop = 0;
          const target =
            feedSection.offsetTop - calendarViewport.clientHeight * 0.12;
          await animateScrollTop(
            calendarViewport,
            Math.max(0, target),
            TIMING.calendarScrollMs,
            signal,
          );
        } else {
          await wait(TIMING.calendarScrollMs, signal);
        }
        if (signal.cancelled) break;

        setScene("feed");
        await wait(TIMING.feedPauseMs, signal);
        if (signal.cancelled) break;

        setTapping(true);
        await wait(TIMING.tapMs, signal);
        if (signal.cancelled) break;
        setTapping(false);

        await wait(TIMING.detailEnterMs, signal);
      }
    };

    void runLoop();
    return () => {
      signal.cancelled = true;
    };
  }, []);

  return (
    <div className="landing-float relative mx-auto w-full max-w-[320px]">
      <div
        className="absolute -inset-8 landing-drift rounded-[40%] bg-primary/15 blur-3xl"
        aria-hidden
      />
      <PhoneChrome className="relative">
        <div className="flex flex-col bg-neutral-50" aria-hidden>
          {scene === "detail" ? (
            <>
              <div className="flex shrink-0 items-center gap-1.5 border-b border-neutral-200 bg-white px-2 py-2">
                <ChevronLeft className="h-4 w-4 text-neutral-700" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[12px] font-semibold text-neutral-900">
                    {t(`landing.mockCalendar.posts.${DETAIL_POST!.key}.title`)}
                  </p>
                </div>
                <span
                  className={cn(
                    "shrink-0 rounded-md border px-1.5 py-0.5 text-[8px] font-medium",
                    contentStatusStyles[detailStatus],
                  )}
                >
                  {t(`project.content.status.${detailStatus}`)}
                </span>
              </div>
              <div
                ref={detailViewportRef}
                className="landing-mock-viewport landing-mock-scene-enter"
              >
                <DetailMockScreen
                  statusSectionRef={statusSectionRef}
                  approvedButtonRef={approvedButtonRef}
                  currentStatus={detailStatus}
                  tappingApproved={tappingApproved}
                />
              </div>
            </>
          ) : (
            <>
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

              <div ref={calendarViewportRef} className="landing-mock-viewport">
                <CalendarMockList />
                <FeedMockSection sectionRef={feedSectionRef} tapping={tapping} />
              </div>
            </>
          )}
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
    <div className="theme-mono landing-atmosphere relative min-h-screen overflow-x-hidden">
      <div id="topo" className="landing-hero-plane">
        <header className="relative z-20 mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
          <a href="#topo" className="inline-flex items-center" aria-label={t("app.fullName")}>
            <SomMark className="h-9 w-auto" title={t("app.fullName")} />
          </a>
          <nav className="hidden items-center gap-7 text-sm text-neutral-500 md:flex">
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
                    <AvatarFallback className="bg-neutral-100 text-[11px] font-semibold text-neutral-800">
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
            <Button asChild size="sm" className="bg-neutral-900 text-white hover:bg-neutral-800">
              <a href="#contato">{t("landing.cta")}</a>
            </Button>
          </div>
        </header>

        {/* Hero — brand + mockup */}
        <section className="relative mx-auto grid max-w-6xl gap-12 px-6 pb-20 pt-10 lg:grid-cols-[1.05fr_0.95fr] lg:items-center lg:gap-8 lg:pb-28 lg:pt-14">
          <div>
            <div className="landing-rise max-w-xl">
              <SomLogo size="hero" priority title={t("app.fullName")} />
            </div>
            <h1 className="landing-rise landing-rise-delay-2 mt-8 max-w-xl font-display text-2xl font-medium leading-snug tracking-tight text-neutral-900 sm:text-3xl">
              {t("landing.heroTitle")}
            </h1>
            <p className="landing-rise landing-rise-delay-2 mt-4 max-w-lg text-base leading-relaxed text-neutral-600 sm:text-lg">
              {t("landing.heroSubtitle")}
            </p>
            <div className="landing-rise landing-rise-delay-3 mt-8 flex flex-wrap items-center gap-3">
              <Button
                asChild
                size="lg"
                className="bg-neutral-900 px-7 text-white hover:bg-neutral-800"
              >
                <a href="#contato">{t("landing.cta")}</a>
              </Button>
              <Button
                asChild
                size="lg"
                variant="outline"
                className="border-neutral-300 bg-white/70 text-neutral-900 hover:bg-white"
              >
                <a href="#planos">{t("landing.ctaSecondary")}</a>
              </Button>
            </div>
          </div>
          <div className="landing-rise landing-rise-delay-2">
            <ProductMockup />
          </div>
        </section>
        <div className="landing-hairline h-px w-full" aria-hidden />
      </div>

      <main>
        {/* Problem */}
        <section className="landing-wave-ink border-b border-white/10">
          <div className="mx-auto max-w-3xl px-6 py-16 text-center sm:py-20">
            <h2 className="font-display text-3xl font-semibold tracking-tight sm:text-4xl">
              {t("landing.problemTitle")}
            </h2>
            <p className="landing-wave-mute mt-4 whitespace-pre-line text-base leading-relaxed sm:text-lg">
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
              <li key={step} className="landing-wave-card relative border p-5">
                <span className="font-display text-5xl font-semibold text-neutral-300">{step}</span>
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
        <section id="ativos" className="landing-wave-mist border-y border-neutral-900/10">
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
                    className="landing-wave-card flex gap-3 border p-3.5"
                  >
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center border border-neutral-900/15 bg-white/50">
                      <Icon className="h-4 w-4 text-neutral-900" strokeWidth={1.75} aria-hidden />
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
        <section id="produto" className="border-b border-neutral-900/10 bg-white">
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
                    <Icon className="mb-3 h-5 w-5 text-neutral-900" strokeWidth={1.75} aria-hidden />
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
        <section id="planos" className="landing-wave-mist border-y border-neutral-900/10">
          <div className="mx-auto max-w-6xl px-6 py-16 sm:py-24">
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
                      "flex flex-col border p-6 transition-colors",
                      popular
                        ? "landing-wave-card-dark"
                        : "landing-wave-card",
                    )}
                  >
                    <div className="flex items-baseline justify-between gap-2">
                      <h3 className="font-display text-xl font-semibold">
                        {t(`landing.plans.${plan}.name`)}
                      </h3>
                      {popular ? (
                        <span className="border border-white/25 px-2 py-0.5 text-[11px] font-medium">
                          {t("landing.pricingPopular")}
                        </span>
                      ) : null}
                    </div>
                    <p
                      className={cn(
                        "mt-2 text-sm leading-relaxed",
                        popular ? "text-white/70" : "text-neutral-600",
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
                          popular ? "text-white/70" : "text-neutral-600",
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
                              popular ? "text-white" : "text-neutral-900",
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
                          ? "bg-white text-neutral-900 hover:bg-white/90"
                          : "bg-neutral-900 text-white hover:bg-neutral-800",
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
          </div>
        </section>

        {/* Final CTA */}
        <section className="landing-wave-ink border-t border-white/10">
          <div className="mx-auto flex max-w-6xl flex-col items-start gap-6 px-6 py-16 sm:flex-row sm:items-center sm:justify-between sm:py-20">
            <div className="max-w-xl">
              <h2 className="font-display text-3xl font-semibold tracking-tight sm:text-4xl">
                {t("landing.finalTitle")}
              </h2>
            </div>
            <Button
              asChild
              size="lg"
              className="bg-white text-neutral-900 hover:bg-white/90"
            >
              <a href="#contato">{t("landing.finalCta")}</a>
            </Button>
          </div>
        </section>

        {/* Contact */}
        <section id="contato" className="landing-wave-mist border-y border-neutral-900/10">
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
      </main>

      <SiteFooter />
    </div>
  );
}
