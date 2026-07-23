import {
  Clapperboard,
  Contact,
  Home,
  LayoutGrid,
  Play,
  Repeat2,
  Search,
  SquareStack,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import {
  PhoneChrome,
  toInstagramHandle,
} from "@/components/content-media-preview";
import {
  isVideoUrl,
  resolveContentMediaUrls,
  type ContentFormat,
  type ContentItem,
} from "@/lib/api";
import { cn } from "@/lib/utils";

type InstagramFeedMockupProps = {
  items: ContentItem[];
  username?: string | null;
  avatarUrl?: string | null;
  className?: string;
};

function coverUrl(item: ContentItem) {
  return resolveContentMediaUrls(item)[0] ?? null;
}

function formatBadge(format: ContentFormat, cover: string | null) {
  if (format === "carousel") return "carousel" as const;
  if (format === "reels") return "reels" as const;
  if (cover && isVideoUrl(cover)) return "video" as const;
  return null;
}

function CoverMedia({ url, title }: { url: string; title: string }) {
  if (isVideoUrl(url)) {
    // #t=0.1 força o browser a carregar um frame de capa.
    const posterSrc = url.includes("#") ? url : `${url}#t=0.1`;
    return (
      <video
        src={posterSrc}
        muted
        playsInline
        preload="metadata"
        className="h-full w-full object-cover"
        aria-label={title}
      />
    );
  }

  return <img src={url} alt={title} className="h-full w-full object-cover" />;
}

function GridTile({ item }: { item: ContentItem }) {
  const { t } = useTranslation();
  const cover = coverUrl(item);
  const badge = formatBadge(item.format, cover);

  return (
    <div className="relative aspect-square bg-neutral-100">
      {cover ? (
        <CoverMedia url={cover} title={item.title} />
      ) : (
        <div className="flex h-full items-center justify-center px-1 text-center text-[8px] leading-tight text-neutral-400">
          {t("project.detail.noPreview")}
        </div>
      )}
      {badge === "carousel" ? (
        <SquareStack
          className="absolute right-1 top-1 h-3.5 w-3.5 text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.55)]"
          aria-hidden="true"
        />
      ) : null}
      {badge === "reels" || badge === "video" ? (
        <Clapperboard
          className="absolute right-1 top-1 h-3.5 w-3.5 text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.55)]"
          aria-hidden="true"
        />
      ) : null}
    </div>
  );
}

export function InstagramFeedMockup({
  items,
  username,
  avatarUrl,
  className,
}: InstagramFeedMockupProps) {
  const { t } = useTranslation();
  const handle = toInstagramHandle(username || "marca");

  // Mantém a ordem recebida (sort_order da lista) — não reordena por data.
  const feedItems = items;

  return (
    <div className={cn("w-full max-w-[320px]", className)}>
      <p className="mb-2 text-center text-xs font-medium text-muted-foreground">
        {t("project.content.feedPreview")}
      </p>
      <PhoneChrome>
        <div className="flex h-[560px] flex-col bg-white">
          <div className="flex items-center justify-center border-b border-neutral-200 px-3 pb-2 pt-1">
            <p className="truncate text-[13px] font-semibold text-neutral-900">{handle}</p>
          </div>

          <div className="flex items-center justify-around border-b border-neutral-200 px-2">
            <button
              type="button"
              tabIndex={-1}
              className="flex flex-1 items-center justify-center border-b-[2px] border-neutral-900 py-2.5 text-neutral-900"
              aria-label={t("project.content.feedGridTab")}
            >
              <LayoutGrid className="h-4 w-4" aria-hidden="true" />
            </button>
            <button
              type="button"
              tabIndex={-1}
              className="flex flex-1 items-center justify-center py-2.5 text-neutral-400"
              aria-hidden="true"
            >
              <Clapperboard className="h-4 w-4" />
            </button>
            <button
              type="button"
              tabIndex={-1}
              className="flex flex-1 items-center justify-center py-2.5 text-neutral-400"
              aria-hidden="true"
            >
              <Repeat2 className="h-4 w-4" />
            </button>
            <button
              type="button"
              tabIndex={-1}
              className="flex flex-1 items-center justify-center py-2.5 text-neutral-400"
              aria-hidden="true"
            >
              <Contact className="h-4 w-4" />
            </button>
          </div>

          {feedItems.length === 0 ? (
            <div className="flex flex-1 items-center justify-center px-6 text-center text-xs text-neutral-400">
              {t("project.content.feedEmpty")}
            </div>
          ) : (
            <div className="flex-1 overflow-y-auto overscroll-contain">
              <div className="grid grid-cols-3 gap-px bg-neutral-200">
                {feedItems.map((item) => (
                  <GridTile key={item.id} item={item} />
                ))}
              </div>
            </div>
          )}

          <div className="flex items-center justify-around border-t border-neutral-100 px-2 py-2 text-neutral-900">
            <Home className="h-5 w-5" aria-hidden="true" />
            <Search className="h-5 w-5" aria-hidden="true" />
            <span className="flex h-5 w-5 items-center justify-center rounded border-2 border-neutral-900 text-[10px] font-bold">
              +
            </span>
            <Play className="h-5 w-5" aria-hidden="true" />
            <div className="h-5 w-5 overflow-hidden rounded-full bg-neutral-200">
              {avatarUrl ? (
                <img src={avatarUrl} alt="" className="h-full w-full object-cover" />
              ) : (
                <span className="flex h-full w-full items-center justify-center text-[8px] font-bold uppercase text-neutral-600">
                  {handle.slice(0, 2)}
                </span>
              )}
            </div>
          </div>
        </div>
      </PhoneChrome>
    </div>
  );
}
