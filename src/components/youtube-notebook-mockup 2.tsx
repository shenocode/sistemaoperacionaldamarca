import { useMemo, useState, type ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import {
  Bell,
  Bookmark,
  ChevronDown,
  Heart,
  MessageCircle,
  MoreHorizontal,
  Play,
  Search,
  Share2,
  ThumbsDown,
  ThumbsUp,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { ContentStatusLink } from "@/components/content-status-select";
import { type ContentStatus } from "@/components/status-badge";
import {
  extractYoutubeVideoId,
  getLocalizedText,
  isPlayableVideoUrl,
  isYoutubeShortFormat,
  normalizeAppLocale,
  resolveContentMediaUrls,
  resolveContentThumbnail,
  youtubeEmbedUrl,
  youtubeThumbnailUrl,
  type ContentItem,
} from "@/lib/api";
import { cn } from "@/lib/utils";

function toHandle(value: string) {
  const slug = value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9._]+/g, "")
    .slice(0, 24);
  return slug || "marca";
}

export type NotebookSize = "default" | "lg" | "page";

export function YoutubeEmbedFrame({
  id,
  title,
  autoPlay,
  className,
}: {
  id: string;
  title: string;
  autoPlay?: boolean;
  className?: string;
}) {
  return (
    <iframe
      src={youtubeEmbedUrl(id, autoPlay)}
      title={title}
      className={cn("h-full w-full border-0", className)}
      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
      allowFullScreen
    />
  );
}

export function NotebookChrome({
  children,
  className,
  size = "default",
  aspect = "wide",
}: {
  children: ReactNode;
  className?: string;
  size?: NotebookSize;
  /** `wide` = modelo Site (16:10); `video` = 16:9 (watch/shorts). */
  aspect?: "wide" | "video";
}) {
  return (
    <div
      className={cn(
        "mx-auto w-full",
        size === "page"
          ? "max-w-full"
          : size === "lg"
            ? "max-w-[min(100%,960px)]"
            : "max-w-[min(100%,560px)]",
        className,
      )}
    >
      <div
        className={cn(
          "rounded-t-xl border border-b-0 border-neutral-700 bg-neutral-800 pb-0 pt-2 shadow-[0_25px_60px_-20px_rgba(0,0,0,0.45)]",
          size === "page" ? "px-2 sm:px-3" : "px-3",
        )}
      >
        <div className="mb-2 flex items-center gap-1.5 px-1">
          <span className="h-2 w-2 rounded-full bg-red-400/90" />
          <span className="h-2 w-2 rounded-full bg-amber-400/90" />
          <span className="h-2 w-2 rounded-full bg-emerald-400/90" />
          <div className="ml-3 h-4 flex-1 rounded-sm bg-neutral-700/80" />
        </div>
        <div
          className={cn(
            "overflow-hidden rounded-t-md border border-b-0 border-neutral-600 bg-white",
            size === "page"
              ? "h-[min(70dvh,720px)] sm:h-[min(78dvh,860px)]"
              : aspect === "wide"
                ? "aspect-[16/10]"
                : "aspect-video",
          )}
        >
          <div className="flex h-full min-h-0 flex-col">{children}</div>
        </div>
      </div>
      <div className="relative mx-auto h-3 w-full rounded-b-2xl border border-neutral-700 bg-gradient-to-b from-neutral-700 to-neutral-800">
        <div className="absolute left-1/2 top-1 h-1 w-16 -translate-x-1/2 rounded-full bg-neutral-600" />
      </div>
    </div>
  );
}

function YoutubeTopBar({ channelName }: { channelName: string }) {
  const { t } = useTranslation();
  return (
    <div className="flex shrink-0 items-center gap-2 border-b border-neutral-200 bg-white px-3 py-2">
      <div className="flex items-center gap-1">
        <span className="flex h-5 w-7 items-center justify-center rounded-sm bg-red-600 text-[9px] font-bold text-white">
          ▶
        </span>
        <span className="hidden text-[11px] font-semibold text-neutral-900 sm:inline">YouTube</span>
      </div>
      <div className="mx-auto flex max-w-[220px] flex-1 items-center gap-1 rounded-full border border-neutral-300 px-2 py-1 text-[10px] text-neutral-500">
        <Search className="h-3 w-3 shrink-0" aria-hidden="true" />
        <span className="truncate">{t("project.youtube.search")}</span>
      </div>
      <Bell className="h-3.5 w-3.5 text-neutral-600" aria-hidden="true" />
      <div className="flex h-5 w-5 items-center justify-center rounded-full bg-neutral-200 text-[8px] font-bold uppercase text-neutral-700">
        {channelName.slice(0, 1)}
      </div>
    </div>
  );
}

