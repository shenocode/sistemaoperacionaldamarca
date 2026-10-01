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

export type TextLayerRole = "handle" | "tagline" | "headline" | "support" | "custom";

export type MediaTextLayer = {
  id: string;
  text: string;
  fontFamily: string;
  fontWeight: "400" | "700";
  /** Font size as a fraction of image height (e.g. 0.055). */
  fontSize: number;
  color: string;
  /** Text opacity, 0–1 (default 1). */
  opacity: number;
  /** Anchor X, 0–1. */
  x: number;
  /** Anchor Y, 0–1. */
  y: number;
  align: TextLayerAlign;
  /** Max line width as a fraction of image width. */
  maxWidth: number;
  /** Optional UI label (e.g. "Título", "@ / handle"). */
  label?: string;
  role?: TextLayerRole;
};

export type MediaTextOverlay = {
  baseUrl: string;
  layers: MediaTextLayer[];
  adjustments?: MediaImageAdjustments;
  /** Custom kit font family → public file URL (for FontFace load). */
  fontFiles?: Record<string, string>;
};

const DEFAULT_PRIMARY_COLOR = "#FFFFFF";
const DEFAULT_SECONDARY_COLOR = "#F4F4F5";
const TEXT_LAYER_ROLES: TextLayerRole[] = ["handle", "tagline", "headline", "support", "custom"];

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

function asOpacity(value: unknown): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return 1;
  return Math.min(1, Math.max(0, value));
}

/** Extra swatches offered in the art text editor beyond the brand kit. */
export const ART_TEXT_EXTRA_COLORS: BrandColor[] = [
  { name: "Branco", hex: "#FFFFFF" },
  { name: "Off-white", hex: "#F5F2EB" },
  { name: "Gelo", hex: "#E8EEF2" },
  { name: "Cinza claro", hex: "#C4C4C4" },
  { name: "Cinza", hex: "#8A8A8A" },
  { name: "Carvão", hex: "#2B2B2B" },
  { name: "Preto", hex: "#000000" },
  { name: "Dourado", hex: "#C6A75E" },
  { name: "Champagne", hex: "#E6D5A8" },
  { name: "Terracota", hex: "#C0603A" },
  { name: "Vinho", hex: "#7A1F2B" },
  { name: "Verde musgo", hex: "#4F6F52" },
  { name: "Azul petróleo", hex: "#1F4E5F" },
  { name: "Azul claro", hex: "#97ADBD" },
];

/** Combine a CSS color with 0–1 opacity for canvas / preview. */
export function colorWithOpacity(color: string, opacity = 1): string {
  const alpha = Math.min(1, Math.max(0, opacity));
  if (alpha >= 0.999) return color;
  const raw = color.trim();
  const hex = raw.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);
  if (hex) {
    let body = hex[1];
    if (body.length === 3) {
      body = body
        .split("")
        .map((ch) => `${ch}${ch}`)
        .join("");
    }
    const r = Number.parseInt(body.slice(0, 2), 16);
    const g = Number.parseInt(body.slice(2, 4), 16);
    const b = Number.parseInt(body.slice(4, 6), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }
  const rgb = raw.match(/^rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)(?:\s*,\s*[\d.]+\s*)?\)$/i);
  if (rgb) {
    return `rgba(${rgb[1]}, ${rgb[2]}, ${rgb[3]}, ${alpha})`;
  }
  return raw;
}

function asRole(value: unknown): TextLayerRole | undefined {
  return typeof value === "string" && (TEXT_LAYER_ROLES as string[]).includes(value)
    ? (value as TextLayerRole)
    : undefined;
}

