import { Expand } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { isImageUrl, isVideoUrl } from "@/lib/api";

export type PrintPreviewMediaItem = {
  url: string;
  kind?: "image" | "video" | "file";
  name?: string;
};

type PrintMaterialPreviewProps = {
  items: PrintPreviewMediaItem[];
  title: string;
  materialType?: string | null;
  widthCm?: number | null;
  heightCm?: number | null;
  size?: "default" | "lg";
  className?: string;
};

function resolveKind(item: PrintPreviewMediaItem): "image" | "video" | "file" {
  if (item.kind) return item.kind;
  if (isVideoUrl(item.url)) return "video";
  if (isImageUrl(item.url)) return "image";
  if (/\.(pdf|docx?|xlsx?|csv|txt|md|rtf|od[ts])(\?|$)/i.test(item.url)) return "file";
  return "image";
}

function formatCm(value: number) {
  return Number.isInteger(value) ? String(value) : value.toFixed(1).replace(".", ",");
}

export function PrintMaterialPreview({
  items,
  title,
  materialType,
  widthCm,
  heightCm,
  size = "default",
  className,
}: PrintMaterialPreviewProps) {
  const { t } = useTranslation();
  const [lightboxOpen, setLightboxOpen] = useState(false);

  const width = widthCm && widthCm > 0 ? widthCm : 21;
  const height = heightCm && heightCm > 0 ? heightCm : 29.7;
  const aspect = width / height;
  const isLandscape = aspect >= 1;
  const maxW = size === "lg" ? 520 : 360;
  const maxH = size === "lg" ? 560 : 420;
  const frameWidth = isLandscape
    ? maxW
    : Math.min(maxW, Math.round(maxH * aspect));
  const frameHeight = isLandscape
    ? Math.min(maxH, Math.round(maxW / aspect))
    : maxH;

  const materialLabel = materialType
    ? t(`project.graphicArts.materials.${materialType}`, {
        defaultValue: materialType,
      })
    : t("project.detail.formats.print_material");
  const sizeLabel = `${formatCm(width)} × ${formatCm(height)} cm`;
  const item = items[0];
  const kind = item ? resolveKind(item) : null;
  const canExpand = Boolean(item && kind !== "file");

  return (
    <div className={cn("flex flex-col items-center gap-3", className)}>
      <div className="inline-flex flex-wrap items-center justify-center gap-2 text-xs text-muted-foreground">
        <span className="rounded-md border border-amber-200 bg-amber-50 px-2 py-0.5 font-medium text-amber-900">
          {materialLabel}
        </span>
        <span className="rounded-md border bg-background px-2 py-0.5 font-medium text-foreground">
          {sizeLabel}
        </span>
      </div>

      <div
        className="relative mx-auto overflow-hidden rounded-sm border border-neutral-300 bg-white shadow-[0_12px_40px_-12px_rgba(0,0,0,0.35),0_2px_8px_-2px_rgba(0,0,0,0.12)]"
        style={{
          width: frameWidth,
          height: frameHeight,
          maxWidth: "100%",
          aspectRatio: `${width} / ${height}`,
        }}
      >
        {!item ? (
          <div className="flex h-full w-full items-center justify-center bg-neutral-50 px-4 text-center text-xs text-neutral-400">
            {t("project.graphicArts.previewEmpty")}
          </div>
        ) : kind === "video" ? (
          <video
            src={item.url}
            className="h-full w-full object-contain"
            controls
            playsInline
            title={title}
          />
        ) : kind === "file" ? (
          <div className="flex h-full w-full flex-col items-center justify-center gap-2 bg-neutral-50 px-4 text-center text-xs text-neutral-500">
            <span className="font-medium text-foreground">{item.name ?? title}</span>
            <a
              href={item.url}
              target="_blank"
              rel="noreferrer"
              className="text-primary underline-offset-2 hover:underline"
            >
              {t("project.detail.openFile")}
            </a>
          </div>
        ) : (
          <>
            <img
              src={item.url}
              alt={title}
              className="h-full w-full object-contain"
            />
            {canExpand ? (
              <button
                type="button"
                className="absolute right-2 top-2 inline-flex h-8 w-8 items-center justify-center rounded-full bg-black/45 text-white hover:bg-black/60"
                aria-label={t("project.detail.expandMedia")}
                onClick={() => setLightboxOpen(true)}
              >
                <Expand className="h-4 w-4" aria-hidden="true" />
              </button>
            ) : null}
          </>
        )}
      </div>

      <Dialog open={lightboxOpen} onOpenChange={setLightboxOpen}>
        <DialogContent className="max-w-4xl border-0 bg-transparent p-0 shadow-none">
          <DialogTitle className="sr-only">{title}</DialogTitle>
          <DialogDescription className="sr-only">
            {materialLabel} — {sizeLabel}
          </DialogDescription>
          {item && kind === "image" ? (
            <img
              src={item.url}
              alt={title}
              className="max-h-[85vh] w-full object-contain"
            />
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}