function baseMediaUrl(url: string) {
  return url.split("#")[0] || url;
}

function ThumbnailOrVideo({
  thumbnailUrl,
  videoUrl,
  title,
  aspectClass,
  playing,
  onPlay,
  onExpand,
  className,
}: {
  thumbnailUrl: string | null;
  videoUrl: string | null;
  title: string;
  aspectClass: string;
  playing: boolean;
  onPlay: () => void;
  onExpand?: () => void;
  className?: string;
}) {
  const { t } = useTranslation();
  const youtubeId =
    extractYoutubeVideoId(videoUrl ?? "") ?? extractYoutubeVideoId(thumbnailUrl ?? "");
  const canPlay = Boolean(videoUrl) || Boolean(youtubeId);
  const dedicatedThumb = thumbnailUrl?.trim() || null;
  const thumbIsVideoFrame = Boolean(
    dedicatedThumb &&
    !extractYoutubeVideoId(dedicatedThumb) &&
    (dedicatedThumb.includes("#t=") ||
      (videoUrl && baseMediaUrl(dedicatedThumb) === baseMediaUrl(videoUrl))),
  );
  const imageThumb =
    dedicatedThumb && !thumbIsVideoFrame && !extractYoutubeVideoId(dedicatedThumb)
      ? dedicatedThumb
      : youtubeId
        ? youtubeThumbnailUrl(youtubeId)
        : null;
  const videoPosterSrc =
    thumbIsVideoFrame && dedicatedThumb
      ? dedicatedThumb
      : videoUrl && !youtubeId
        ? `${baseMediaUrl(videoUrl)}#t=0.1`
        : null;

  const handleActivate = () => {
    if (onExpand) {
      onExpand();
      return;
    }
    if (canPlay) onPlay();
  };

  if (playing && canPlay && !onExpand) {
    if (youtubeId) {
      return (
        <div className={cn("relative bg-black", aspectClass, className)}>
          <YoutubeEmbedFrame id={youtubeId} title={title} autoPlay />
        </div>
      );
    }
    if (videoUrl) {
      return (
        <div className={cn("relative bg-black", aspectClass, className)}>
          <video
            src={videoUrl}
            poster={imageThumb ?? undefined}
            className="h-full w-full object-contain"
            controls
            autoPlay
            playsInline
          />
        </div>
      );
    }
  }

  return (
    <button
      type="button"
      className={cn(
        "group relative block w-full overflow-hidden bg-neutral-900 text-left",
        aspectClass,
        className,
        canPlay || onExpand ? "cursor-pointer" : "cursor-default",
      )}
      onClick={() => {
        if (canPlay || onExpand) handleActivate();
      }}
      aria-label={canPlay || onExpand ? t("project.youtube.play") : title}
      disabled={!canPlay && !onExpand && !imageThumb && !videoPosterSrc}
    >
      {imageThumb ? (
        <img src={imageThumb} alt="" className="h-full w-full object-cover" />
      ) : videoPosterSrc ? (
        <video
          src={videoPosterSrc}
          className="h-full w-full object-cover"
          muted
          playsInline
          preload="metadata"
        />
      ) : (
        <div className="flex h-full items-center justify-center text-[11px] text-neutral-400">
          {t("project.youtube.noThumbnail")}
        </div>
      )}
      {canPlay || onExpand ? (
        <span className="absolute inset-0 flex items-center justify-center bg-black/25 transition group-hover:bg-black/35">
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-red-600 text-white shadow-lg">
            <Play className="h-5 w-5 fill-current" aria-hidden="true" />
          </span>
        </span>
      ) : null}
    </button>
  );
}

type WatchProps = {
  title: string;
  caption?: string;
  hashtags?: string;
  cta?: string;
  username?: string;
  avatarUrl?: string | null;
  thumbnailUrl?: string | null;
  videoUrl?: string | null;
  size?: "default" | "lg";
  onExpand?: () => void;
  className?: string;
};

