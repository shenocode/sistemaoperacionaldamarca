import { useRef, useState, type DragEvent } from "react";
import { Link } from "@tanstack/react-router";
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
  StatusBadge,
  type ContentStatus,
} from "@/components/status-badge";
import {
  isVideoUrl,
  resolveContentMediaUrls,
  getLocalizedText,
  normalizeAppLocale,
  type ContentFormat,
  type ContentItem,
} from "@/lib/api";
import { cn } from "@/lib/utils";

type InstagramFeedMockupProps = {
  items: ContentItem[];
  clientId: string;
  projectId: string;
  username?: string | null;
  avatarUrl?: string | null;
  className?: string;
  canReorder?: boolean;
  onReorder?: (nextListOrder: ContentItem[]) => void;
  /** When false, hides the “Prévia do feed” caption above the phone. */
  showLabel?: boolean;
};

/** Conteúdo "em produção" não entra na simulação do feed. */
function isVisibleInFeedSimulation(item: ContentItem) {
  return item.status !== "draft";
}

function moveItem<T>(items: T[], from: number, to: number): T[] {
  if (from === to || from < 0 || to < 0 || from >= items.length || to >= items.length) {
    return items;
  }
  const next = [...items];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}

/** Reaplica a nova ordem dos itens visíveis mantendo os ocultos nas posições originais. */
function mergeVisibleListOrder(
  allItems: ContentItem[],
  nextVisibleListOrder: ContentItem[],
): ContentItem[] {
  const queue = [...nextVisibleListOrder];
  return allItems.map((item) => {
    if (!isVisibleInFeedSimulation(item)) return item;
    return queue.shift() ?? item;
  });
}

function coverUrl(item: ContentItem) {
  const dedicated = item.thumbnail_url?.trim();
  if (dedicated) return dedicated;
  return resolveContentMediaUrls(item)[0] ?? null;
}

