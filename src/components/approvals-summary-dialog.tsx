import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Check, ClipboardCopy, ExternalLink, FileText, Play } from "lucide-react";
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
  isVideoUrl,
  resolveContentMediaUrls,
  type ContentFormat,
  type ContentItem,
} from "@/lib/api";
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
  if (isVideoUrl(url)) return "video";
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
  const uiLocale = normalizeAppLocale(i18n.resolvedLanguage ?? i18n.language);
  const rowI18n = parseRowI18n(item.i18n);
  const title = getLocalizedText(rowI18n, "title", item.title, uiLocale);
  const caption = getLocalizedText(rowI18n, "caption", item.caption ?? "", uiLocale);
  const cta = getLocalizedText(rowI18n, "cta", item.cta ?? "", uiLocale);
  const hashtags = getLocalizedText(rowI18n, "hashtags", item.hashtags ?? "", uiLocale);
  const publishText = composePublishCaption({ caption, cta, hashtags });
  const mediaUrls = resolveContentMediaUrls(item);
  const primaryUrl = mediaUrls[0] ?? null;
  const primaryKind = primaryUrl ? mediaKind(primaryUrl) : null;
  const formatKey = (item.format ?? "static_feed") as ContentFormat;

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
          {mediaUrls.length > 1 ? (
            <ul className="mt-2 space-y-1">
              <li className="text-xs text-muted-foreground">
                {t("project.calendar.approvalsSummary.mediaCount", {
                  count: mediaUrls.length,
                })}
              </li>
              {mediaUrls.map((url, i) => (
                <li key={url}>
                  <a
                    href={url}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-xs text-primary underline-offset-2 hover:underline"
                  >
                    <ExternalLink className="h-3 w-3" aria-hidden="true" />
                    {t("project.calendar.approvalsSummary.openMediaN", { n: i + 1 })}
                  </a>
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
  const { t } = useTranslation();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[90vh] max-w-2xl flex-col gap-0 overflow-hidden p-0">
        <DialogHeader className="shrink-0 space-y-1 border-b px-6 py-4 text-left">
          <DialogTitle>{t("project.calendar.approvalsSummary.title")}</DialogTitle>
          <DialogDescription>
            {blockTitle.trim()
              ? t("project.calendar.approvalsSummary.descriptionWithPeriod", {
                  period: blockTitle.trim(),
                })
              : t("project.calendar.approvalsSummary.description")}
          </DialogDescription>
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
