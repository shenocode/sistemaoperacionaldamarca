export type MediaImageFilterPreset =
  | "none"
  | "mono"
  | "warm"
  | "cool"
  | "fade"
  | "vivid"
  | "dramatic"
  | "vintage"
  | "soft"
  | "noir"
  | "golden"
  | "moody";

export const MEDIA_IMAGE_FILTER_PRESETS: MediaImageFilterPreset[] = [
  "none",
  "mono",
  "warm",
  "cool",
  "fade",
  "vivid",
  "dramatic",
  "vintage",
  "soft",
  "noir",
  "golden",
  "moody",
];

/** Manual + preset image adjustments stored with the editable overlay. */
export type MediaImageAdjustments = {
  preset: MediaImageFilterPreset;
  /** -100 … 100 */
  brightness: number;
  /** -100 … 100 */
  contrast: number;
  /** -100 … 100 */
  saturation: number;
  /** -100 … 100 (temperature) */
  warmth: number;
  /** 0 … 100 */
  fade: number;
  /** 0 … 100 */
  vignette: number;
  /** Framing zoom: 1 = fit canvas, up to 2.5 */
  zoom: number;
  /** Focus point X, 0–1 */
  focusX: number;
  /** Focus point Y, 0–1 */
  focusY: number;
};

export const DEFAULT_IMAGE_ADJUSTMENTS: MediaImageAdjustments = {
  preset: "none",
  brightness: 0,
  contrast: 0,
  saturation: 0,
  warmth: 0,
  fade: 0,
  vignette: 0,
  zoom: 1,
  focusX: 0.5,
  focusY: 0.5,
};

type PresetBias = {
  brightness?: number;
  contrast?: number;
  saturation?: number;
  warmth?: number;
  fade?: number;
  vignette?: number;
  extraCss?: string;
};

const PRESET_BIAS: Record<MediaImageFilterPreset, PresetBias> = {
  none: {},
  mono: { saturation: -100, contrast: 8, extraCss: "grayscale(1)" },
  warm: { warmth: 42, saturation: 6, brightness: 4 },
  cool: { warmth: -38, saturation: 8, contrast: 4 },
  fade: { fade: 35, contrast: -12, brightness: 8, saturation: -18 },
  vivid: { saturation: 38, contrast: 14, brightness: 4 },
  dramatic: { contrast: 28, brightness: -6, saturation: 10, vignette: 28 },
  vintage: { warmth: 28, fade: 22, contrast: -8, saturation: -12, vignette: 18, extraCss: "sepia(0.28)" },
  soft: { brightness: 10, contrast: -14, saturation: -8, fade: 12 },
  noir: { saturation: -100, contrast: 32, brightness: -8, vignette: 42, extraCss: "grayscale(1)" },
  golden: { warmth: 55, saturation: 18, brightness: 6, fade: 8, extraCss: "sepia(0.18)" },
  moody: { brightness: -10, contrast: 18, saturation: -22, warmth: -12, vignette: 36 },
};

function clamp(value: number, min: number, max: number) {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, value));
}

function asPreset(value: unknown): MediaImageFilterPreset {
  return MEDIA_IMAGE_FILTER_PRESETS.includes(value as MediaImageFilterPreset)
    ? (value as MediaImageFilterPreset)
    : "none";
}

export function createDefaultImageAdjustments(
  partial?: Partial<MediaImageAdjustments>,
): MediaImageAdjustments {
  return normalizeImageAdjustments({ ...DEFAULT_IMAGE_ADJUSTMENTS, ...partial });
}

export function normalizeImageAdjustments(
  value: Partial<MediaImageAdjustments> | null | undefined,
): MediaImageAdjustments {
  const row = value ?? {};
  return {
    preset: asPreset(row.preset),
    brightness: clamp(typeof row.brightness === "number" ? row.brightness : 0, -100, 100),
    contrast: clamp(typeof row.contrast === "number" ? row.contrast : 0, -100, 100),
    saturation: clamp(typeof row.saturation === "number" ? row.saturation : 0, -100, 100),
    warmth: clamp(typeof row.warmth === "number" ? row.warmth : 0, -100, 100),
    fade: clamp(typeof row.fade === "number" ? row.fade : 0, 0, 100),
    vignette: clamp(typeof row.vignette === "number" ? row.vignette : 0, 0, 100),
    zoom: clamp(typeof row.zoom === "number" ? row.zoom : 1, 1, 2.5),
    focusX: clamp(typeof row.focusX === "number" ? row.focusX : 0.5, 0, 1),
    focusY: clamp(typeof row.focusY === "number" ? row.focusY : 0.5, 0, 1),
  };
}

export function parseImageAdjustments(value: unknown): MediaImageAdjustments {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return { ...DEFAULT_IMAGE_ADJUSTMENTS };
  }
  return normalizeImageAdjustments(value as Partial<MediaImageAdjustments>);
}

export function imageAdjustmentsAreDefault(adj: MediaImageAdjustments): boolean {
  const a = normalizeImageAdjustments(adj);
  const d = DEFAULT_IMAGE_ADJUSTMENTS;
  return (
    a.preset === d.preset &&
    a.brightness === d.brightness &&
    a.contrast === d.contrast &&
    a.saturation === d.saturation &&
    a.warmth === d.warmth &&
    a.fade === d.fade &&
    a.vignette === d.vignette &&
    a.zoom === d.zoom &&
    a.focusX === d.focusX &&
    a.focusY === d.focusY
  );
}

