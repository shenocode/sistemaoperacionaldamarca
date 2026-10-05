import { useEffect, useState, type ReactNode } from "react";
import {
  Bookmark,
  Expand,
  ExternalLink,
  FileText,
  Heart,
  Loader2,
  MessageCircle,
  MoreHorizontal,
  Play,
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { PrintMaterialPreview } from "@/components/print-material-preview";
import { ArtTextEditorPanel, ArtTextOverlayView } from "@/components/art-text-editor";
import { brandFontsToFaceMap, brandFontsToFileMap } from "@/lib/brand-fonts";
import { cn } from "@/lib/utils";
import {
  extractYoutubeVideoId,
  isImageUrl,
  isPlayableVideoUrl,
  isPrintMaterialFormat,
  isYoutubeShortFormat,
  isYoutubeVideoFormat,
  youtubeThumbnailUrl,
  type BrandColor,
  type BrandFonts,
  type ContentFormat,
} from "@/lib/api";
import {
  YouTubeShortsMockup,
  YouTubeWatchMockup,
  YoutubeEmbedFrame,
} from "@/components/youtube-notebook-mockup";
import {
  createDefaultOverlay,
  ensureArtLayoutLayers,
  findHeadlineLayerId,
  type MediaTextOverlay,
} from "@/lib/media-text-overlay";

export type PreviewMediaItem = {
  url: string;
  kind?: "image" | "video" | "file";
  name?: string;
  overlay?: MediaTextOverlay | null;
};

export type MediaTextEditorConfig = {
  brandFonts: BrandFonts;
  colors: BrandColor[];
  /** Prefills the top-left handle layer when expanding layout layers. */
  headerLeft?: string;
  /** Prefills the top-right tagline layer when expanding layout layers. */
  headerRight?: string;
  /** Fallback copy for the headline layer when the overlay has no title text. */
  overlayText?: string;
  secondaryText?: string;
  onSave: (index: number, overlay: MediaTextOverlay) => Promise<void>;
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
  thumbnailUrl?: string | null;
  editable?: boolean;
  size?: "default" | "lg";
  materialType?: string | null;
  widthCm?: number | null;
  heightCm?: number | null;
  onCaptionChange?: (value: string) => void;
  onHashtagsChange?: (value: string) => void;
  onCtaChange?: (value: string) => void;
  className?: string;
  textEditor?: MediaTextEditorConfig;
};

function resolveKind(item: PreviewMediaItem): "image" | "video" | "file" {
  if (item.kind) {
    if (item.kind === "image" && extractYoutubeVideoId(item.url)) return "video";
    return item.kind;
  }
  if (isPlayableVideoUrl(item.url)) return "video";
  if (isImageUrl(item.url)) return "image";
  if (/\.(pdf|docx?|xlsx?|csv|txt|md|rtf|od[ts])(\?|$)/i.test(item.url)) return "file";
  return "image";
}

function previewThumbFromVideoUrl(url: string) {
  const youtubeId = extractYoutubeVideoId(url);
  return youtubeId ? youtubeThumbnailUrl(youtubeId) : `${url}#t=0.1`;
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
  expandable,
  onExpand,
}: {
  item: PreviewMediaItem;
  title: string;
  className?: string;
  autoPlay?: boolean;
  muted?: boolean;
  expandable?: boolean;
  onExpand?: () => void;
}) {
  const { t } = useTranslation();
  const kind = resolveKind(item);
  const youtubeId = extractYoutubeVideoId(item.url);

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

  const media =
    kind === "video" ? (
      youtubeId ? (
        <img
          src={youtubeThumbnailUrl(youtubeId)}
          alt={title}
          className={cn("h-full w-full object-cover", !expandable && className)}
        />
      ) : (
        <video
          src={item.url}
          controls={!autoPlay && !expandable}
          autoPlay={autoPlay}
          muted={muted ?? autoPlay}
          loop={autoPlay}
          playsInline
          className={cn("h-full w-full object-cover", !expandable && className)}
        />
      )
    ) : (
      <img
        src={item.url}
        alt={title}
        className={cn("h-full w-full object-cover", !expandable && className)}
      />
    );

  if (!expandable || !onExpand) {
    return media;
  }

  return (
    <button
      type="button"
      onClick={onExpand}
      aria-label={t("project.detail.expandMedia")}
      className={cn(
        "group relative h-full w-full cursor-zoom-in overflow-hidden",
        className,
      )}
    >
      {media}
      <span className="pointer-events-none absolute right-2 top-2 z-[1] rounded-full bg-black/55 p-1.5 text-white opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">
        <Expand className="h-3.5 w-3.5" aria-hidden="true" />
      </span>
      {kind === "video" && !autoPlay ? (
        <span className="pointer-events-none absolute inset-0 z-[1] flex items-center justify-center">
          <span className="rounded-full bg-black/55 p-3 text-white">
            <Play className="h-6 w-6 fill-white" aria-hidden="true" />
          </span>
        </span>
      ) : null}
    </button>
  );
}