export function YouTubeWatchMockup({
  title,
  caption = "",
  hashtags = "",
  cta = "",
  username = "marca",
  avatarUrl,
  thumbnailUrl = null,
  videoUrl = null,
  size = "default",
  onExpand,
  className,
}: WatchProps) {
  const { t } = useTranslation();
  const [playing, setPlaying] = useState(false);
  const channel = username.trim() || "marca";
  const handle = toHandle(channel);
  const description = [caption, cta, hashtags].filter((part) => part.trim()).join("\n\n");

  return (
    <div className={cn("space-y-2", className)}>
      <p className="text-center text-xs text-muted-foreground">
        {t("project.youtube.previewFormat", {
          format: t("project.detail.formats.recorded_video"),
        })}
      </p>
      <NotebookChrome size={size} aspect="video">
        <YoutubeTopBar channelName={channel} />
        <div className="min-h-0 flex-1 space-y-2 overflow-y-auto bg-white p-3">
          <ThumbnailOrVideo
            thumbnailUrl={thumbnailUrl}
            videoUrl={videoUrl}
            title={title}
            aspectClass="aspect-video"
            playing={playing}
            onPlay={() => setPlaying(true)}
            onExpand={onExpand}
          />
          <h3 className="text-[13px] font-semibold leading-snug text-neutral-900">
            {title.trim() || t("project.youtube.untitled")}
          </h3>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex min-w-0 items-center gap-2">
              <div className="h-8 w-8 shrink-0 overflow-hidden rounded-full bg-neutral-200">
                {avatarUrl ? (
                  <img src={avatarUrl} alt="" className="h-full w-full object-cover" />
                ) : (
                  <span className="flex h-full w-full items-center justify-center text-[10px] font-bold uppercase">
                    {channel.slice(0, 2)}
                  </span>
                )}
              </div>
              <div className="min-w-0">
                <p className="truncate text-[12px] font-semibold text-neutral-900">{channel}</p>
                <p className="truncate text-[10px] text-neutral-500">@{handle}</p>
              </div>
              <span className="rounded-full bg-neutral-900 px-2.5 py-1 text-[10px] font-semibold text-white">
                {t("project.youtube.subscribe")}
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-1">
              <span className="inline-flex items-center gap-1 rounded-full bg-neutral-100 px-2 py-1 text-[10px] text-neutral-800">
                <ThumbsUp className="h-3 w-3" aria-hidden="true" />
                122
                <span className="mx-0.5 h-3 w-px bg-neutral-300" />
                <ThumbsDown className="h-3 w-3" aria-hidden="true" />
              </span>
              <span className="inline-flex items-center gap-1 rounded-full bg-neutral-100 px-2 py-1 text-[10px] text-neutral-800">
                <Share2 className="h-3 w-3" aria-hidden="true" />
                {t("project.youtube.share")}
              </span>
              <span className="inline-flex items-center gap-1 rounded-full bg-neutral-100 px-2 py-1 text-[10px] text-neutral-800">
                <Bookmark className="h-3 w-3" aria-hidden="true" />
                {t("project.youtube.save")}
              </span>
            </div>
          </div>
          <div className="rounded-xl bg-neutral-100 px-3 py-2">
            <p className="text-[10px] font-medium text-neutral-700">
              {t("project.youtube.viewsMeta")}
            </p>
            <p className="mt-1 whitespace-pre-wrap text-[11px] leading-relaxed text-neutral-800">
              {description.trim() || t("project.youtube.emptyDescription")}
            </p>
          </div>
        </div>
      </NotebookChrome>
    </div>
  );
}

type ShortsProps = WatchProps;

