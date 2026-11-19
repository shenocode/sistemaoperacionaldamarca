import { useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { useTranslation } from "react-i18next";
import { ImagePlus, Loader2, Plus, RotateCcw, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ContentMediaLibraryPicker } from "@/components/content-media-library-picker";
import { cn } from "@/lib/utils";
import type { LibraryAsset } from "@/lib/api";
import {
  brandFontFamilyCss,
  brandFontNeedsFile,
  brandFontsToFaceMap,
  brandFontsToFileMap,
  facesForBrandFamily,
  fontOptionsForSelect,
  loadBrandFonts,
  resolveBrandFont,
} from "@/lib/brand-fonts";
import {
  ART_TEXT_EXTRA_COLORS,
  createDefaultImageAdjustments,
  createTextLayer,
  imageAdjustmentsAreDefault,
  imageAdjustmentsToCssFilter,
  imageAdjustmentsVignetteOpacity,
  MEDIA_IMAGE_FILTER_PRESETS,
  normalizeImageAdjustments,
  normalizeLetterSpacing,
  normalizeLineHeight,
  normalizeTextShadow,
  textLayerShadowCss,
  type MediaImageAdjustments,
  type MediaTextLayer,
  type MediaTextOverlay,
  type TextLayerAlign,
  type TextLayerShadow,
} from "@/lib/media-text-overlay";
import type { BrandColor, BrandFonts } from "@/lib/api";

function containedRect(
  containerW: number,
  containerH: number,
  naturalW: number,
  naturalH: number,
) {
  if (!containerW || !containerH || !naturalW || !naturalH) {
    return { left: 0, top: 0, width: containerW, height: containerH };
  }
  const scale = Math.min(containerW / naturalW, containerH / naturalH);
  const width = naturalW * scale;
  const height = naturalH * scale;
  return {
    left: (containerW - width) / 2,
    top: (containerH - height) / 2,
    width,
    height,
  };
}

function clamp01(value: number) {
  return Math.min(1, Math.max(0, value));
}

export function ArtTextOverlayView({
  overlay,
  selectedId,
  interactive,
  onSelect,
  onMove,
  className,
}: {
  overlay: MediaTextOverlay;
  selectedId?: string | null;
  interactive?: boolean;
  onSelect?: (id: string) => void;
  onMove?: (id: string, x: number, y: number) => void;
  className?: string;
}) {
  const frameRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const [box, setBox] = useState({ left: 0, top: 0, width: 0, height: 0 });
  const dragRef = useRef<{ id: string; pointerId: number } | null>(null);

  const adjustments = useMemo(
    () => normalizeImageAdjustments(overlay.adjustments ?? createDefaultImageAdjustments()),
    [overlay.adjustments],
  );
  const cssFilter = useMemo(() => imageAdjustmentsToCssFilter(adjustments), [adjustments]);
  const vignetteOpacity = useMemo(
    () => imageAdjustmentsVignetteOpacity(adjustments),
    [adjustments],
  );

  const families = useMemo(
    () => overlay.layers.map((layer) => layer.fontFamily),
    [overlay.layers],
  );
  const [fontsEpoch, setFontsEpoch] = useState(0);

  useEffect(() => {
    let cancelled = false;
    void loadBrandFonts(families, overlay.fontFiles, overlay.fontFaces).then(() => {
      if (!cancelled) setFontsEpoch((n) => n + 1);
    });
    return () => {
      cancelled = true;
    };
  }, [families, overlay.fontFiles, overlay.fontFaces]);

  useEffect(() => {
    const frame = frameRef.current;
    const img = imgRef.current;
    if (!frame || !img) return;

    const sync = () => {
      const next = containedRect(
        frame.clientWidth,
        frame.clientHeight,
        img.naturalWidth || 3,
        img.naturalHeight || 4,
      );
      setBox(next);
    };

    sync();
    const observer = new ResizeObserver(sync);
    observer.observe(frame);
    img.addEventListener("load", sync);
    return () => {
      observer.disconnect();
      img.removeEventListener("load", sync);
    };
  }, [overlay.baseUrl]);

  function pointerToNorm(event: ReactPointerEvent, id: string) {
    if (!box.width || !box.height) return;
    const x = clamp01(
      (event.clientX - (frameRef.current?.getBoundingClientRect().left ?? 0) - box.left) /
        box.width,
    );
    const y = clamp01(
      (event.clientY - (frameRef.current?.getBoundingClientRect().top ?? 0) - box.top) /
        box.height,
    );
    onMove?.(id, x, y);
  }

  return (
    <div ref={frameRef} className={cn("relative h-full w-full overflow-hidden", className)}>
      {/* Hidden probe for natural size / contained box */}
      <img
        ref={imgRef}
        src={overlay.baseUrl}
        alt=""
        className="pointer-events-none absolute opacity-0"
        draggable={false}
      />
      {box.width > 0 ? (
        <div
          className="absolute overflow-hidden bg-black"
          style={{ left: box.left, top: box.top, width: box.width, height: box.height }}
        >
          <img
            src={overlay.baseUrl}
            alt=""
            className="h-full w-full max-w-none object-cover"
            draggable={false}
            style={{
              filter: cssFilter,
              transform: `scale(${adjustments.zoom})`,
              transformOrigin: `${adjustments.focusX * 100}% ${adjustments.focusY * 100}%`,
            }}
          />
          {vignetteOpacity > 0.001 ? (
            <div
              className="pointer-events-none absolute inset-0"
              style={{
                background: `radial-gradient(circle at center, transparent 28%, rgba(0,0,0,${(
                  vignetteOpacity * 0.15
                ).toFixed(3)}) 55%, rgba(0,0,0,${(vignetteOpacity * 0.85).toFixed(3)}) 100%)`,
              }}
            />
          ) : null}
          {overlay.layers.map((layer) => {
            const empty = !layer.text.trim();
            if (empty && !interactive) return null;
            const selected = selectedId === layer.id;
            const fontPx = Math.max(10, layer.fontSize * box.height);
            const lineHeight = normalizeLineHeight(layer.lineHeight);
            const letterSpacing = normalizeLetterSpacing(layer.letterSpacing);
            return (
              <div
                key={layer.id}
                role={interactive ? "button" : undefined}
                tabIndex={interactive ? 0 : undefined}
                onPointerDown={
                  interactive
                    ? (event) => {
                        event.preventDefault();
                        event.stopPropagation();
                        onSelect?.(layer.id);
                        event.currentTarget.setPointerCapture(event.pointerId);
                        dragRef.current = { id: layer.id, pointerId: event.pointerId };
                      }
                    : undefined
                }
                onPointerMove={
                  interactive
                    ? (event) => {
                        if (dragRef.current?.id !== layer.id) return;
                        pointerToNorm(event, layer.id);
                      }
                    : undefined
                }
                onPointerUp={
                  interactive
                    ? () => {
                        dragRef.current = null;
                      }
                    : undefined
                }
                onClick={interactive ? () => onSelect?.(layer.id) : undefined}
                className={cn(
                  "absolute z-10 max-w-full select-none whitespace-pre-wrap break-words",
                  interactive && "cursor-grab active:cursor-grabbing",
                  selected && "ring-2 ring-sky-400 ring-offset-1 ring-offset-transparent",
                  empty && "rounded border border-dashed border-white/50 bg-black/25 px-2 py-1",
                )}
                style={{
                  left: `${layer.x * 100}%`,
                  top: `${layer.y * 100}%`,
                  width: `${layer.maxWidth * 100}%`,
                  transform: "translate(-50%, -50%)",
                  textAlign: layer.align,
                  color: empty ? "rgba(255,255,255,0.65)" : layer.color,
                  opacity: empty ? 1 : layer.opacity ?? 1,
                  fontFamily: brandFontFamilyCss(layer.fontFamily),
                  fontWeight: layer.fontWeight,
                  fontStyle: layer.fontStyle === "italic" ? "italic" : "normal",
                  fontSize: `${fontPx}px`,
                  lineHeight,
                  letterSpacing: `${letterSpacing}em`,
                  textShadow: empty ? "none" : textLayerShadowCss(layer, fontPx),
                }}
                data-fonts-epoch={fontsEpoch}
              >
                {empty ? layer.label || "…" : layer.text}
              </div>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

function AdjustmentSlider({
  label,
  value,
  min,
  max,
  step = 1,
  onChange,
  formatValue,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (value: number) => void;
  formatValue?: (value: number) => string;
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between gap-2">
        <Label className="text-xs">{label}</Label>
        <span className="text-[11px] tabular-nums text-muted-foreground">
          {formatValue ? formatValue(value) : value}
        </span>
      </div>
      <Slider
        min={min}
        max={max}
        step={step}
        value={[value]}
        onValueChange={([next]) => onChange(next ?? value)}
      />
    </div>
  );
}

function isReplaceableLibraryImage(asset: LibraryAsset) {
  if (!asset.file_url?.trim()) return false;
  if (asset.category === "images" || asset.category === "generated_arts") return true;
  return Boolean(asset.mime_type?.startsWith("image/"));
}

function ImageReplacePanel({
  clientId,
  onReplaceImageFile,
  onReplaced,
}: {
  clientId?: string;
  onReplaceImageFile?: (file: File) => Promise<string>;
  onReplaced: (url: string) => void;
}) {
  const { t } = useTranslation();
  const fileRef = useRef<HTMLInputElement>(null);
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const canUpload = Boolean(onReplaceImageFile);
  const canLibrary = Boolean(clientId);
  if (!canUpload && !canLibrary) return null;

  async function applyFile(file: File) {
    if (!onReplaceImageFile) return;
    setBusy(true);
    try {
      const url = await onReplaceImageFile(file);
      if (!url.trim()) throw new Error(t("project.detail.artText.replaceImageError"));
      onReplaced(url);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("project.detail.artText.replaceImageError"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-2 border-b pb-4">
      <div className="space-y-1">
        <p className="text-sm font-medium">{t("project.detail.artText.replaceImage")}</p>
        <p className="text-xs text-muted-foreground">{t("project.detail.artText.replaceImageHint")}</p>
      </div>
      <div className="flex flex-wrap gap-2">
        {canUpload ? (
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={busy}
            onClick={() => fileRef.current?.click()}
          >
            {busy ? <Loader2 className="mr-1 size-3.5 animate-spin" /> : <ImagePlus className="mr-1 size-3.5" />}
            {busy
              ? t("project.detail.artText.replacingImage")
              : t("project.detail.artText.replaceImageUpload")}
          </Button>
        ) : null}
        {canLibrary ? (
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={busy}
            onClick={() => setLibraryOpen(true)}
          >
            {t("project.detail.artText.replaceImageLibrary")}
          </Button>
        ) : null}
      </div>
      <input
        ref={fileRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp"
        className="sr-only"
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.target.value = "";
          if (file) void applyFile(file);
        }}
      />
      {clientId ? (
        <ContentMediaLibraryPicker
          clientId={clientId}
          open={libraryOpen}
          onOpenChange={setLibraryOpen}
          onSelect={(asset) => {
            if (!isReplaceableLibraryImage(asset) || !asset.file_url) {
              toast.error(t("project.detail.artText.replaceImageError"));
              return;
            }
            onReplaced(asset.file_url);
            setLibraryOpen(false);
          }}
        />
      ) : null}
    </div>
  );
}

function ImageAdjustmentsPanel({
  adjustments,
  onChange,
}: {
  adjustments: MediaImageAdjustments;
  onChange: (next: MediaImageAdjustments) => void;
}) {
  const { t } = useTranslation();
  const adj = normalizeImageAdjustments(adjustments);

  function patch(partial: Partial<MediaImageAdjustments>) {
    onChange(normalizeImageAdjustments({ ...adj, ...partial }));
  }

  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <p className="text-sm font-medium">{t("project.detail.artText.imageTitle")}</p>
        <p className="text-xs text-muted-foreground">{t("project.detail.artText.imageHint")}</p>
      </div>

      <div className="space-y-1.5">
        <Label className="text-xs">{t("project.detail.artText.filters")}</Label>
        <div className="grid grid-cols-3 gap-1.5">
          {MEDIA_IMAGE_FILTER_PRESETS.map((preset) => (
            <button
              key={preset}
              type="button"
              onClick={() => patch({ preset })}
              className={cn(
                "rounded-md border px-1.5 py-2 text-center text-[11px] font-medium transition-colors",
                adj.preset === preset
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-muted/40 text-foreground hover:bg-muted",
              )}
            >
              {t(`project.detail.artText.filterPresets.${preset}`)}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-3">
        <p className="text-xs font-medium text-muted-foreground">
          {t("project.detail.artText.adjustments")}
        </p>
        <AdjustmentSlider
          label={t("project.detail.artText.brightness")}
          value={adj.brightness}
          min={-100}
          max={100}
          onChange={(brightness) => patch({ brightness })}
        />
        <AdjustmentSlider
          label={t("project.detail.artText.contrast")}
          value={adj.contrast}
          min={-100}
          max={100}
          onChange={(contrast) => patch({ contrast })}
        />
        <AdjustmentSlider
          label={t("project.detail.artText.saturation")}
          value={adj.saturation}
          min={-100}
          max={100}
          onChange={(saturation) => patch({ saturation })}
        />
        <AdjustmentSlider
          label={t("project.detail.artText.warmth")}
          value={adj.warmth}
          min={-100}
          max={100}
          onChange={(warmth) => patch({ warmth })}
        />
        <AdjustmentSlider
          label={t("project.detail.artText.fade")}
          value={adj.fade}
          min={0}
          max={100}
          onChange={(fade) => patch({ fade })}
        />
        <AdjustmentSlider
          label={t("project.detail.artText.vignette")}
          value={adj.vignette}
          min={0}
          max={100}
          onChange={(vignette) => patch({ vignette })}
        />
      </div>

      <div className="space-y-3 border-t pt-3">
        <p className="text-xs font-medium text-muted-foreground">
          {t("project.detail.artText.framing")}
        </p>
        <AdjustmentSlider
          label={t("project.detail.artText.zoom")}
          value={adj.zoom}
          min={1}
          max={2.5}
          step={0.01}
          formatValue={(value) => `${Math.round(value * 100)}%`}
          onChange={(zoom) => patch({ zoom })}
        />
        <AdjustmentSlider
          label={t("project.detail.artText.focusX")}
          value={adj.focusX}
          min={0}
          max={1}
          step={0.01}
          formatValue={(value) => `${Math.round(value * 100)}%`}
          onChange={(focusX) => patch({ focusX })}
        />
        <AdjustmentSlider
          label={t("project.detail.artText.focusY")}
          value={adj.focusY}
          min={0}
          max={1}
          step={0.01}
          formatValue={(value) => `${Math.round(value * 100)}%`}
          onChange={(focusY) => patch({ focusY })}
        />
      </div>

      {!imageAdjustmentsAreDefault(adj) ? (
        <Button
          type="button"
          size="sm"
          variant="ghost"
          className="w-full"
          onClick={() => onChange(createDefaultImageAdjustments())}
        >
          <RotateCcw className="mr-1 size-3.5" />
          {t("project.detail.artText.resetImage")}
        </Button>
      ) : null}
    </div>
  );
}

function TextShadowControls({
  shadow,
  onChange,
}: {
  shadow: TextLayerShadow;
  onChange: (next: TextLayerShadow) => void;
}) {
  const { t } = useTranslation();
  const colorValue = /^#[0-9a-fA-F]{6}$/.test(shadow.color) ? shadow.color : "#000000";

  return (
    <div className="space-y-3 rounded-md border p-3">
      <div className="flex items-center justify-between gap-2">
        <Label>{t("project.detail.artText.shadow")}</Label>
        <Switch
          checked={shadow.enabled}
          onCheckedChange={(enabled) => onChange({ ...shadow, enabled })}
          aria-label={t("project.detail.artText.shadow")}
        />
      </div>
      {shadow.enabled ? (
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label className="text-xs">{t("project.detail.artText.shadowColor")}</Label>
            <div className="flex items-center gap-2">
              <input
                type="color"
                aria-label={t("project.detail.artText.shadowColor")}
                className="h-8 w-10 cursor-pointer rounded border bg-transparent p-0.5"
                value={colorValue}
                onChange={(event) => onChange({ ...shadow, color: event.target.value })}
              />
              <Input
                value={shadow.color}
                onChange={(event) => onChange({ ...shadow, color: event.target.value })}
                placeholder="#000000"
                className="flex-1"
              />
            </div>
          </div>
          <AdjustmentSlider
            label={t("project.detail.artText.shadowTransparency")}
            value={1 - shadow.opacity}
            min={0}
            max={0.95}
            step={0.01}
            formatValue={(value) => `${Math.round(value * 100)}%`}
            onChange={(transparency) => onChange({ ...shadow, opacity: 1 - transparency })}
          />
          <AdjustmentSlider
            label={t("project.detail.artText.shadowOffsetX")}
            value={shadow.offsetX}
            min={-0.3}
            max={0.3}
            step={0.01}
            formatValue={(value) => `${Math.round(value * 100)}%`}
            onChange={(offsetX) => onChange({ ...shadow, offsetX })}
          />
          <AdjustmentSlider
            label={t("project.detail.artText.shadowOffsetY")}
            value={shadow.offsetY}
            min={-0.3}
            max={0.3}
            step={0.01}
            formatValue={(value) => `${Math.round(value * 100)}%`}
            onChange={(offsetY) => onChange({ ...shadow, offsetY })}
          />
          <AdjustmentSlider
            label={t("project.detail.artText.shadowBlur")}
            value={shadow.blur}
            min={0}
            max={0.4}
            step={0.01}
            formatValue={(value) => `${Math.round(value * 100)}%`}
            onChange={(blur) => onChange({ ...shadow, blur })}
          />
        </div>
      ) : null}
    </div>
  );
}

export function ArtTextEditorPanel({
  overlay,
  selectedId,
  onSelect,
  onChange,
  brandFonts,
  colors,
  clientId,
  onReplaceImageFile,
}: {
  overlay: MediaTextOverlay;
  selectedId: string | null;
  onSelect: (id: string) => void;
  onChange: (overlay: MediaTextOverlay) => void;
  brandFonts: BrandFonts;
  colors: BrandColor[];
  /** Lets the image tab swap the background without touching text layers. */
  clientId?: string;
  onReplaceImageFile?: (file: File) => Promise<string>;
}) {
  const { t } = useTranslation();
  const selected = overlay.layers.find((layer) => layer.id === selectedId) ?? overlay.layers[0] ?? null;
  const options = fontOptionsForSelect(selected?.fontFamily);
  const pinned = [...new Set(
    [
      brandFonts.primary,
      brandFonts.secondary,
      ...(brandFonts.extras ?? []).map((entry) => entry.family),
    ]
      .map((name) => (name ?? "").trim())
      .filter(Boolean),
  )];
  const faceMap = useMemo(() => brandFontsToFaceMap(brandFonts), [brandFonts]);
  const fontFiles = useMemo(
    () => ({
      ...(overlay.fontFiles ?? {}),
      ...brandFontsToFileMap(brandFonts),
    }),
    [overlay.fontFiles, brandFonts],
  );
  const fontFaces = useMemo(
    () => ({
      ...(overlay.fontFaces ?? {}),
      ...faceMap,
    }),
    [overlay.fontFaces, faceMap],
  );
  const adjustments = normalizeImageAdjustments(
    overlay.adjustments ?? createDefaultImageAdjustments(),
  );
  const selectedFaces = facesForBrandFamily(brandFonts, selected?.fontFamily);
  const selectedFaceKey = (() => {
    if (!selected || selectedFaces.length === 0) return "700:normal";
    const current = `${selected.fontWeight}:${selected.fontStyle === "italic" ? "italic" : "normal"}`;
    if (selectedFaces.some((face) => `${face.weight}:${face.style}` === current)) return current;
    const preferred =
      selectedFaces.find((face) => face.weight === "400" && face.style === "normal") ||
      selectedFaces[0];
    return `${preferred.weight}:${preferred.style}`;
  })();
  const selectedNeedsFile =
    Boolean(selected?.fontFamily?.trim()) &&
    brandFontNeedsFile(selected?.fontFamily) &&
    !fontFiles[selected?.fontFamily?.trim() ?? ""] &&
    selectedFaces.length === 0;

  useEffect(() => {
    void loadBrandFonts([...pinned, selected?.fontFamily ?? ""], fontFiles, fontFaces);
  }, [pinned, selected?.fontFamily, fontFiles, fontFaces]);

  function patchLayer(id: string, patch: Partial<MediaTextLayer>) {
    onChange({
      ...overlay,
      fontFiles,
      fontFaces,
      layers: overlay.layers.map((layer) => (layer.id === id ? { ...layer, ...patch } : layer)),
    });
  }

  function addLayer() {
    const next = createTextLayer("", {
      role: "custom",
      label: t("project.detail.artText.layer", { n: overlay.layers.length + 1 }),
      fontFamily: resolveBrandFont(brandFonts.primary),
      fontWeight: "700",
      fontStyle: "normal",
      y: overlay.layers.length === 0 ? 0.22 : 0.5,
      color: colors[0]?.hex || "#FFFFFF",
    });
    onChange({ ...overlay, fontFiles, fontFaces, layers: [...overlay.layers, next] });
    onSelect(next.id);
  }

  function removeLayer(id: string) {
    const next = overlay.layers.filter((layer) => layer.id !== id);
    onChange({ ...overlay, fontFiles, fontFaces, layers: next });
    onSelect(next[0]?.id ?? "");
  }

  function applyFamily(family: string) {
    if (!selected) return;
    const wantItalic = selected.fontStyle === "italic";
    const faces = facesForBrandFamily(brandFonts, family);
    if (faces.length > 0) {
      const preferred =
        (wantItalic
          ? faces.find((face) => face.weight === selected.fontWeight && face.style === "italic") ||
            faces.find((face) => face.style === "italic")
          : undefined) ||
        faces.find((face) => face.weight === "400" && face.style === "normal") ||
        faces.find((face) => face.style === "normal") ||
        faces[0];
      patchLayer(selected.id, {
        fontFamily: family,
        fontWeight: preferred.weight,
        fontStyle: wantItalic ? "italic" : preferred.style,
      });
      return;
    }
    patchLayer(selected.id, {
      fontFamily: family,
      fontStyle: wantItalic ? "italic" : "normal",
    });
  }

  function applyItalic(enabled: boolean) {
    if (!selected) return;
    const style = enabled ? "italic" : "normal";
    const match =
      selectedFaces.find((face) => face.weight === selected.fontWeight && face.style === style) ||
      selectedFaces.find((face) => face.style === style);
    if (match) {
      patchLayer(selected.id, { fontWeight: match.weight, fontStyle: match.style });
      return;
    }
    patchLayer(selected.id, { fontStyle: style });
  }

  function applyFace(faceKey: string) {
    if (!selected) return;
    const [weight, style] = faceKey.split(":");
    patchLayer(selected.id, {
      fontWeight: weight || "400",
      fontStyle: style === "italic" ? "italic" : "normal",
    });
  }

  return (
    <div className="flex h-full min-h-0 flex-col text-foreground">
      <Tabs defaultValue="text" className="flex min-h-0 flex-1 flex-col">
        <div className="border-b px-4 pt-3">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="text">{t("project.detail.artText.tabText")}</TabsTrigger>
            <TabsTrigger value="image">{t("project.detail.artText.tabImage")}</TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="text" className="mt-0 min-h-0 flex-1 overflow-y-auto p-4">
          <div className="space-y-3">
            <div className="space-y-1">
              <p className="text-sm font-medium">{t("project.detail.artText.title")}</p>
              <p className="text-xs text-muted-foreground">{t("project.detail.artText.hint")}</p>
            </div>

            <div className="flex flex-wrap gap-1.5">
              {overlay.layers.map((layer, index) => (
                <Button
                  key={layer.id}
                  type="button"
                  size="sm"
                  variant={layer.id === selected?.id ? "default" : "outline"}
                  onClick={() => onSelect(layer.id)}
                >
                  {layer.label?.trim() || t("project.detail.artText.layer", { n: index + 1 })}
                </Button>
              ))}
              <Button type="button" size="sm" variant="outline" onClick={addLayer}>
                <Plus className="mr-1 size-3.5" />
                {t("project.detail.artText.addLayer")}
              </Button>
            </div>

            {selected ? (
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <Label>{t("project.detail.artText.text")}</Label>
                  <Textarea
                    rows={3}
                    value={selected.text}
                    onChange={(e) => patchLayer(selected.id, { text: e.target.value })}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>{t("project.detail.artText.font")}</Label>
                  <Select
                    value={resolveBrandFont(selected.fontFamily, selected.fontFamily)}
                    onValueChange={applyFamily}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {pinned.length > 0 ? (
                        <>
                          {pinned.map((family) => (
                            <SelectItem
                              key={`pinned-${family}`}
                              value={family}
                              style={{ fontFamily: brandFontFamilyCss(family) }}
                            >
                              {family} · {t("project.detail.artText.brandFont")}
                            </SelectItem>
                          ))}
                        </>
                      ) : null}
                      {options
                        .filter((font) => !pinned.includes(font.family))
                        .map((font) => (
                          <SelectItem
                            key={font.id}
                            value={font.family}
                            style={
                              font.source === "google"
                                ? { fontFamily: brandFontFamilyCss(font.family) }
                                : undefined
                            }
                          >
                            {font.source === "kit"
                              ? `${font.family} · ${t("project.detail.artText.brandFontFile")}`
                              : font.family}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                  {selectedNeedsFile ? (
                    <p className="text-xs text-amber-600 dark:text-amber-400">
                      {t("project.detail.artText.fontFileMissing")}
                    </p>
                  ) : null}
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1.5">
                    <Label>
                      {selectedFaces.length > 0
                        ? t("project.detail.artText.variant")
                        : t("project.detail.artText.weight")}
                    </Label>
                    {selectedFaces.length > 0 ? (
                      <Select value={selectedFaceKey} onValueChange={applyFace}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {selectedFaces.map((face) => {
                            const key = `${face.weight}:${face.style}`;
                            return (
                              <SelectItem key={key} value={key}>
                                {face.label}
                              </SelectItem>
                            );
                          })}
                        </SelectContent>
                      </Select>
                    ) : (
                      <Select
                        value={selected.fontWeight === "400" ? "400" : "700"}
                        onValueChange={(value) => patchLayer(selected.id, { fontWeight: value })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="400">
                            {t("project.detail.artText.weightRegular")}
                          </SelectItem>
                          <SelectItem value="700">
                            {t("project.detail.artText.weightBold")}
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    )}
                  </div>
                  <div className="space-y-1.5">
                    <Label>{t("project.detail.artText.align")}</Label>
                    <Select
                      value={selected.align}
                      onValueChange={(value) =>
                        patchLayer(selected.id, { align: value as TextLayerAlign })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="left">{t("project.detail.artText.alignLeft")}</SelectItem>
                        <SelectItem value="center">{t("project.detail.artText.alignCenter")}</SelectItem>
                        <SelectItem value="right">{t("project.detail.artText.alignRight")}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <Label htmlFor="art-text-italic">{t("project.detail.artText.italic")}</Label>
                  <Switch
                    id="art-text-italic"
                    checked={selected.fontStyle === "italic"}
                    onCheckedChange={applyItalic}
                    aria-label={t("project.detail.artText.italic")}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>{t("project.detail.artText.size")}</Label>
                  <Slider
                    min={0.022}
                    max={0.12}
                    step={0.002}
                    value={[selected.fontSize]}
                    onValueChange={([value]) =>
                      patchLayer(selected.id, { fontSize: value ?? selected.fontSize })
                    }
                  />
                </div>
                <AdjustmentSlider
                  label={t("project.detail.artText.lineHeight")}
                  value={normalizeLineHeight(selected.lineHeight)}
                  min={0.8}
                  max={2}
                  step={0.05}
                  formatValue={(value) => value.toFixed(2)}
                  onChange={(lineHeight) => patchLayer(selected.id, { lineHeight })}
                />
                <AdjustmentSlider
                  label={t("project.detail.artText.letterSpacing")}
                  value={normalizeLetterSpacing(selected.letterSpacing)}
                  min={-0.08}
                  max={0.3}
                  step={0.005}
                  formatValue={(value) => `${value.toFixed(2)} em`}
                  onChange={(letterSpacing) => patchLayer(selected.id, { letterSpacing })}
                />
                <TextShadowControls
                  shadow={normalizeTextShadow(selected.shadow)}
                  onChange={(shadow) => patchLayer(selected.id, { shadow })}
                />
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <Label>{t("project.detail.artText.opacity")}</Label>
                    <span className="text-xs tabular-nums text-muted-foreground">
                      {Math.round((selected.opacity ?? 1) * 100)}%
                    </span>
                  </div>
                  <Slider
                    min={0.1}
                    max={1}
                    step={0.01}
                    value={[selected.opacity ?? 1]}
                    onValueChange={([value]) =>
                      patchLayer(selected.id, { opacity: value ?? selected.opacity ?? 1 })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label>{t("project.detail.artText.color")}</Label>
                  {colors.length > 0 ? (
                    <div className="space-y-1">
                      <p className="text-[11px] text-muted-foreground">
                        {t("project.detail.artText.brandColors")}
                      </p>
                      <div className="flex flex-wrap gap-1.5">
                        {colors.map((color, index) => (
                          <button
                            key={`brand-${color.hex}-${index}`}
                            type="button"
                            title={color.name || color.hex}
                            className={cn(
                              "h-7 w-7 rounded-md border",
                              selected.color.toLowerCase() === color.hex.toLowerCase() &&
                                "ring-2 ring-ring",
                            )}
                            style={{ backgroundColor: color.hex }}
                            onClick={() => patchLayer(selected.id, { color: color.hex })}
                          />
                        ))}
                      </div>
                    </div>
                  ) : null}
                  <div className="space-y-1">
                    <p className="text-[11px] text-muted-foreground">
                      {t("project.detail.artText.extraColors")}
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {ART_TEXT_EXTRA_COLORS.filter(
                        (color) =>
                          !colors.some(
                            (brand) => brand.hex.toLowerCase() === color.hex.toLowerCase(),
                          ),
                      ).map((color) => (
                        <button
                          key={`extra-${color.hex}`}
                          type="button"
                          title={color.name || color.hex}
                          className={cn(
                            "h-7 w-7 rounded-md border",
                            selected.color.toLowerCase() === color.hex.toLowerCase() &&
                              "ring-2 ring-ring",
                          )}
                          style={{ backgroundColor: color.hex }}
                          onClick={() => patchLayer(selected.id, { color: color.hex })}
                        />
                      ))}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      aria-label={t("project.detail.artText.colorPicker")}
                      className="h-8 w-10 cursor-pointer rounded border bg-transparent p-0.5"
                      value={
                        /^#[0-9a-fA-F]{6}$/.test(selected.color)
                          ? selected.color
                          : "#ffffff"
                      }
                      onChange={(e) => patchLayer(selected.id, { color: e.target.value })}
                    />
                    <Input
                      value={selected.color}
                      onChange={(e) => patchLayer(selected.id, { color: e.target.value })}
                      placeholder="#FFFFFF"
                      className="flex-1"
                    />
                  </div>
                </div>
                {overlay.layers.length > 0 ? (
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    className="text-destructive"
                    onClick={() => removeLayer(selected.id)}
                  >
                    <Trash2 className="mr-1 size-3.5" />
                    {t("project.detail.artText.removeLayer")}
                  </Button>
                ) : null}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">{t("project.detail.artText.empty")}</p>
            )}
          </div>
        </TabsContent>

        <TabsContent value="image" className="mt-0 min-h-0 flex-1 space-y-4 overflow-y-auto p-4">
          <ImageReplacePanel
            clientId={clientId}
            onReplaceImageFile={onReplaceImageFile}
            onReplaced={(url) => onChange({ ...overlay, baseUrl: url })}
          />
          <ImageAdjustmentsPanel
            adjustments={adjustments}
            onChange={(next) => onChange({ ...overlay, adjustments: next })}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
