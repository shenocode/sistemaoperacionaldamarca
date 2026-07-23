import { useEffect, useState, type ReactNode } from "react";
import {
  Bookmark,
  ExternalLink,
  FileText,
  Heart,
  MessageCircle,
  MoreHorizontal,
  Send,
  Volume2,
  VolumeX,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
  type CarouselApi,
} from "@/components/ui/carousel";
import { cn } from "@/lib/utils";
import {
  isImageUrl,
  isVideoUrl,
  type ContentFormat,
} from "@/lib/api";

export type PreviewMediaItem = {
  url: string;
  kind?: "image" | "video" | "file";
  name?: string;
};

type ContentMediaPreviewProps = {
  items: PreviewMediaItem[];
  format: ContentFormat;
  title: string;
  caption?: string;
  hashtags?: string;
  cta?: string;
  username?: string;
  avatarUrl?: string | null;
};

function resolveKind(item: PreviewMediaItem): "image" | "video" | "file" {
  if (item.kind) return item.kind;
  if (isVideoUrl(item.url)) return "video";
  if (isImageUrl(item.url)) return "image";
  if (/\.(pdf|docx?|xlsx?|csv|txt|md|rtf|od[ts])(\?|$)/i.test(item.url)) return "file";
  return "image";
}

function toHandle(value: string) {
  const slug = value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9._]+/g, "")
    .slice(0, 24);
  return slug || "marca";
}

function MediaSlide({
  item,
  title,
  className,
  autoPlay,
  muted,
}: {
  item: PreviewMediaItem;
  title: string;
  className?: string;
  autoPlay?: boolean;
  muted?: boolean;
}) {
  const { t } = useTranslation();
  const kind = resolveKind(item);

  if (kind === "video") {
    return (
      <video
        src={item.url}
        controls={!autoPlay}
        autoPlay={autoPlay}
        muted={muted ?? autoPlay}
        loop={autoPlay}
        playsInline
        className={cn("h-full w-full object-cover", className)}
      />
    );
  }

  if (kind === "file") {
    return (
      <a
        href={item.url}
        target="_blank"
        rel="noreferrer"
        className="flex h-full w-full flex-col items-center justify-center gap-2 bg-neutral-100 px-4 text-center text-sm text-neutral-500"
      >
        <FileText className="h-8 w-8" aria-hidden="true" />
        <span className="inline-flex items-center gap-1 text-sky-600">
          <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
          {t("project.detail.openFile")}
        </span>
      </a>
    );
  }

  return (
    <img src={item.url} alt={title} className={cn("h-full w-full object-cover", className)} />
  );
}

export function toInstagramHandle(value: string) {
  return toHandle(value);
}

export function PhoneChrome({ children }: { children: ReactNode }) {
  return (
    <div className="mx-auto w-full max-w-[320px]">
      <div className="relative rounded-[2.4rem] border border-neutral-800 bg-neutral-950 p-[10px] shadow-[0_25px_60px_-20px_rgba(0,0,0,0.45)]">
        <div className="pointer-events-none absolute left-1/2 top-[18px] z-20 h-[26px] w-[96px] -translate-x-1/2 rounded-full bg-black" />
        <div className="pointer-events-none absolute right-[-2px] top-[120px] h-14 w-[3px] rounded-l-sm bg-neutral-700" />
        <div className="pointer-events-none absolute left-[-2px] top-[100px] h-8 w-[3px] rounded-r-sm bg-neutral-700" />
        <div className="pointer-events-none absolute left-[-2px] top-[140px] h-12 w-[3px] rounded-r-sm bg-neutral-700" />
        <div className="overflow-hidden rounded-[1.9rem] bg-white">
          <div className="flex items-end justify-between bg-white px-5 pb-1 pt-3 text-[10px] font-semibold text-neutral-900">
            <span>9:41</span>
            <div className="flex items-center gap-1">
              <span className="inline-block h-2 w-4 rounded-[1px] border border-neutral-900">
                <span className="ml-[1px] mt-[1px] block h-[5px] w-2.5 bg-neutral-900" />
              </span>
            </div>
          </div>
          {children}
        </div>
      </div>
    </div>
  );
}

function ProfileHeader({
  username,
  avatarUrl,
  subtitle,
}: {
  username: string;
  avatarUrl?: string | null;
  subtitle?: string;
}) {
  return (
    <div className="flex items-center gap-2 border-b border-neutral-100 px-3 py-2">
      <div className="h-8 w-8 shrink-0 overflow-hidden rounded-full bg-gradient-to-tr from-amber-400 via-pink-500 to-purple-600 p-[1.5px]">
        <div className="flex h-full w-full items-center justify-center overflow-hidden rounded-full bg-white">
          {avatarUrl ? (
            <img src={avatarUrl} alt="" className="h-full w-full object-cover" />
          ) : (
            <span className="text-[10px] font-bold uppercase text-neutral-700">
              {username.slice(0, 2)}
            </span>
          )}
        </div>
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-[12px] font-semibold text-neutral-900">{username}</p>
        {subtitle ? (
          <p className="truncate text-[10px] text-neutral-500">{subtitle}</p>
        ) : null}
      </div>
      <MoreHorizontal className="h-4 w-4 text-neutral-900" aria-hidden="true" />
    </div>
  );
}