function LightboxMedia({
  item,
  title,
  autoPlay,
}: {
  item: PreviewMediaItem;
  title: string;
  autoPlay?: boolean;
}) {
  const { t } = useTranslation();
  const kind = resolveKind(item);

  if (kind === "video") {
    const youtubeId = extractYoutubeVideoId(item.url);
    if (youtubeId) {
      return (
        <div className="aspect-video w-full max-w-full max-h-[min(85vh,900px)] overflow-hidden bg-black">
          <YoutubeEmbedFrame id={youtubeId} title={title} autoPlay={autoPlay} />
        </div>
      );
    }
    return (
      <video
        key={item.url}
        src={item.url}
        controls
        autoPlay={autoPlay}
        playsInline
        className="max-h-[min(85vh,900px)] max-w-full object-contain"
      />
    );
  }

  if (kind === "file") {
    return (
      <a
        href={item.url}
        target="_blank"
        rel="noreferrer"
        className="inline-flex items-center gap-2 rounded-lg bg-white/10 px-4 py-3 text-sm text-white hover:bg-white/15"
      >
        <FileText className="h-5 w-5" aria-hidden="true" />
        {t("project.detail.openFile")}
        <ExternalLink className="h-4 w-4" aria-hidden="true" />
      </a>
    );
  }

  return (
    <img
      src={item.url}
      alt={title}
      className="max-h-[min(85vh,900px)] max-w-full object-contain"
    />
  );
}