export function YouTubeShortsMockup({
  title,
  caption = "",
  username = "marca",
  avatarUrl,
  thumbnailUrl = null,
  videoUrl = null,
  size = "default",
  onExpand,
  className,
}: ShortsProps) {
  const { t } = useTranslation();
  const [playing, setPlaying] = useState(false);
  const channel = username.trim() || "marca";
  const handle = toHandle(channel);

  return (
    <div className={cn("space-y-2", className)}>
      <p className="text-center text-xs text-muted-foreground">
        {t("project.youtube.previewFormat", {
          format: t("project.detail.formats.youtube_short"),
        })}
      </p>
      <NotebookChrome size={size} aspect="video">
        <YoutubeTopBar channelName={channel} />
        <div className="flex min-h-0 flex-1 items-center justify-center overflow-hidden bg-neutral-950 px-3 py-2">
          <div className="relative aspect-[9/16] h-full max-h-full">
            <ThumbnailOrVideo
              thumbnailUrl={thumbnailUrl}
              videoUrl={videoUrl}
              title={title}
              aspectClass="absolute inset-0 h-full w-full"
              playing={playing}
              onPlay={() => setPlaying(true)}
              onExpand={onExpand}
              className="rounded-xl"
            />
            {!playing || onExpand ? (
              <>
                <div className="pointer-events-none absolute bottom-3 left-3 right-12 space-y-1 text-white drop-shadow">
                  <p className="text-[11px] font-semibold">@{handle}</p>
                  <p className="line-clamp-2 text-[11px] leading-snug">
                    {title.trim() || caption.trim() || t("project.youtube.untitled")}
                  </p>
                </div>
                <div className="pointer-events-none absolute bottom-3 right-2 flex flex-col items-center gap-3 text-white">
                  <div className="h-7 w-7 overflow-hidden rounded-full border border-white/40 bg-neutral-700">
                    {avatarUrl ? (
                      <img src={avatarUrl} alt="" className="h-full w-full object-cover" />
                    ) : null}
                  </div>
                  <Heart className="h-5 w-5" aria-hidden="true" />
                  <ThumbsDown className="h-5 w-5" aria-hidden="true" />
                  <div className="flex flex-col items-center gap-0.5">
                    <MessageCircle className="h-5 w-5" aria-hidden="true" />
                    <span className="text-[9px]">1,2 mil</span>
                  </div>
                  <Share2 className="h-5 w-5" aria-hidden="true" />
                  <MoreHorizontal className="h-5 w-5" aria-hidden="true" />
                </div>
              </>
            ) : null}
          </div>
        </div>
      </NotebookChrome>
    </div>
  );
}

function isVisibleInChannel(item: ContentItem) {
  return item.status !== "draft";
}

type ChannelProps = {
  items: ContentItem[];
  clientId: string;
  projectId: string;
  username?: string | null;
  avatarUrl?: string | null;
  className?: string;
  showLabel?: boolean;
  size?: NotebookSize;
};