function ActionBar({ liked }: { liked?: boolean }) {
  return (
    <div className="flex items-center justify-between px-3 py-2">
      <div className="flex items-center gap-3">
        <Heart
          className={cn("h-[22px] w-[22px]", liked ? "fill-red-500 text-red-500" : "text-neutral-900")}
          aria-hidden="true"
        />
        <MessageCircle className="h-[22px] w-[22px] -scale-x-100 text-neutral-900" aria-hidden="true" />
        <Send className="h-[20px] w-[20px] text-neutral-900" aria-hidden="true" />
      </div>
      <Bookmark className="h-[22px] w-[22px] text-neutral-900" aria-hidden="true" />
    </div>
  );
}

function CaptionBlock({
  username,
  caption,
  hashtags,
  cta,
}: {
  username: string;
  caption?: string;
  hashtags?: string;
  cta?: string;
}) {
  const { t } = useTranslation();
  const hasBody = Boolean(caption?.trim() || hashtags?.trim() || cta?.trim());

  return (
    <div className="space-y-1.5 px-3 pb-3">
      <p className="text-[12px] font-semibold text-neutral-900">
        {t("project.detail.previewLikes", { count: 128 })}
      </p>
      {hasBody ? (
        <p className="text-[12px] leading-snug text-neutral-900">
          <span className="font-semibold">{username}</span>{" "}
          {caption?.trim() ? <span>{caption.trim()}</span> : null}
          {hashtags?.trim() ? (
            <span className="mt-1 block text-sky-700">{hashtags.trim()}</span>
          ) : null}
          {cta?.trim() ? (
            <span className="mt-1 block font-medium text-neutral-700">{cta.trim()}</span>
          ) : null}
        </p>
      ) : (
        <p className="text-[12px] text-neutral-400">{t("project.detail.previewEmptyCaption")}</p>
      )}
      <p className="text-[10px] uppercase tracking-wide text-neutral-400">
        {t("project.detail.previewTime")}
      </p>
    </div>
  );
}