/** Normalize an Instagram URL or raw handle to `@username`. */
export function formatInstagramHandle(value?: string | null): string {
  const raw = (value ?? "").trim();
  if (!raw) return "";
  const fromUrl = raw.match(/instagram\.com\/([^/?#]+)/i)?.[1];
  const handle = (fromUrl || raw).replace(/^@+/, "").replace(/\/+$/, "").trim();
  return handle ? `@${handle}` : "";
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
    opacity: asOpacity(opts?.opacity ?? 1),
    x: opts?.x ?? 0.5,
    y: opts?.y ?? 0.22,
    align: opts?.align ?? "center",
    maxWidth: opts?.maxWidth ?? 0.82,
    label: opts?.label,
    role: opts?.role,
  };
}

export function createDefaultOverlay(input: {
  baseUrl: string;
  overlayText: string;
  secondaryText?: string;
  /** Top-left chrome, e.g. @handle */
  headerLeft?: string;
  /** Top-right chrome, e.g. specialty / niche */
  headerRight?: string;
  primaryFont?: string;
  secondaryFont?: string;
  colors?: BrandColor[];
  fontFiles?: Record<string, string>;
}): MediaTextOverlay {
  const primary = resolveBrandFont(input.primaryFont);
  const secondary = resolveBrandFont(input.secondaryFont, primary);
  const headlineColor = input.colors?.[0]?.hex?.trim() || DEFAULT_PRIMARY_COLOR;
  const supportColor = input.colors?.[1]?.hex?.trim() || DEFAULT_SECONDARY_COLOR;
  const chromeColor = input.colors?.[2]?.hex?.trim() || supportColor;

  const layers: MediaTextLayer[] = [
    createTextLayer(formatInstagramHandle(input.headerLeft) || (input.headerLeft ?? "").trim(), {
      role: "handle",
      label: "@ / handle",
      fontFamily: secondary,
      fontWeight: "400",
      fontSize: 0.022,
      color: chromeColor,
      x: 0.18,
      y: 0.055,
      align: "left",
      maxWidth: 0.4,
    }),
    createTextLayer((input.headerRight ?? "").trim(), {
      role: "tagline",
      label: "Topo direito",
      fontFamily: secondary,
      fontWeight: "400",
      fontSize: 0.02,
      color: chromeColor,
      x: 0.82,
      y: 0.055,
      align: "right",
      maxWidth: 0.42,
    }),
    createTextLayer(input.overlayText.trim(), {
      role: "headline",
      label: "Título",
      fontFamily: primary,
      fontWeight: "700",
      fontSize: 0.07,
      color: headlineColor,
      x: 0.5,
      // Main copy sits in the lower half of carousel templates (not the top).
      y: 0.58,
      align: "center",
      maxWidth: 0.86,
    }),
    createTextLayer((input.secondaryText ?? "").trim(), {
      role: "support",
      label: "Apoio",
      fontFamily: secondary,
      fontWeight: "400",
      fontSize: 0.032,
      color: supportColor,
      x: 0.5,
      y: 0.86,
      align: "center",
      maxWidth: 0.78,
    }),
  ];

  return {
    baseUrl: input.baseUrl,
    layers,
    adjustments: createDefaultImageAdjustments(),
    fontFiles: input.fontFiles && Object.keys(input.fontFiles).length > 0 ? input.fontFiles : undefined,
  };
}

/**
 * Ensures classic carousel chrome layers exist so the editor can edit
 * handle / top-right / headline / support — even for older 1-layer overlays.
 * Always keeps a filled, correctly placed "Título" when copy is available.
 */
export function ensureArtLayoutLayers(
  overlay: MediaTextOverlay,
  opts?: {
    overlayText?: string;
    secondaryText?: string;
    headerLeft?: string;
    headerRight?: string;
    primaryFont?: string;
    secondaryFont?: string;
    colors?: BrandColor[];
    fontFiles?: Record<string, string>;
  },
): MediaTextOverlay {
  const fallbackHeadline = (opts?.overlayText ?? "").trim();
  const fallbackSupport = (opts?.secondaryText ?? "").trim();

  const byExistingRole = (role: TextLayerRole) =>
    overlay.layers.find((layer) => layer.role === role);

  // Prefer an explicit headline role; never treat @handle / tagline as the title.
  const existingHeadline =
    byExistingRole("headline") ??
    overlay.layers.find(
      (layer) =>
        layer.role !== "handle" &&
        layer.role !== "tagline" &&
        layer.role !== "support" &&
        layer.text.trim().length > 0 &&
        layer.text.trim().length > 12,
    ) ??
    overlay.layers.find(
      (layer) =>
        layer.role !== "handle" &&
        layer.role !== "tagline" &&
        layer.role !== "support" &&
        layer.text.trim(),
    );

  const mergedFontFiles = {
    ...(overlay.fontFiles ?? {}),
    ...(opts?.fontFiles ?? {}),
  };

  const scaffold = createDefaultOverlay({
    baseUrl: overlay.baseUrl,
    overlayText: existingHeadline?.text?.trim() || fallbackHeadline,
    secondaryText: byExistingRole("support")?.text?.trim() || fallbackSupport,
    headerLeft: opts?.headerLeft,
    headerRight: opts?.headerRight,
    primaryFont: opts?.primaryFont ?? existingHeadline?.fontFamily,
    secondaryFont: opts?.secondaryFont,
    colors: opts?.colors,
    fontFiles: Object.keys(mergedFontFiles).length > 0 ? mergedFontFiles : undefined,
  });

  const pick = (role: TextLayerRole): MediaTextLayer => {
    const existing = byExistingRole(role);
    const fresh = scaffold.layers.find((layer) => layer.role === role)!;
    if (!existing) return fresh;
    if (role === "headline") {
      const text = existing.text.trim() || fallbackHeadline || fresh.text;
      return {
        ...fresh,
        ...existing,
        text,
        role: "headline",
        label: existing.label || "Título",
        // Keep the title on the lower half where carousel copy lives.
        x: fresh.x,
        y: fresh.y,
        fontSize: Math.max(existing.fontSize, fresh.fontSize),
        maxWidth: fresh.maxWidth,
        align: "center",
      };
    }
    if (role === "support") {
      return {
        ...fresh,
        ...existing,
        text: existing.text.trim() || fallbackSupport || fresh.text,
        role: "support",
        label: existing.label || "Apoio",
      };
    }
    if (role === "handle") {
      return {
        ...fresh,
        ...existing,
        text: existing.text.trim() || fresh.text,
        role: "handle",
        label: existing.label || "@ / handle",
      };
    }
    if (role === "tagline") {
      return {
        ...fresh,
        ...existing,
        text: existing.text.trim() || fresh.text,
        role: "tagline",
        label: existing.label || "Topo direito",
      };
    }
    return { ...fresh, ...existing, role };
  };

  const headlineFromLoose =
    !byExistingRole("headline") && existingHeadline
      ? {
          ...scaffold.layers.find((layer) => layer.role === "headline")!,
          ...existingHeadline,
          text: existingHeadline.text.trim() || fallbackHeadline,
          role: "headline" as const,
          label: existingHeadline.label || "Título",
          x: 0.5,
          y: 0.58,
          fontSize: Math.max(existingHeadline.fontSize, 0.07),
          maxWidth: 0.86,
          align: "center" as const,
        }
      : null;

  const headline = headlineFromLoose ?? pick("headline");
  const usedIds = new Set(
    [pick("handle").id, pick("tagline").id, headline.id, pick("support").id].filter(Boolean),
  );
  if (existingHeadline) usedIds.add(existingHeadline.id);

  const extras = overlay.layers.filter(
    (layer) =>
      !usedIds.has(layer.id) &&
      layer.role !== "handle" &&
      layer.role !== "tagline" &&
      layer.role !== "headline" &&
      layer.role !== "support",
  );

  return {
    ...overlay,
    layers: [pick("handle"), pick("tagline"), headline, pick("support"), ...extras],
    fontFiles: Object.keys(mergedFontFiles).length > 0 ? mergedFontFiles : overlay.fontFiles,
  };
}

export function findHeadlineLayerId(overlay: MediaTextOverlay | null | undefined): string | null {
  if (!overlay) return null;
  return overlay.layers.find((layer) => layer.role === "headline")?.id ?? overlay.layers[0]?.id ?? null;
}

/** Kit font notes often look like "Fonte secundária: X" — not a post tagline. */
export function resolveBrandTagline(notes?: string | null): string {
  const value = (notes ?? "").trim();
  if (!value || value.length > 48 || /\n/.test(value)) return "";
  if (/fonte|secund[aá]ria|prim[aá]ria|tipografia|\bfont\b|kit/i.test(value)) return "";
  return value;
}

function parseFontFiles(value: unknown): Record<string, string> | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  const out: Record<string, string> = {};
  for (const [family, url] of Object.entries(value as Record<string, unknown>)) {
    const key = family.trim();
    const href = typeof url === "string" ? url.trim() : "";
    if (key && href) out[key] = href;
  }
  return Object.keys(out).length > 0 ? out : undefined;
}

export function parseMediaTextOverlay(value: unknown): MediaTextOverlay | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const row = value as {
    baseUrl?: unknown;
    layers?: unknown;
    adjustments?: unknown;
    fontFiles?: unknown;
  };
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
        opacity: asOpacity(layer.opacity),
        x: clamp01(typeof layer.x === "number" ? layer.x : 0.5),
        y: clamp01(typeof layer.y === "number" ? layer.y : 0.5),
        align: asAlign(layer.align),
        maxWidth: Math.min(0.98, Math.max(0.2, typeof layer.maxWidth === "number" ? layer.maxWidth : 0.82)),
        label: typeof layer.label === "string" && layer.label.trim() ? layer.label.trim() : undefined,
        role: asRole(layer.role),
      } satisfies MediaTextLayer;
    })
    .filter((layer): layer is MediaTextLayer => Boolean(layer));
  return {
    baseUrl,
    layers,
    adjustments: parseImageAdjustments(row.adjustments),
    fontFiles: parseFontFiles(row.fontFiles),
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
  await loadBrandFonts(families, overlay.fontFiles);

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
    const opacity = asOpacity(layer.opacity);
    ctx.globalAlpha = opacity;
    ctx.font = `${layer.fontWeight} ${fontPx}px "${layer.fontFamily}", system-ui, sans-serif`;
    ctx.textAlign = layer.align;
    ctx.fillStyle = layer.color;
    ctx.shadowColor = `rgba(0,0,0,${(0.45 * opacity).toFixed(3)})`;
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

  ctx.globalAlpha = 1;
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
