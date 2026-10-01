import { loadBrandFonts, resolveBrandFont } from "@/lib/brand-fonts";
import type { BrandColor } from "@/lib/api";
import { designCanvasSpec, type DesignAspectRatio } from "@/lib/design-aspect";
import {
  createDefaultImageAdjustments,
  drawImageWithFraming,
  drawVignette,
  imageAdjustmentsToCssFilter,
  imageAdjustmentsVignetteOpacity,
  normalizeImageAdjustments,
  parseImageAdjustments,
  type MediaImageAdjustments,
} from "@/lib/media-image-adjustments";

export type { MediaImageAdjustments, MediaImageFilterPreset } from "@/lib/media-image-adjustments";
export {
  DEFAULT_IMAGE_ADJUSTMENTS,
  MEDIA_IMAGE_FILTER_PRESETS,
  createDefaultImageAdjustments,
  imageAdjustmentsAreDefault,
  imageAdjustmentsToCssFilter,
  imageAdjustmentsVignetteOpacity,
  normalizeImageAdjustments,
} from "@/lib/media-image-adjustments";

export type TextLayerAlign = "left" | "center" | "right";

export type MediaTextLayer = {
  id: string;
  text: string;
  fontFamily: string;
  fontWeight: "400" | "700";
  /** Font size as a fraction of image height (e.g. 0.055). */
  fontSize: number;
  color: string;
  /** Anchor X, 0–1. */
  x: number;
  /** Anchor Y, 0–1. */
  y: number;
  align: TextLayerAlign;
  /** Max line width as a fraction of image width. */
  maxWidth: number;
};

export type MediaTextOverlay = {
  baseUrl: string;
  layers: MediaTextLayer[];
  adjustments?: MediaImageAdjustments;
};

const DEFAULT_PRIMARY_COLOR = "#FFFFFF";
const DEFAULT_SECONDARY_COLOR = "#F4F4F5";

function clamp01(value: number) {
  if (!Number.isFinite(value)) return 0.5;
  return Math.min(1, Math.max(0, value));
}

function asAlign(value: unknown): TextLayerAlign {
  if (value === "left" || value === "right" || value === "center") return value;
  return "center";
}

function asWeight(value: unknown): "400" | "700" {
  return value === "400" ? "400" : "700";
}

/**
 * Cover-crop + scale to the exact design canvas (e.g. 1080×1440 for 3:4),
 * so a square AI output cannot ship as the final piece.
 */
export async function normalizeImageToDesignCanvas(
  sourceUrl: string,
  aspect: DesignAspectRatio,
): Promise<Blob> {
  const { width: targetW, height: targetH } = designCanvasSpec(aspect);
  const res = await fetch(sourceUrl);
  if (!res.ok) throw new Error("Não foi possível carregar a arte base.");
  const source = await res.blob();
  const bitmap = await createImageBitmap(source);

  const canvas = document.createElement("canvas");
  canvas.width = targetW;
  canvas.height = targetH;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    bitmap.close();
    throw new Error("Não foi possível ajustar a proporção da arte.");
  }

  const scale = Math.max(targetW / bitmap.width, targetH / bitmap.height);
  const drawW = bitmap.width * scale;
  const drawH = bitmap.height * scale;
  const dx = (targetW - drawW) / 2;
  const dy = (targetH - drawH) / 2;
  ctx.drawImage(bitmap, dx, dy, drawW, drawH);
  bitmap.close();

  const blob = await new Promise<Blob | null>((resolve) => {
    canvas.toBlob((result) => resolve(result), "image/png");
  });
  if (!blob) throw new Error("Falha ao normalizar a proporção da arte.");
  return blob;
}

export function createTextLayer(
  text: string,
  opts?: Partial<Omit<MediaTextLayer, "id" | "text">>,
): MediaTextLayer {
  return {
    id: crypto.randomUUID(),
    text,
    fontFamily: opts?.fontFamily || "Montserrat",
    fontWeight: opts?.fontWeight ?? "700",
    fontSize: opts?.fontSize ?? 0.055,
    color: opts?.color || DEFAULT_PRIMARY_COLOR,
    x: opts?.x ?? 0.5,
    y: opts?.y ?? 0.22,
    align: opts?.align ?? "center",
    maxWidth: opts?.maxWidth ?? 0.82,
  };
}

export function createDefaultOverlay(input: {
  baseUrl: string;
  overlayText: string;
  secondaryText?: string;
  primaryFont?: string;
  secondaryFont?: string;
  colors?: BrandColor[];
}): MediaTextOverlay {
  const primary = resolveBrandFont(input.primaryFont);
  const secondary = resolveBrandFont(input.secondaryFont, primary);
  const headlineColor = input.colors?.[0]?.hex?.trim() || DEFAULT_PRIMARY_COLOR;
  const supportColor = input.colors?.[1]?.hex?.trim() || DEFAULT_SECONDARY_COLOR;
  const layers: MediaTextLayer[] = [
    createTextLayer(input.overlayText.trim(), {
      fontFamily: primary,
      fontWeight: "700",
      fontSize: 0.058,
      color: headlineColor,
      x: 0.5,
      y: 0.2,
      align: "center",
      maxWidth: 0.82,
    }),
  ];
  const secondaryText = input.secondaryText?.trim() ?? "";
  if (secondaryText) {
    layers.push(
      createTextLayer(secondaryText, {
        fontFamily: secondary,
        fontWeight: "400",
        fontSize: 0.032,
        color: supportColor,
        x: 0.5,
        y: 0.8,
        align: "center",
        maxWidth: 0.78,
      }),
    );
  }
  return {
    baseUrl: input.baseUrl,
    layers,
    adjustments: createDefaultImageAdjustments(),
  };
}

