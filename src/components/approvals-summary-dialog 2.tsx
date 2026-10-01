import { useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Check,
  ClipboardCopy,
  Download,
  ExternalLink,
  FileText,
  Loader2,
  Play,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  isImageUrl,
  isPlayableVideoUrl,
  resolveDownloadableContentMedia,
  type ContentFormat,
  type ContentItem,
  type DownloadableContentMedia,
} from "@/lib/api";
import {
  fileNameFromMediaUrl,
  shareOrDownloadFiles,
  type ShareOrDownloadResult,
} from "@/lib/download-image";
import { composePublishCaption } from "@/lib/publish-caption";
import {
  getLocalizedText,
  normalizeAppLocale,
  parseRowI18n,
} from "@/lib/i18n-content";
import { cn } from "@/lib/utils";

export type ApprovalsSummaryDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  blockTitle: string;
  items: ContentItem[];
};

function mediaKind(url: string): "image" | "video" | "file" {
  if (isPlayableVideoUrl(url)) return "video";
  if (isImageUrl(url)) return "image";
  return "file";
}

async function copyText(text: string) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }
  const el = document.createElement("textarea");
  el.value = text;
  el.setAttribute("readonly", "");
  el.style.position = "fixed";
  el.style.left = "-9999px";
  document.body.appendChild(el);
  el.select();
  document.execCommand("copy");
  document.body.removeChild(el);
}

function notifyDownloadResult(
  result: ShareOrDownloadResult,
  t: ReturnType<typeof useTranslation>["t"],
) {
  if (result === "shared") {
    toast.success(t("project.calendar.approvalsSummary.downloadShared"));
  } else if (result === "downloaded") {
    toast.success(t("project.calendar.approvalsSummary.downloadStarted"));
  }
}

function mediaDownloadItems(items: DownloadableContentMedia[], title: string) {
  const fallback = title.trim() || "conteudo";
  return items.map((item, i) => {
    const fromUrl = fileNameFromMediaUrl(item.url, `${fallback}-${i + 1}`);
    return {
      url: item.url,
      role: item.role,
      name: item.role === "cover" ? `capa-${fromUrl}` : fromUrl,
    };
  });
}

