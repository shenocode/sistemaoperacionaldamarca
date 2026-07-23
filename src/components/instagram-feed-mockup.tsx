import {
  Bookmark,
  Heart,
  Home,
  MessageCircle,
  MoreHorizontal,
  Play,
  Search,
  Send,
  SquareStack,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import {
  PhoneChrome,
  toInstagramHandle,
} from "@/components/content-media-preview";
import { resolveContentMediaUrls, type ContentFormat, type ContentItem } from "@/lib/api";
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

function formatBadge(format: ContentFormat) {
  if (format === "carousel") return "carousel";
  if (format === "reels") return "reels";
  return null;
}

function FeedPost({
  item,
  username,
  avatarUrl,
}: {
  item: ContentItem;
  username: string;
  avatarUrl?: string | null;
}) {
  const { t } = useTranslation();
  const cover = coverUrl(item);
  const badge = formatBadge(item.format);
  const caption = item.caption?.trim();

  return (
    <article className="border-b border-neutral-100">
      <div className="flex items-center gap-2 px-3 py-2">
        <div className="h-7 w-7 shrink-0 overflow-hidden rounded-full bg-gradient-to-tr from-amber-400 via-pink-500 to-purple-600 p-[1.5px]">
          <div className="flex h-full w-full items-center justify-center overflow-hidden rounded-full bg-white">
            {avatarUrl ? (
              <img src={avatarUrl} alt="" className="h-full w-full object-cover" />
            ) : (
              <span className="text-[9px] font-bold uppercase text-neutral-700">
                {username.slice(0, 2)}
              </span>
            )}
          </div>
        </div>
        <p className="min-w-0 flex-1 truncate text-[12px] font-semibold text-neutral-900">
          {username}
        </p>
        <MoreHorizontal className="h-4 w-4 text-neutral-900" aria-hidden="true" />
      </div>

      <div className="relative aspect-[4/5] bg-neutral-100">
        {cover ? (
          <img src={cover} alt={item.title} className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full items-center justify-center px-4 text-center text-[11px] text-neutral-400">
            {t("project.detail.noPreview")}
          </div>
        )}
        {badge === "carousel" ? (
          <SquareStack
            className="absolute right-2 top-2 h-4 w-4 text-white drop-shadow"
            aria-hidden="true"
          />
        ) : null}
        {badge === "reels" ? (
          <Play
            className="absolute right-2 top-2 h-4 w-4 fill-white text-white drop-shadow"
            aria-hidden="true"
          />
        ) : null}
      </div>

      <div className="flex items-center justify-between px-3 py-2">
        <div className="flex items-center gap-3">
          <Heart className="h-[20px] w-[20px] text-neutral-900" aria-hidden="true" />
          <MessageCircle className="h-[20px] w-[20px] -scale-x-100 text-neutral-900" aria-hidden="true" />
          <Send className="h-[18px] w-[18px] text-neutral-900" aria-hidden="true" />
        </div>
        <Bookmark className="h-[20px] w-[20px] text-neutral-900" aria-hidden="true" />
      </div>

      <div className="space-y-1 px-3 pb-3">
        <p className="text-[12px] font-semibold text-neutral-900">
          {t("project.detail.previewLikes", { count: 128 })}
        </p>
        {caption ? (
          <p className="line-clamp-2 text-[12px] leading-snug text-neutral-900">
            <span className="font-semibold">{username}</span> {caption}
          </p>
        ) : (
          <p className="line-clamp-2 text-[12px] leading-snug text-neutral-900">
            <span className="font-semibold">{username}</span> {item.title}
          </p>
        )}
      </div>
    </article>
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

  // Ordem cronológica desde o início do projeto (mais antigo no topo).
  const feedItems = [...items].sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
  );

  return (
    <div className={cn("w-full max-w-[320px]", className)}>
      <p className="mb-2 text-center text-xs font-medium text-muted-foreground">
        {t("project.content.feedPreview")}
      </p>
      <PhoneChrome>
        <div className="flex h-[560px] flex-col bg-white">
          <div className="flex items-center justify-between border-b border-neutral-100 px-3 py-2">
            <span className="text-[15px] font-semibold tracking-tight text-neutral-900">
              Instagram
            </span>
            <div className="flex items-center gap-3 text-neutral-900">
              <Heart className="h-5 w-5" aria-hidden="true" />
              <Send className="h-[18px] w-[18px]" aria-hidden="true" />
            </div>
          </div>

          {feedItems.length === 0 ? (
            <div className="flex flex-1 items-center justify-center px-6 text-center text-xs text-neutral-400">
              {t("project.content.feedEmpty")}
            </div>
          ) : (
            <div className="flex-1 overflow-y-auto overscroll-contain">
              {feedItems.map((item) => (
                <FeedPost
                  key={item.id}
                  item={item}
                  username={handle}
                  avatarUrl={avatarUrl}
                />
              ))}
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