function resolveTotals(adj: MediaImageAdjustments) {
  const bias = PRESET_BIAS[adj.preset] ?? {};
  return {
    brightness: clamp(adj.brightness + (bias.brightness ?? 0), -100, 100),
    contrast: clamp(adj.contrast + (bias.contrast ?? 0), -100, 100),
    saturation: clamp(adj.saturation + (bias.saturation ?? 0), -100, 100),
    warmth: clamp(adj.warmth + (bias.warmth ?? 0), -100, 100),
    fade: clamp(adj.fade + (bias.fade ?? 0), 0, 100),
    vignette: clamp(adj.vignette + (bias.vignette ?? 0), 0, 100),
    extraCss: bias.extraCss ?? "",
  };
}

/** CSS `filter` string for live preview and canvas `ctx.filter`. */
export function imageAdjustmentsToCssFilter(adj: MediaImageAdjustments): string {
  const t = resolveTotals(normalizeImageAdjustments(adj));
  const brightness = 1 + t.brightness / 100;
  const contrast = 1 + t.contrast / 100;
  const saturation = 1 + t.saturation / 100;
  // Warmth ≈ sepia + hue shift; cool inverts warmth.
  const warmthAbs = Math.abs(t.warmth);
  const sepia = (warmthAbs / 100) * 0.35;
  const hue = t.warmth >= 0 ? t.warmth * 0.22 : t.warmth * 0.35;
  // Fade lifts blacks toward gray.
  const fadeBrightness = 1 + (t.fade / 100) * 0.12;
  const fadeContrast = 1 - (t.fade / 100) * 0.28;
  const fadeSaturate = 1 - (t.fade / 100) * 0.2;

  const parts = [
    t.extraCss,
    `brightness(${(brightness * fadeBrightness).toFixed(3)})`,
    `contrast(${(contrast * fadeContrast).toFixed(3)})`,
    `saturate(${(saturation * fadeSaturate).toFixed(3)})`,
  ];
  if (sepia > 0.001) parts.push(`sepia(${sepia.toFixed(3)})`);
  if (Math.abs(hue) > 0.01) parts.push(`hue-rotate(${hue.toFixed(2)}deg)`);
  return parts.filter(Boolean).join(" ");
}

export function imageAdjustmentsVignetteOpacity(adj: MediaImageAdjustments): number {
  const t = resolveTotals(normalizeImageAdjustments(adj));
  return clamp(t.vignette / 100, 0, 1);
}

/**
 * Cover-draw source into target with zoom + focus (framing).
 * zoom 1 = classic cover; >1 zooms further into the focus point.
 */
export function drawImageWithFraming(
  ctx: CanvasRenderingContext2D,
  source: ImageBitmap | HTMLImageElement,
  targetW: number,
  targetH: number,
  adj: MediaImageAdjustments,
) {
  const a = normalizeImageAdjustments(adj);
  const sw = "width" in source && typeof source.width === "number" ? source.width : 0;
  const sh = "height" in source && typeof source.height === "number" ? source.height : 0;
  if (!sw || !sh) return;

  const cover = Math.max(targetW / sw, targetH / sh) * a.zoom;
  const drawW = sw * cover;
  const drawH = sh * cover;
  const maxDx = Math.max(0, drawW - targetW);
  const maxDy = Math.max(0, drawH - targetH);
  const dx = -maxDx * a.focusX;
  const dy = -maxDy * a.focusY;
  ctx.drawImage(source, dx, dy, drawW, drawH);
}

export function drawVignette(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  strength: number,
) {
  const opacity = clamp(strength, 0, 1);
  if (opacity <= 0.001) return;
  const cx = width / 2;
  const cy = height / 2;
  const radius = Math.sqrt(cx * cx + cy * cy);
  const gradient = ctx.createRadialGradient(cx, cy, radius * 0.28, cx, cy, radius);
  gradient.addColorStop(0, "rgba(0,0,0,0)");
  gradient.addColorStop(0.55, `rgba(0,0,0,${(opacity * 0.15).toFixed(3)})`);
  gradient.addColorStop(1, `rgba(0,0,0,${(opacity * 0.85).toFixed(3)})`);
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);
}

/** Apply filter + framing + vignette onto a canvas sized to the source (or target size). */
export async function renderAdjustedBaseImage(
  baseUrl: string,
  adj: MediaImageAdjustments,
  targetSize?: { width: number; height: number },
): Promise<ImageBitmap> {
  const res = await fetch(baseUrl);
  if (!res.ok) throw new Error("Não foi possível carregar a arte base.");
  const source = await res.blob();
  const bitmap = await createImageBitmap(source);
  const width = targetSize?.width ?? bitmap.width;
  const height = targetSize?.height ?? bitmap.height;

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    bitmap.close();
    throw new Error("Não foi possível processar a imagem.");
  }

  const normalized = normalizeImageAdjustments(adj);
  ctx.filter = imageAdjustmentsToCssFilter(normalized);
  drawImageWithFraming(ctx, bitmap, width, height, normalized);
  ctx.filter = "none";
  drawVignette(ctx, width, height, imageAdjustmentsVignetteOpacity(normalized));
  bitmap.close();

  const out = await createImageBitmap(canvas);
  return out;
}