function ApprovedItemRow({
  item,
  index,
  total,
}: {
  item: ContentItem;
  index: number;
  total: number;
}) {
  const { t, i18n } = useTranslation();
  const [copied, setCopied] = useState(false);
  const [downloadingKey, setDownloadingKey] = useState<string | null>(null);
  const uiLocale = normalizeAppLocale(i18n.resolvedLanguage ?? i18n.language);
  const rowI18n = parseRowI18n(item.i18n);
  const title = getLocalizedText(rowI18n, "title", item.title, uiLocale);
  const caption = getLocalizedText(rowI18n, "caption", item.caption ?? "", uiLocale);
  const cta = getLocalizedText(rowI18n, "cta", item.cta ?? "", uiLocale);
  const hashtags = getLocalizedText(rowI18n, "hashtags", item.hashtags ?? "", uiLocale);
  const publishText = composePublishCaption({ caption, cta, hashtags });
  const downloadableMedia = resolveDownloadableContentMedia(item);
  const mediaUrls = downloadableMedia.map((entry) => entry.url);
  const primaryUrl = mediaUrls[0] ?? null;
  const primaryKind = primaryUrl ? mediaKind(primaryUrl) : null;
  const formatKey = (item.format ?? "static_feed") as ContentFormat;
  const isDownloading = downloadingKey !== null;
  let mediaFileNumber = 0;
  const listedMedia = downloadableMedia.map((entry) => ({
    ...entry,
    n: entry.role === "cover" ? undefined : ++mediaFileNumber,
  }));

  async function handleCopy() {
    if (!publishText.trim()) {
      toast.error(t("project.calendar.approvalsSummary.noCaption"));
      return;
    }
    try {
      await copyText(publishText);
      setCopied(true);
      toast.success(t("project.calendar.approvalsSummary.copied"));
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error(t("project.calendar.approvalsSummary.copyFailed"));
    }
  }

  async function handleDownload(items: DownloadableContentMedia[], key: string) {
    if (items.length === 0) {
      toast.error(t("project.calendar.approvalsSummary.noDownloadableMedia"));
      return;
    }
    setDownloadingKey(key);
    try {
      const result = await shareOrDownloadFiles(mediaDownloadItems(items, title));
      notifyDownloadResult(result, t);
    } catch {
      toast.error(t("project.calendar.approvalsSummary.downloadError"));
    } finally {
      setDownloadingKey(null);
    }
  }

  return (
    <article
      className={cn(
        "space-y-4 py-6",
        index < total - 1 && "border-b border-border/80",
      )}
    >
      <header className="space-y-0.5">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {t("project.calendar.approvalsSummary.itemLabel", {
            n: index + 1,
            total,
          })}
          {" · "}
          {t(`project.detail.formats.${formatKey}`)}
        </p>
        <h3 className="text-base font-semibold leading-snug text-foreground">{title}</h3>
      </header>

      <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
        <div className="w-full shrink-0 sm:w-44">
          {primaryUrl && primaryKind === "image" ? (
            <a
              href={primaryUrl}
              target="_blank"
              rel="noreferrer"
              className="block overflow-hidden rounded-md border bg-muted"
            >
              <img
                src={primaryUrl}
                alt={title}
                className="aspect-square w-full object-cover"
              />
            </a>
          ) : primaryUrl && primaryKind === "video" ? (
            <a
              href={primaryUrl}
              target="_blank"
              rel="noreferrer"
              className="relative flex aspect-square items-center justify-center overflow-hidden rounded-md border bg-muted"
            >
              <video
                src={primaryUrl}
                muted
                playsInline
                preload="metadata"
                className="h-full w-full object-cover"
              />
              <span className="absolute inset-0 flex items-center justify-center bg-black/30">
                <Play className="h-8 w-8 text-white" aria-hidden="true" />
              </span>
            </a>
          ) : primaryUrl ? (
            <a
              href={primaryUrl}
              target="_blank"
              rel="noreferrer"
              className="flex aspect-square flex-col items-center justify-center gap-2 rounded-md border bg-muted px-3 text-center text-xs text-muted-foreground"
            >
              <FileText className="h-8 w-8" aria-hidden="true" />
              {t("project.calendar.approvalsSummary.openMedia")}
            </a>
          ) : (
            <div className="flex aspect-square items-center justify-center rounded-md border border-dashed bg-muted/40 px-3 text-center text-xs text-muted-foreground">
              {t("project.calendar.approvalsSummary.noMedia")}
            </div>
          )}
          {mediaUrls.length > 0 ? (
            <Button
              type="button"
              variant="secondary"
              size="sm"
              className="mt-2 w-full"
              disabled={isDownloading}
              onClick={() => void handleDownload(downloadableMedia, "all")}
            >
              {downloadingKey === "all" ? (
                <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" aria-hidden="true" />
              ) : (
                <Download className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" />
              )}
              {downloadingKey === "all"
                ? t("project.calendar.approvalsSummary.downloading")
                : mediaUrls.length > 1
                  ? t("project.calendar.approvalsSummary.downloadAll", {
                      count: mediaUrls.length,
                    })
                  : t("project.calendar.approvalsSummary.downloadMedia")}
            </Button>
          ) : null}
          {mediaUrls.length > 1 ? (
            <ul className="mt-2 space-y-1">
              <li className="text-xs text-muted-foreground">
                {t("project.calendar.approvalsSummary.mediaCount", {
                  count: mediaUrls.length,
                })}
              </li>
              {listedMedia.map((entry) => (
                <li key={`${entry.role}-${entry.url}`} className="flex items-center justify-between gap-2">
                  <a
                    href={entry.url}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex min-w-0 items-center gap-1 text-xs text-primary underline-offset-2 hover:underline"
                  >
                    <ExternalLink className="h-3 w-3 shrink-0" aria-hidden="true" />
                    {entry.role === "cover"
                      ? t("project.calendar.approvalsSummary.openCover")
                      : t("project.calendar.approvalsSummary.openMediaN", { n: entry.n })}
                  </a>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-7 shrink-0 px-2 text-xs"
                    disabled={isDownloading}
                    onClick={() => void handleDownload([entry], entry.url)}
                  >
                    {downloadingKey === entry.url ? (
                      <Loader2 className="mr-1 h-3 w-3 animate-spin" aria-hidden="true" />
                    ) : (
                      <Download className="mr-1 h-3 w-3" aria-hidden="true" />
                    )}
                    {entry.role === "cover"
                      ? t("project.calendar.approvalsSummary.downloadCover")
                      : t("project.calendar.approvalsSummary.downloadMediaN", { n: entry.n })}
                  </Button>
                </li>
              ))}
            </ul>
          ) : primaryUrl ? (
            <a
              href={primaryUrl}
              target="_blank"
              rel="noreferrer"
              className="mt-2 inline-flex items-center gap-1 text-xs text-primary underline-offset-2 hover:underline"
            >
              <ExternalLink className="h-3 w-3" aria-hidden="true" />
              {t("project.calendar.approvalsSummary.openMedia")}
            </a>
          ) : null}
        </div>

        <div className="min-w-0 flex-1 space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs font-medium text-muted-foreground">
              {t("project.calendar.approvalsSummary.captionLabel")}
            </p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => void handleCopy()}
              disabled={!publishText.trim()}
            >
              {copied ? (
                <Check className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" />
              ) : (
                <ClipboardCopy className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" />
              )}
              {copied
                ? t("project.calendar.approvalsSummary.copiedButton")
                : t("project.calendar.approvalsSummary.copyCaption")}
            </Button>
          </div>
          {publishText.trim() ? (
            <pre className="max-h-64 overflow-auto whitespace-pre-wrap rounded-md border bg-muted/40 p-3 font-sans text-sm leading-relaxed text-foreground">
              {publishText}
            </pre>
          ) : (
            <p className="rounded-md border border-dashed px-3 py-6 text-sm text-muted-foreground">
              {t("project.calendar.approvalsSummary.noCaption")}
            </p>
          )}
        </div>
      </div>
    </article>
  );
}