export function YouTubeChannelMockup({
  items,
  clientId,
  projectId,
  username,
  avatarUrl,
  className,
  showLabel = true,
  size = "lg",
}: ChannelProps) {
  const { t, i18n } = useTranslation();
  const [tab, setTab] = useState<"home" | "videos" | "shorts">("home");
  const [playingId, setPlayingId] = useState<string | null>(null);
  const uiLocale = normalizeAppLocale(i18n.resolvedLanguage ?? i18n.language);
  const channel = username?.trim() || t("project.youtube.channelFallback");
  const handle = toHandle(channel);

  const visible = useMemo(() => items.filter(isVisibleInChannel), [items]);
  const shorts = useMemo(
    () => visible.filter((item) => isYoutubeShortFormat(item.format)),
    [visible],
  );
  const longForm = useMemo(
    () => visible.filter((item) => !isYoutubeShortFormat(item.format)),
    [visible],
  );

  const localizedTitle = (item: ContentItem) =>
    getLocalizedText(item.i18n, "title", item.title, uiLocale);

  const renderCard = (item: ContentItem, short: boolean) => {
    const urls = resolveContentMediaUrls(item);
    const media = urls.find((url) => isPlayableVideoUrl(url)) ?? urls[0] ?? null;
    const thumb = resolveContentThumbnail(item);
    const playing = playingId === item.id;
    const title = localizedTitle(item);

    return (
      <div
        key={item.id}
        className={cn("min-w-0", short ? "w-[108px] shrink-0 sm:w-[120px]" : "w-full")}
      >
        <ThumbnailOrVideo
          thumbnailUrl={thumb}
          videoUrl={media}
          title={title}
          aspectClass={short ? "aspect-[9/16] rounded-lg" : "aspect-video rounded-lg"}
          playing={playing}
          onPlay={() => setPlayingId(item.id)}
        />
        <div className={cn("px-0.5", short ? "mt-1.5 space-y-1" : "mt-1.5 space-y-1.5")}>
          <Link
            to="/clients/$clientId/projects/$projectId/content/$contentId"
            params={{ clientId, projectId, contentId: item.id }}
            search={{}}
            className="line-clamp-2 text-xs font-medium leading-snug text-neutral-900 hover:underline sm:text-sm"
          >
            {title}
          </Link>
          <ContentStatusLink
            status={item.status as ContentStatus}
            contentId={item.id}
            clientId={clientId}
            projectId={projectId}
            className={short ? "w-full" : "inline-flex"}
            badgeClassName={
              short
                ? "h-auto min-h-6 w-full justify-center whitespace-normal px-1.5 py-0.5 text-[8px] leading-tight"
                : "h-7 px-2.5 text-[11px]"
            }
          />
          {short ? null : (
            <p className="text-[10px] text-neutral-500">{t("project.youtube.cardMeta")}</p>
          )}
        </div>
      </div>
    );
  };

  const emptyLabel =
    tab === "shorts" ? t("project.youtube.emptyShorts") : t("project.youtube.emptyVideos");

  const listForTab = tab === "shorts" ? shorts : tab === "videos" ? longForm : null;

  return (
    <div className={cn("mx-auto w-full space-y-2", className)}>
      {showLabel ? (
        <p className="text-center text-xs text-muted-foreground">
          {t("project.youtube.previewChannel")}
        </p>
      ) : null}
      <NotebookChrome size={size} aspect="wide">
        <YoutubeTopBar channelName={channel} />
        <div className="min-h-0 flex-1 overflow-y-auto bg-white">
          <div className="h-20 bg-gradient-to-r from-neutral-800 via-neutral-600 to-neutral-400 sm:h-24" />
          <div className="flex flex-wrap items-end gap-3 px-4 pb-2 pt-3">
            <div className="-mt-10 h-16 w-16 shrink-0 overflow-hidden rounded-full border-2 border-white bg-neutral-200 shadow sm:h-[4.5rem] sm:w-[4.5rem]">
              {avatarUrl ? (
                <img src={avatarUrl} alt="" className="h-full w-full object-cover" />
              ) : (
                <span className="flex h-full w-full items-center justify-center text-base font-bold uppercase text-neutral-600">
                  {channel.slice(0, 2)}
                </span>
              )}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-base font-bold text-neutral-900">{channel}</p>
              <p className="truncate text-xs text-neutral-500">
                @{handle} · {t("project.youtube.subscribersMeta", { count: visible.length })}
              </p>
            </div>
            <span className="rounded-full bg-neutral-900 px-3.5 py-1.5 text-[11px] font-semibold text-white">
              {t("project.youtube.subscribe")}
            </span>
          </div>

          <div className="flex gap-4 border-b border-neutral-200 px-4 text-xs font-medium text-neutral-600">
            {(
              [
                ["home", t("project.youtube.tabHome")],
                ["videos", t("project.youtube.tabVideos")],
                ["shorts", t("project.youtube.tabShorts")],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                className={cn(
                  "border-b-2 py-2.5 transition-colors",
                  tab === id
                    ? "border-neutral-900 text-neutral-900"
                    : "border-transparent hover:text-neutral-800",
                )}
                onClick={() => {
                  setTab(id);
                  setPlayingId(null);
                }}
              >
                {label}
              </button>
            ))}
          </div>

          <div className="space-y-4 p-4">
            {tab === "home" ? (
              <>
                <section className="space-y-2">
                  <div className="flex items-center justify-between">
                    <h4 className="text-sm font-semibold text-neutral-900">
                      {t("project.youtube.sectionVideos")}
                    </h4>
                    <ChevronDown
                      className="h-3.5 w-3.5 -rotate-90 text-neutral-400"
                      aria-hidden="true"
                    />
                  </div>
                  {longForm.length === 0 ? (
                    <p className="text-xs text-neutral-500">{t("project.youtube.emptyVideos")}</p>
                  ) : (
                    <div className="space-y-4">
                      {longForm.map((item) => renderCard(item, false))}
                    </div>
                  )}
                </section>
                <section className="space-y-2">
                  <div className="flex items-center gap-1.5">
                    <span className="text-sm font-bold text-red-600">S</span>
                    <h4 className="text-sm font-semibold text-neutral-900">
                      {t("project.youtube.sectionShorts")}
                    </h4>
                  </div>
                  {shorts.length === 0 ? (
                    <p className="text-xs text-neutral-500">{t("project.youtube.emptyShorts")}</p>
                  ) : (
                    <div className="flex gap-3 overflow-x-auto pb-1">
                      {shorts.map((item) => renderCard(item, true))}
                    </div>
                  )}
                </section>
              </>
            ) : listForTab && listForTab.length === 0 ? (
              <p className="text-xs text-neutral-500">{emptyLabel}</p>
            ) : tab === "shorts" ? (
              <div className="flex gap-3 overflow-x-auto pb-1">
                {(listForTab ?? []).map((item) => renderCard(item, true))}
              </div>
            ) : (
              <div className="space-y-4">
                {(listForTab ?? []).map((item) => renderCard(item, false))}
              </div>
            )}
          </div>
        </div>
      </NotebookChrome>
    </div>
  );
}