export function parseMediaTextOverlay(value: unknown): MediaTextOverlay | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const row = value as { baseUrl?: unknown; layers?: unknown; adjustments?: unknown };
  const baseUrl = typeof row.baseUrl === "string" ? row.baseUrl.trim() : "";
  if (!baseUrl || !Array.isArray(row.layers)) return null;
  const layers = row.layers
    .map((entry) => {
      if (!entry || typeof entry !== "object") return null;
      const layer = entry as Record<string, unknown>;
      const text = typeof layer.text === "string" ? layer.text : "";
      const fontFamily =
        typeof layer.fontFamily === "string" && layer.fontFamily.trim()
          ? layer.fontFamily.trim()
          : "Montserrat";
      return {
        id: typeof layer.id === "string" && layer.id ? layer.id : crypto.randomUUID(),
        text,
        fontFamily,
        fontWeight: asWeight(layer.fontWeight),
        fontSize: clamp01(typeof layer.fontSize === "number" ? layer.fontSize : 0.05) || 0.05,
        color: typeof layer.color === "string" && layer.color.trim() ? layer.color.trim() : "#FFFFFF",
        x: clamp01(typeof layer.x === "number" ? layer.x : 0.5),
        y: clamp01(typeof layer.y === "number" ? layer.y : 0.5),
        align: asAlign(layer.align),
        maxWidth: Math.min(0.98, Math.max(0.2, typeof layer.maxWidth === "number" ? layer.maxWidth : 0.82)),
      } satisfies MediaTextLayer;
    })
    .filter((layer): layer is MediaTextLayer => Boolean(layer));
  return {
    baseUrl,
    layers,
    adjustments: parseImageAdjustments(row.adjustments),
  };
}

export function parseMediaOverlays(value: unknown): Array<MediaTextOverlay | null> {
  if (!Array.isArray(value)) return [];
  return value.map((entry) => parseMediaTextOverlay(entry));
}

export function serializeMediaOverlays(overlays: Array<MediaTextOverlay | null | undefined>) {
  return overlays.map((overlay) => overlay ?? null);
}

function wrapLines(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
): string[] {
  const paragraphs = text.replace(/\r\n/g, "\n").split("\n");
  const lines: string[] = [];
  for (const paragraph of paragraphs) {
    const words = paragraph.trim() ? paragraph.split(/\s+/) : [""];
    let current = words[0] ?? "";
    for (let i = 1; i < words.length; i += 1) {
      const next = `${current} ${words[i]}`;
      if (ctx.measureText(next).width <= maxWidth) {
        current = next;
      } else {
        lines.push(current);
        current = words[i];
      }
    }
    lines.push(current);
  }
  return lines;
}

export async function flattenMediaTextOverlay(overlay: MediaTextOverlay): Promise<Blob> {
  const families = overlay.layers.map((layer) => layer.fontFamily);
  await loadBrandFonts(families);

  const res = await fetch(overlay.baseUrl);
  if (!res.ok) throw new Error("Não foi possível carregar a arte base.");
  const source = await res.blob();
  const bitmap = await createImageBitmap(source);

  const canvas = document.createElement("canvas");
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    bitmap.close();
    throw new Error("Não foi possível desenhar o texto na arte.");
  }

  const adjustments = normalizeImageAdjustments(
    overlay.adjustments ?? createDefaultImageAdjustments(),
  );
  ctx.filter = imageAdjustmentsToCssFilter(adjustments);
  drawImageWithFraming(ctx, bitmap, canvas.width, canvas.height, adjustments);
  ctx.filter = "none";
  drawVignette(ctx, canvas.width, canvas.height, imageAdjustmentsVignetteOpacity(adjustments));
  bitmap.close();

  ctx.textBaseline = "middle";
  for (const layer of overlay.layers) {
    const text = layer.text.trim();
    if (!text) continue;
    const fontPx = Math.max(12, layer.fontSize * canvas.height);
    ctx.font = `${layer.fontWeight} ${fontPx}px "${layer.fontFamily}", system-ui, sans-serif`;
    ctx.textAlign = layer.align;
    ctx.fillStyle = layer.color;
    ctx.shadowColor = "rgba(0,0,0,0.45)";
    ctx.shadowBlur = Math.max(2, fontPx * 0.08);
    ctx.shadowOffsetY = Math.max(1, fontPx * 0.04);

    const maxWidth = layer.maxWidth * canvas.width;
    const lines = wrapLines(ctx, text, maxWidth);
    const lineHeight = fontPx * 1.15;
    const blockHeight = lines.length * lineHeight;
    const startY = layer.y * canvas.height - blockHeight / 2 + lineHeight / 2;
    const x =
      layer.align === "left"
        ? layer.x * canvas.width - maxWidth / 2
        : layer.align === "right"
          ? layer.x * canvas.width + maxWidth / 2
          : layer.x * canvas.width;

    for (let i = 0; i < lines.length; i += 1) {
      ctx.fillText(lines[i], x, startY + i * lineHeight, maxWidth);
    }
  }

  ctx.shadowColor = "transparent";

  const blob = await new Promise<Blob | null>((resolve) => {
    canvas.toBlob((result) => resolve(result), "image/png");
  });
  if (!blob) throw new Error("Falha ao gerar a arte com o texto da marca.");
  return blob;
}

export async function flattenOverlayToFile(overlay: MediaTextOverlay, name = "arte.png") {
  const blob = await flattenMediaTextOverlay(overlay);
  return new File([blob], name, { type: "image/png" });
}