export function ContentMediaPreview({
  items,
  format,
  title,
  caption,
  hashtags,
  cta,
  username,
  avatarUrl,
}: ContentMediaPreviewProps) {
  const { t } = useTranslation();
  const [api, setApi] = useState<CarouselApi>();
  const [current, setCurrent] = useState(0);
  const [muted, setMuted] = useState(true);

  const handle = toHandle(username || title || "marca");
  const isStories = format === "stories";
  const isReels = format === "reels";

  useEffect(() => {
    if (!api) return;
    const sync = () => setCurrent(api.selectedScrollSnap());
    sync();
    api.on("select", sync);
    return () => {
      api.off("select", sync);
    };
  }, [api]);

  const mediaFrame = (emptyLabel: string, aspectClass: string) => {
    if (items.length === 0) {
      return (
        <div
          className={cn(
            "flex items-center justify-center bg-neutral-100 text-xs text-neutral-400",
            aspectClass,
          )}
        >
          {emptyLabel}
        </div>
      );
    }

    if (format === "carousel") {
      return (
        <div className={cn("relative bg-black", aspectClass)}>
          <Carousel setApi={setApi} opts={{ loop: false }} className="h-full w-full">
            <CarouselContent className="ml-0 h-full">
              {items.map((item, index) => (
                <CarouselItem key={`${item.url}-${index}`} className="basis-full pl-0">
                  <div className={cn("bg-black", aspectClass)}>
                    <MediaSlide item={item} title={`${title} ${index + 1}`} />
                  </div>
                </CarouselItem>
              ))}
            </CarouselContent>
            {items.length > 1 ? (
              <>
                <CarouselPrevious className="left-2 h-7 w-7 border-0 bg-black/40 text-white hover:bg-black/60 hover:text-white" />
                <CarouselNext className="right-2 h-7 w-7 border-0 bg-black/40 text-white hover:bg-black/60 hover:text-white" />
              </>
            ) : null}
          </Carousel>
          {items.length > 1 ? (
            <div className="absolute bottom-2 left-0 right-0 flex items-center justify-center gap-1">
              {items.map((_, index) => (
                <button
                  key={index}
                  type="button"
                  aria-label={`${t("project.detail.slide")} ${index + 1}`}
                  className={cn(
                    "h-1.5 rounded-full transition-all",
                    index === current ? "w-3 bg-sky-400" : "w-1.5 bg-white/70",
                  )}
                  onClick={() => api?.scrollTo(index)}
                />
              ))}
            </div>
          ) : null}
          <span className="absolute right-2 top-2 rounded-full bg-black/60 px-2 py-0.5 text-[10px] font-medium text-white">
            {current + 1}/{items.length}
          </span>
        </div>
      );
    }

    return (
      <div className={cn("relative bg-black", aspectClass)}>
        <MediaSlide item={items[0]} title={title} />
      </div>
    );
  };

  if (isStories) {
    return (
      <PhoneChrome>
        <div className="relative aspect-[9/16] bg-black">
          {items.length === 0 ? (
            <div className="flex h-full items-center justify-center text-xs text-white/50">
              {t("project.detail.noPreview")}
            </div>
          ) : (
            <MediaSlide item={items[0]} title={title} autoPlay muted={muted} />
          )}
          <div className="absolute inset-x-0 top-0 bg-gradient-to-b from-black/55 to-transparent px-3 pb-8 pt-2">
            <div className="mb-3 h-0.5 overflow-hidden rounded-full bg-white/30">
              <div className="h-full w-2/3 bg-white" />
            </div>
            <div className="flex items-center gap-2">
              <div className="h-7 w-7 overflow-hidden rounded-full bg-white/20">
                {avatarUrl ? (
                  <img src={avatarUrl} alt="" className="h-full w-full object-cover" />
                ) : null}
              </div>
              <span className="text-[12px] font-semibold text-white">{handle}</span>
              <span className="text-[10px] text-white/70">2h</span>
            </div>
          </div>
          {(caption || cta) && (
            <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent px-3 pb-5 pt-10">
              {caption ? <p className="text-[12px] text-white">{caption}</p> : null}
              {cta ? <p className="mt-1 text-[11px] font-medium text-white/90">{cta}</p> : null}
            </div>
          )}
        </div>
      </PhoneChrome>
    );
  }

  if (isReels) {
    return (
      <PhoneChrome>
        <div className="relative aspect-[9/16] bg-black">
          {items.length === 0 ? (
            <div className="flex h-full items-center justify-center text-xs text-white/50">
              {t("project.detail.noPreview")}
            </div>
          ) : (
            <MediaSlide item={items[0]} title={title} autoPlay muted={muted} className="absolute inset-0" />
          )}
          <button
            type="button"
            onClick={() => setMuted((value) => !value)}
            className="absolute bottom-24 right-3 z-10 rounded-full bg-black/55 p-1.5 text-white"
            aria-label={muted ? t("project.detail.unmute") : t("project.detail.mute")}
          >
            {muted ? (
              <VolumeX className="h-3.5 w-3.5" aria-hidden="true" />
            ) : (
              <Volume2 className="h-3.5 w-3.5" aria-hidden="true" />
            )}
          </button>
          <div className="pointer-events-none absolute inset-x-0 top-0 flex items-center justify-between px-3 pt-2">
            <span className="text-[13px] font-semibold text-white">Reels</span>
            <MoreHorizontal className="h-4 w-4 text-white" aria-hidden="true" />
          </div>
          <div className="absolute bottom-4 left-3 right-14 space-y-2 text-white">
            <div className="flex items-center gap-2">
              <div className="h-7 w-7 overflow-hidden rounded-full bg-white/20">
                {avatarUrl ? (
                  <img src={avatarUrl} alt="" className="h-full w-full object-cover" />
                ) : null}
              </div>
              <span className="text-[12px] font-semibold">{handle}</span>
            </div>
            {caption ? <p className="line-clamp-3 text-[12px]">{caption}</p> : null}
            {hashtags ? <p className="line-clamp-2 text-[11px] text-white/80">{hashtags}</p> : null}
            {cta ? <p className="text-[11px] font-medium text-white/90">{cta}</p> : null}
          </div>
          <div className="absolute bottom-6 right-3 flex flex-col items-center gap-4 text-white">
            <Heart className="h-6 w-6" aria-hidden="true" />
            <MessageCircle className="h-6 w-6 -scale-x-100" aria-hidden="true" />
            <Send className="h-5 w-5" aria-hidden="true" />
            <Bookmark className="h-6 w-6" aria-hidden="true" />
          </div>
        </div>
      </PhoneChrome>
    );
  }

  return (
    <PhoneChrome>
      <div className="border-b border-neutral-100 px-3 py-2">
        <p className="text-center text-[13px] font-semibold text-neutral-900">
          {t("project.detail.previewFeed")}
        </p>
      </div>
      <ProfileHeader
        username={handle}
        avatarUrl={avatarUrl}
        subtitle={
          format === "carousel"
            ? t("project.detail.formats.carousel")
            : t("project.detail.formats.static_feed")
        }
      />
      {mediaFrame(t("project.detail.noPreview"), "aspect-square")}
      <ActionBar />
      <CaptionBlock
        username={handle}
        caption={caption}
        hashtags={hashtags}
        cta={cta}
      />
    </PhoneChrome>
  );
}

export function guessMediaKind(file: File): PreviewMediaItem["kind"] {
  if (file.type.startsWith("video/")) return "video";
  if (file.type.startsWith("image/")) return "image";
  return "file";
}