export function ApprovalsSummaryDialog({
  open,
  onOpenChange,
  blockTitle,
  items,
}: ApprovalsSummaryDialogProps) {
  const { t, i18n } = useTranslation();
  const [downloadingAll, setDownloadingAll] = useState(false);
  const uiLocale = normalizeAppLocale(i18n.resolvedLanguage ?? i18n.language);
  const periodMedia = items.flatMap((item, itemIndex) => {
    const title =
      getLocalizedText(parseRowI18n(item.i18n), "title", item.title, uiLocale).trim() ||
      `conteudo-${itemIndex + 1}`;
    return mediaDownloadItems(resolveDownloadableContentMedia(item), title).map((file, fileIndex) => ({
      ...file,
      name: `${title}-${fileIndex + 1}-${file.name}`,
    }));
  });

  async function handleDownloadPeriod() {
    if (periodMedia.length === 0) {
      toast.error(t("project.calendar.approvalsSummary.noDownloadableMedia"));
      return;
    }
    setDownloadingAll(true);
    try {
      const result = await shareOrDownloadFiles(
        periodMedia,
        blockTitle.trim() || "midias-aprovadas",
      );
      notifyDownloadResult(result, t);
    } catch {
      toast.error(t("project.calendar.approvalsSummary.downloadError"));
    } finally {
      setDownloadingAll(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[min(90dvh,calc(100vh-2rem))] max-w-2xl flex-col gap-0 overflow-hidden overflow-y-hidden p-0">
        <DialogHeader className="shrink-0 space-y-1 border-b px-6 py-4 pr-12 text-left">
          <DialogTitle>{t("project.calendar.approvalsSummary.title")}</DialogTitle>
          <DialogDescription>
            {blockTitle.trim()
              ? t("project.calendar.approvalsSummary.descriptionWithPeriod", {
                  period: blockTitle.trim(),
                })
              : t("project.calendar.approvalsSummary.description")}
          </DialogDescription>
          {periodMedia.length > 0 ? (
            <div className="pt-3">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                disabled={downloadingAll}
                onClick={() => void handleDownloadPeriod()}
              >
                {downloadingAll ? (
                  <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                ) : (
                  <Download className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" />
                )}
                {downloadingAll
                  ? t("project.calendar.approvalsSummary.downloading")
                  : t("project.calendar.approvalsSummary.downloadAllPeriod")}
              </Button>
            </div>
          ) : null}
        </DialogHeader>

        <div className="min-h-0 flex-1 overflow-y-auto px-6">
          {items.length === 0 ? (
            <p className="py-10 text-sm text-muted-foreground">
              {t("project.calendar.approvalsSummary.empty")}
            </p>
          ) : (
            items.map((item, index) => (
              <ApprovedItemRow
                key={item.id}
                item={item}
                index={index}
                total={items.length}
              />
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