export function MediaLightbox({
  open,
  onOpenChange,
  items,
  title,
  initialIndex = 0,
  textEditor,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  items: PreviewMediaItem[];
  title: string;
  initialIndex?: number;
  textEditor?: MediaTextEditorConfig;
}) {
  const { t } = useTranslation();
  const [api, setApi] = useState<CarouselApi>();
  const [current, setCurrent] = useState(initialIndex);
  const [drafts, setDrafts] = useState<Array<MediaTextOverlay | null>>([]);
  const [selectedLayerId, setSelectedLayerId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const isCarousel = items.length > 1;
  const currentItem = items[current] ?? items[0];
  const canEdit =
    Boolean(textEditor) &&
    currentItem &&
    resolveKind(currentItem) === "image";

  useEffect(() => {
    if (!open) return;
    setCurrent(Math.min(Math.max(initialIndex, 0), Math.max(items.length - 1, 0)));
    const fontFiles = textEditor ? brandFontsToFileMap(textEditor.brandFonts) : undefined;
    const fontFaces = textEditor ? brandFontsToFaceMap(textEditor.brandFonts) : undefined;
    const nextDrafts = items.map((item) => {
      if (resolveKind(item) !== "image") return null;
      const base =
        item.overlay ??
        createDefaultOverlay({
          baseUrl: item.url,
          overlayText: textEditor?.overlayText ?? "",
          secondaryText: textEditor?.secondaryText,
          headerLeft: textEditor?.headerLeft,
          headerRight: textEditor?.headerRight,
          primaryFont: textEditor?.brandFonts.primary,
          secondaryFont: textEditor?.brandFonts.secondary,
          colors: textEditor?.colors,
          fontFiles,
        });
      const withLayout = ensureArtLayoutLayers(base, {
        overlayText: textEditor?.overlayText,
        secondaryText: textEditor?.secondaryText,
        headerLeft: textEditor?.headerLeft,
        headerRight: textEditor?.headerRight,
        primaryFont: textEditor?.brandFonts.primary,
        secondaryFont: textEditor?.brandFonts.secondary,
        colors: textEditor?.colors,
        fontFiles,
      });
      return {
        ...withLayout,
        fontFiles: fontFiles ?? withLayout.fontFiles,
        fontFaces: fontFaces ?? withLayout.fontFaces,
      };
    });
    setDrafts(nextDrafts);
    const start = Math.min(Math.max(initialIndex, 0), Math.max(nextDrafts.length - 1, 0));
    setSelectedLayerId(findHeadlineLayerId(nextDrafts[start]));
    // Snapshot overlays when the lightbox opens so in-progress edits are not reset.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    if (!api || !open) return;
    api.scrollTo(Math.min(Math.max(initialIndex, 0), Math.max(items.length - 1, 0)), true);
    const sync = () => setCurrent(api.selectedScrollSnap());
    sync();
    api.on("select", sync);
    return () => {
      api.off("select", sync);
    };
  }, [api, open, initialIndex, items.length]);

  useEffect(() => {
    const overlay = drafts[current];
    setSelectedLayerId((id) => {
      if (overlay?.layers.some((layer) => layer.id === id)) return id;
      return findHeadlineLayerId(overlay);
    });
  }, [current, drafts]);

  if (items.length === 0) return null;

  const draft = drafts[current] ?? null;

  function updateDraft(next: MediaTextOverlay) {
    setDrafts((prev) => prev.map((item, index) => (index === current ? next : item)));
  }

  async function handleSave() {
    if (!textEditor || !draft) return;
    setSaving(true);
    try {
      await textEditor.onSave(current, draft);
      onOpenChange(false);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn(
          "flex max-w-none flex-col gap-0 overflow-hidden overflow-y-hidden border-0 bg-black p-0 text-white shadow-2xl sm:rounded-xl",
          canEdit
            ? "h-[100dvh] w-[100vw] max-h-[100dvh] rounded-none sm:h-[min(94dvh,980px)] sm:w-[min(98vw,1280px)] sm:rounded-xl"
            : "h-[100dvh] w-[100vw] max-h-[100dvh] rounded-none sm:h-[min(92dvh,960px)] sm:w-[min(96vw,1100px)] sm:rounded-xl",
        )}
        aria-describedby={undefined}
      >
        <DialogTitle className="sr-only">{t("project.detail.mediaViewer")}</DialogTitle>
        <DialogDescription className="sr-only">{title}</DialogDescription>

        <div className={cn("flex min-h-0 flex-1", canEdit && "flex-col lg:flex-row")}>
          <div className="relative flex min-h-0 min-w-0 flex-1 items-center justify-center bg-black px-4 py-10 sm:px-12">
            {isCarousel ? (
              <Carousel setApi={setApi} opts={{ loop: false, startIndex: initialIndex }} className="h-full w-full">
                <CarouselContent className="ml-0 h-full">
                  {items.map((item, index) => (
                    <CarouselItem key={`${item.url}-lightbox-${index}`} className="basis-full pl-0">
                      <div className="flex h-full min-h-[50vh] items-center justify-center">
                        {canEdit && drafts[index] && resolveKind(item) === "image" && index === current ? (
                          <ArtTextOverlayView
                            overlay={drafts[index]!}
                            selectedId={selectedLayerId}
                            interactive
                            onSelect={setSelectedLayerId}
                            onMove={(id, x, y) => {
                              const currentDraft = drafts[index];
                              if (!currentDraft) return;
                              updateDraft({
                                ...currentDraft,
                                layers: currentDraft.layers.map((layer) =>
                                  layer.id === id ? { ...layer, x, y } : layer,
                                ),
                              });
                            }}
                            className="h-full w-full"
                          />
                        ) : (
                          <LightboxMedia
                            item={item}
                            title={`${title} ${index + 1}`}
                            autoPlay={open && index === current && resolveKind(item) === "video"}
                          />
                        )}
                      </div>
                    </CarouselItem>
                  ))}
                </CarouselContent>
                <CarouselPrevious className="left-2 z-20 h-10 w-10 border-0 bg-white/15 text-white hover:bg-white/25 hover:text-white disabled:opacity-30" />
                <CarouselNext className="right-2 z-20 h-10 w-10 border-0 bg-white/15 text-white hover:bg-white/25 hover:text-white disabled:opacity-30" />
              </Carousel>
            ) : canEdit && draft ? (
              <ArtTextOverlayView
                overlay={draft}
                selectedId={selectedLayerId}
                interactive
                onSelect={setSelectedLayerId}
                onMove={(id, x, y) => {
                  updateDraft({
                    ...draft,
                    layers: draft.layers.map((layer) => (layer.id === id ? { ...layer, x, y } : layer)),
                  });
                }}
                className="h-full w-full"
              />
            ) : (
              <LightboxMedia
                item={items[0]}
                title={title}
                autoPlay={open && resolveKind(items[0]) === "video"}
              />
            )}

            {isCarousel ? (
              <>
                <div className="absolute bottom-3 left-0 right-0 flex items-center justify-center gap-1.5">
                  {items.map((_, index) => (
                    <button
                      key={index}
                      type="button"
                      aria-label={`${t("project.detail.slide")} ${index + 1}`}
                      className={cn(
                        "h-1.5 rounded-full transition-all",
                        index === current ? "w-4 bg-white" : "w-1.5 bg-white/50",
                      )}
                      onClick={() => api?.scrollTo(index)}
                    />
                  ))}
                </div>
                <span className="absolute left-4 top-4 rounded-full bg-black/60 px-2.5 py-1 text-xs font-medium text-white">
                  {current + 1}/{items.length}
                </span>
              </>
            ) : null}
          </div>

          {canEdit && draft && textEditor ? (
            <div className="flex w-full min-h-0 max-h-[42dvh] shrink-0 flex-col overflow-y-auto border-t border-white/10 bg-background lg:max-h-none lg:w-[340px] lg:border-l lg:border-t-0">
              <ArtTextEditorPanel
                overlay={draft}
                selectedId={selectedLayerId}
                onSelect={setSelectedLayerId}
                onChange={updateDraft}
                brandFonts={textEditor.brandFonts}
                colors={textEditor.colors}
              />
              <div className="border-t p-4">
                <Button type="button" className="w-full" disabled={saving} onClick={() => void handleSave()}>
                  {saving ? (
                    <>
                      <Loader2 className="size-4 animate-spin" />
                      {t("project.detail.artText.saving")}
                    </>
                  ) : (
                    t("project.detail.artText.save")
                  )}
                </Button>
              </div>
            </div>
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function toInstagramHandle(value: string) {
  return toHandle(value);
}

export function PhoneChrome({
  children,
  size = "default",
  className,
}: {
  children: ReactNode;
  size?: "default" | "lg";
  className?: string;
}) {
  return (
    <div
      className={cn(
        "mx-auto w-full overflow-x-clip",
        size === "lg" ? "max-w-[min(100%,420px)]" : "max-w-[min(100%,320px)]",
        className,
      )}
    >
      <div
        className={cn(
          "relative border border-neutral-800 bg-neutral-950 shadow-[0_25px_60px_-20px_rgba(0,0,0,0.45)]",
          size === "lg" ? "rounded-[2.8rem] p-[12px]" : "rounded-[2.4rem] p-[10px]",
        )}
      >
        <div
          className={cn(
            "pointer-events-none absolute left-1/2 z-20 -translate-x-1/2 rounded-full bg-black",
            size === "lg"
              ? "top-[20px] h-[28px] w-[min(110px,40%)]"
              : "top-[18px] h-[26px] w-[min(96px,42%)]",
          )}
        />
        <div className="pointer-events-none absolute right-0 top-[120px] h-14 w-[3px] rounded-l-sm bg-neutral-700" />
        <div className="pointer-events-none absolute left-0 top-[100px] h-8 w-[3px] rounded-r-sm bg-neutral-700" />
        <div className="pointer-events-none absolute left-0 top-[140px] h-12 w-[3px] rounded-r-sm bg-neutral-700" />
        <div
          className={cn(
            "overflow-hidden bg-white",
            size === "lg" ? "rounded-[2.2rem]" : "rounded-[1.9rem]",
          )}
        >
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
  editable,
  onCaptionChange,
  onHashtagsChange,
  onCtaChange,
}: {
  username: string;
  caption?: string;
  hashtags?: string;
  cta?: string;
  editable?: boolean;
  onCaptionChange?: (value: string) => void;
  onHashtagsChange?: (value: string) => void;
  onCtaChange?: (value: string) => void;
}) {
  const { t } = useTranslation();
  const hasBody = Boolean(caption?.trim() || hashtags?.trim() || cta?.trim());

  if (editable) {
    return (
      <div className="space-y-2 px-3 pb-3">
        <p className="text-[12px] font-semibold text-neutral-900">
          {t("project.detail.previewLikes", { count: 128 })}
        </p>
        <div className="space-y-1.5">
          <p className="text-[12px] font-semibold text-neutral-900">{username}</p>
          <textarea
            value={caption ?? ""}
            onChange={(e) => onCaptionChange?.(e.target.value)}
            rows={3}
            placeholder={t("project.detail.caption")}
            aria-label={t("project.detail.caption")}
            className="w-full resize-none rounded-md border border-neutral-200 bg-white px-2 py-1.5 text-[12px] leading-snug text-neutral-900 outline-none ring-sky-400 focus:ring-2"
          />
          <input
            value={cta ?? ""}
            onChange={(e) => onCtaChange?.(e.target.value)}
            placeholder={t("project.detail.cta")}
            aria-label={t("project.detail.cta")}
            className="w-full rounded-md border border-neutral-200 bg-white px-2 py-1.5 text-[12px] font-medium text-neutral-700 outline-none ring-sky-400 focus:ring-2"
          />
          <textarea
            value={hashtags ?? ""}
            onChange={(e) => onHashtagsChange?.(e.target.value)}
            rows={2}
            placeholder={t("project.detail.hashtags")}
            aria-label={t("project.detail.hashtags")}
            className="w-full resize-none rounded-md border border-neutral-200 bg-white px-2 py-1.5 text-[12px] leading-snug text-sky-700 outline-none ring-sky-400 focus:ring-2"
          />
        </div>
        <p className="text-[10px] uppercase tracking-wide text-neutral-400">
          {t("project.detail.previewTime")}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-1.5 px-3 pb-3">
      <p className="text-[12px] font-semibold text-neutral-900">
        {t("project.detail.previewLikes", { count: 128 })}
      </p>
      {hasBody ? (
        <p className="text-[12px] leading-snug text-neutral-900">
          <span className="font-semibold">{username}</span>{" "}
          {caption?.trim() ? <span>{caption.trim()}</span> : null}
          {cta?.trim() ? (
            <span className="mt-1 block font-medium text-neutral-700">{cta.trim()}</span>
          ) : null}
          {hashtags?.trim() ? (
            <span className="mt-1 block text-sky-700">{hashtags.trim()}</span>
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
  thumbnailUrl,
  editable,
  size = "default",
  materialType,
  widthCm,
  heightCm,
  onCaptionChange,
  onHashtagsChange,
  onCtaChange,
  className,
  textEditor,
}: ContentMediaPreviewProps) {
  const { t } = useTranslation();
  const [api, setApi] = useState<CarouselApi>();
  const [current, setCurrent] = useState(0);
  const [muted, setMuted] = useState(true);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(0);
  const isPrint = isPrintMaterialFormat(format);
  const isYoutube = isYoutubeVideoFormat(format);

  useEffect(() => {
    if (!api || isPrint || isYoutube) return;
    const sync = () => setCurrent(api.selectedScrollSnap());
    sync();
    api.on("select", sync);
    return () => {
      api.off("select", sync);
    };
  }, [api, isPrint, isYoutube]);

  if (isPrint) {
    return (
      <PrintMaterialPreview
        items={items}
        title={title}
        materialType={materialType}
        widthCm={widthCm}
        heightCm={heightCm}
        size={size}
        className={className}
      />
    );
  }

  if (isYoutube) {
    const videoUrl = items.find((item) => resolveKind(item) === "video")?.url ?? null;
    const imageFromMedia = items.find((item) => resolveKind(item) === "image")?.url ?? null;
    const thumb =
      thumbnailUrl?.trim() ||
      imageFromMedia ||
      (videoUrl ? previewThumbFromVideoUrl(videoUrl) : null);
    const lightboxItems =
      items.length > 0 ? items : videoUrl ? [{ url: videoUrl, kind: "video" as const }] : [];
    const openYoutubeLightbox = () => {
      if (lightboxItems.length === 0) return;
      setLightboxIndex(0);
      setLightboxOpen(true);
    };
    const shared = {
      title,
      caption,
      hashtags,
      cta,
      username,
      avatarUrl,
      thumbnailUrl: thumb,
      videoUrl,
      size,
      className,
      onExpand: lightboxItems.length > 0 ? openYoutubeLightbox : undefined,
    };
    return (
      <>
        {isYoutubeShortFormat(format) ? (
          <YouTubeShortsMockup {...shared} />
        ) : (
          <YouTubeWatchMockup {...shared} />
        )}
        <MediaLightbox
          open={lightboxOpen}
          onOpenChange={setLightboxOpen}
          items={lightboxItems}
          title={title}
          initialIndex={lightboxIndex}
        />
      </>
    );
  }

  const handle = toHandle(username || title || "marca");
  const isStories = format === "stories";
  const isReels = format === "reels";

  const openLightbox = (index = 0) => {
    if (items.length === 0) return;
    if (resolveKind(items[Math.min(index, items.length - 1)]) === "file") return;
    setLightboxIndex(Math.min(Math.max(index, 0), items.length - 1));
    setLightboxOpen(true);
  };

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
                    <MediaSlide
                      item={item}
                      title={`${title} ${index + 1}`}
                      expandable={resolveKind(item) !== "file"}
                      onExpand={() => openLightbox(index)}
                    />
                  </div>
                </CarouselItem>
              ))}
            </CarouselContent>
            {items.length > 1 ? (
              <>
                <CarouselPrevious className="left-2 z-10 h-7 w-7 border-0 bg-black/40 text-white hover:bg-black/60 hover:text-white" />
                <CarouselNext className="right-2 z-10 h-7 w-7 border-0 bg-black/40 text-white hover:bg-black/60 hover:text-white" />
              </>
            ) : null}
          </Carousel>
          {items.length > 1 ? (
            <div className="absolute bottom-2 left-0 right-0 z-10 flex items-center justify-center gap-1">
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
          <span className="absolute right-2 top-2 z-10 rounded-full bg-black/60 px-2 py-0.5 text-[10px] font-medium text-white">
            {current + 1}/{items.length}
          </span>
        </div>
      );
    }

    return (
      <div className={cn("relative bg-black", aspectClass)}>
        <MediaSlide
          item={items[0]}
          title={title}
          expandable={resolveKind(items[0]) !== "file"}
          onExpand={() => openLightbox(0)}
        />
      </div>
    );
  };

  const lightbox = (
    <MediaLightbox
      open={lightboxOpen}
      onOpenChange={setLightboxOpen}
      items={items}
      title={title}
      initialIndex={lightboxIndex}
      textEditor={textEditor}
    />
  );

  if (isStories) {
    return (
      <>
        <PhoneChrome size={size} className={className}>
          <div className="relative aspect-[9/16] bg-black">
            {items.length === 0 ? (
              <div className="flex h-full items-center justify-center text-xs text-white/50">
                {t("project.detail.noPreview")}
              </div>
            ) : (
              <MediaSlide
                item={items[0]}
                title={title}
                autoPlay
                muted={muted}
                expandable={resolveKind(items[0]) !== "file"}
                onExpand={() => openLightbox(0)}
              />
            )}
            <div className="pointer-events-none absolute inset-x-0 top-0 bg-gradient-to-b from-black/55 to-transparent px-3 pb-8 pt-2">
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
            <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent px-3 pb-5 pt-10">
              {editable ? (
                <div className="space-y-1.5">
                  <textarea
                    value={caption ?? ""}
                    onChange={(e) => onCaptionChange?.(e.target.value)}
                    rows={2}
                    placeholder={t("project.detail.caption")}
                    aria-label={t("project.detail.caption")}
                    className="w-full resize-none rounded-md border border-white/20 bg-black/40 px-2 py-1.5 text-[12px] text-white outline-none ring-white/40 placeholder:text-white/50 focus:ring-2"
                  />
                  <input
                    value={cta ?? ""}
                    onChange={(e) => onCtaChange?.(e.target.value)}
                    placeholder={t("project.detail.cta")}
                    aria-label={t("project.detail.cta")}
                    className="w-full rounded-md border border-white/20 bg-black/40 px-2 py-1.5 text-[11px] font-medium text-white outline-none ring-white/40 placeholder:text-white/50 focus:ring-2"
                  />
                </div>
              ) : (
                <>
                  {caption ? <p className="text-[12px] text-white">{caption}</p> : null}
                  {cta ? <p className="mt-1 text-[11px] font-medium text-white/90">{cta}</p> : null}
                </>
              )}
            </div>
          </div>
        </PhoneChrome>
        {lightbox}
      </>
    );
  }

  if (isReels) {
    return (
      <>
        <PhoneChrome size={size} className={className}>
          <div className="relative aspect-[9/16] bg-black">
            {items.length === 0 ? (
              <div className="flex h-full items-center justify-center text-xs text-white/50">
                {t("project.detail.noPreview")}
              </div>
            ) : (
              <MediaSlide
                item={items[0]}
                title={title}
                autoPlay
                muted={muted}
                className="absolute inset-0"
                expandable={resolveKind(items[0]) !== "file"}
                onExpand={() => openLightbox(0)}
              />
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
              {editable ? (
                <div className="space-y-1.5">
                  <textarea
                    value={caption ?? ""}
                    onChange={(e) => onCaptionChange?.(e.target.value)}
                    rows={2}
                    placeholder={t("project.detail.caption")}
                    aria-label={t("project.detail.caption")}
                    className="w-full resize-none rounded-md border border-white/20 bg-black/40 px-2 py-1.5 text-[12px] text-white outline-none ring-white/40 placeholder:text-white/50 focus:ring-2"
                  />
                  <input
                    value={cta ?? ""}
                    onChange={(e) => onCtaChange?.(e.target.value)}
                    placeholder={t("project.detail.cta")}
                    aria-label={t("project.detail.cta")}
                    className="w-full rounded-md border border-white/20 bg-black/40 px-2 py-1.5 text-[11px] font-medium text-white outline-none ring-white/40 placeholder:text-white/50 focus:ring-2"
                  />
                  <textarea
                    value={hashtags ?? ""}
                    onChange={(e) => onHashtagsChange?.(e.target.value)}
                    rows={2}
                    placeholder={t("project.detail.hashtags")}
                    aria-label={t("project.detail.hashtags")}
                    className="w-full resize-none rounded-md border border-white/20 bg-black/40 px-2 py-1.5 text-[11px] text-white/90 outline-none ring-white/40 placeholder:text-white/50 focus:ring-2"
                  />
                </div>
              ) : (
                <>
                  {caption ? <p className="line-clamp-3 text-[12px]">{caption}</p> : null}
                  {cta ? <p className="text-[11px] font-medium text-white/90">{cta}</p> : null}
                  {hashtags ? <p className="line-clamp-2 text-[11px] text-white/80">{hashtags}</p> : null}
                </>
              )}
            </div>
            <div className="pointer-events-none absolute bottom-6 right-3 flex flex-col items-center gap-4 text-white">
              <Heart className="h-6 w-6" aria-hidden="true" />
              <MessageCircle className="h-6 w-6 -scale-x-100" aria-hidden="true" />
              <Send className="h-5 w-5" aria-hidden="true" />
              <Bookmark className="h-6 w-6" aria-hidden="true" />
            </div>
          </div>
        </PhoneChrome>
        {lightbox}
      </>
    );
  }

  return (
    <>
      <PhoneChrome size={size} className={className}>
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
        {mediaFrame(t("project.detail.noPreview"), "aspect-[4/5]")}
        <ActionBar />
        <CaptionBlock
          username={handle}
          caption={caption}
          hashtags={hashtags}
          cta={cta}
          editable={editable}
          onCaptionChange={onCaptionChange}
          onHashtagsChange={onHashtagsChange}
          onCtaChange={onCtaChange}
        />
      </PhoneChrome>
      {lightbox}
    </>
  );
}

export function guessMediaKind(file: File): PreviewMediaItem["kind"] {
  if (file.type.startsWith("video/")) return "video";
  if (file.type.startsWith("image/")) return "image";
  return "file";
}