function formatBadge(format: ContentFormat, cover: string | null) {
  if (format === "carousel") return "carousel" as const;
  if (format === "reels") return "reels" as const;
  if (format === "recorded_video" || format === "youtube_short") return "video" as const;
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

function GridTile({
  item,
  clientId,
  projectId,
  canReorder,
  isDragging,
  isDropTarget,
  onDragStart,
  onDragOver,
  onDrop,
  onDragEnd,
}: {
  item: ContentItem;
  clientId: string;
  projectId: string;
  canReorder: boolean;
  isDragging: boolean;
  isDropTarget: boolean;
  onDragStart: (event: DragEvent<HTMLAnchorElement>) => void;
  onDragOver: (event: DragEvent<HTMLAnchorElement>) => void;
  onDrop: (event: DragEvent<HTMLAnchorElement>) => void;
  onDragEnd: () => void;
}) {
  const { t, i18n } = useTranslation();
  const uiLocale = normalizeAppLocale(i18n.resolvedLanguage ?? i18n.language);
  const displayTitle = getLocalizedText(item.i18n, "title", item.title, uiLocale);
  const cover = coverUrl(item);
  const badge = formatBadge(item.format, cover);
  const status = item.status as ContentStatus;
  const statusLabel = t(`project.content.status.${status}`);
  const suppressClickRef = useRef(false);

  return (
    <Link
      to="/clients/$clientId/projects/$projectId/content/$contentId"
      params={{ clientId, projectId, contentId: item.id }}
      draggable={canReorder}
      onDragStart={
        canReorder
          ? (event) => {
              suppressClickRef.current = true;
              onDragStart(event);
            }
          : undefined
      }
      onDragOver={canReorder ? onDragOver : undefined}
      onDrop={canReorder ? onDrop : undefined}
      onDragEnd={
        canReorder
          ? () => {
              onDragEnd();
              window.setTimeout(() => {
                suppressClickRef.current = false;
              }, 50);
            }
          : undefined
      }
      onClick={(event) => {
        if (suppressClickRef.current) {
          event.preventDefault();
        }
      }}
      aria-label={`${displayTitle} — ${statusLabel}`}
      className={cn(
        "group relative aspect-[4/5] bg-neutral-100 outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-neutral-900/50",
        canReorder ? "cursor-grab active:cursor-grabbing" : "cursor-pointer",
        isDragging && "opacity-50",
        isDropTarget && "ring-2 ring-inset ring-neutral-900/40",
      )}
    >
      {cover ? (
        <CoverMedia url={cover} title={displayTitle} />
      ) : (
        <div className="flex h-full items-center justify-center px-1 text-center text-[8px] leading-tight text-neutral-400">
          {t("project.detail.noPreview")}
        </div>
      )}
      {badge === "carousel" ? (
        <SquareStack
          className="absolute right-1 top-1 z-[1] h-3.5 w-3.5 text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.55)]"
          aria-hidden="true"
        />
      ) : null}
      {badge === "reels" || badge === "video" ? (
        <Clapperboard
          className="absolute right-1 top-1 z-[1] h-3.5 w-3.5 text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.55)]"
          aria-hidden="true"
        />
      ) : null}
      <span
        className="pointer-events-none absolute inset-0 z-[2] flex items-center justify-center bg-black/50 p-1 opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100"
        aria-hidden="true"
      >
        <StatusBadge
          status={status}
          asButton
          className="h-auto max-w-full whitespace-normal px-1.5 py-1 text-center text-[8px] leading-tight shadow-md hover:bg-inherit"
        />
      </span>
    </Link>
  );
}

export function InstagramFeedMockup({
  items,
  clientId,
  projectId,
  username,
  avatarUrl,
  className,
  canReorder = false,
  onReorder,
  showLabel = true,
}: InstagramFeedMockupProps) {
  const { t } = useTranslation();
  const handle = toInstagramHandle(username || "marca");
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [dropIndex, setDropIndex] = useState<number | null>(null);

  // Simulação: exclui "em produção" (draft). Feed Instagram: inverso da lista.
  const visibleItems = items.filter(isVisibleInFeedSimulation);
  const feedItems = [...visibleItems].toReversed();
  const allowReorder = canReorder && feedItems.length > 1;

  const onDragStart = (index: number) => (event: DragEvent<HTMLAnchorElement>) => {
    setDragIndex(index);
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", String(index));
  };

  const onDragOver = (index: number) => (event: DragEvent<HTMLAnchorElement>) => {
    if (!allowReorder) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
    if (dropIndex !== index) setDropIndex(index);
  };

  const onDrop = (index: number) => (event: DragEvent<HTMLAnchorElement>) => {
    event.preventDefault();
    if (!allowReorder) return;
    const from = dragIndex ?? Number(event.dataTransfer.getData("text/plain"));
    setDragIndex(null);
    setDropIndex(null);
    if (!Number.isFinite(from)) return;
    const nextFeed = moveItem(feedItems, from, index);
    if (nextFeed === feedItems) return;
    onReorder?.(mergeVisibleListOrder(items, nextFeed.toReversed()));
  };

  const onDragEnd = () => {
    setDragIndex(null);
    setDropIndex(null);
  };

  return (
    <div className={cn("mx-auto w-full max-w-[min(100%,320px)]", className)}>
      {showLabel ? (
        <p className="mb-2 text-center text-xs font-medium text-muted-foreground">
          {t("project.content.feedPreview")}
        </p>
      ) : null}
      <PhoneChrome>
        <div className="flex h-[min(70vh,560px)] min-h-[420px] flex-col bg-white sm:h-[560px] sm:min-h-0">
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
                {feedItems.map((item, index) => (
                  <GridTile
                    key={item.id}
                    item={item}
                    clientId={clientId}
                    projectId={projectId}
                    canReorder={allowReorder}
                    isDragging={dragIndex === index}
                    isDropTarget={
                      dropIndex === index && dragIndex !== null && dragIndex !== index
                    }
                    onDragStart={onDragStart(index)}
                    onDragOver={onDragOver(index)}
                    onDrop={onDrop(index)}
                    onDragEnd={onDragEnd}
                  />
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
