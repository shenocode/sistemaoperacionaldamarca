import { useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { useTranslation } from "react-i18next";
import { Plus, RotateCcw, Trash2 } from "lucide-react";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import {
  BRAND_FONT_OPTIONS,
  brandFontFamilyCss,
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
  type MediaImageAdjustments,
  type MediaTextLayer,
  type MediaTextOverlay,
  type TextLayerAlign,
} from "@/lib/media-text-overlay";
import type { BrandColor } from "@/lib/api";

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

  useEffect(() => {
    void loadBrandFonts(families);
  }, [families]);

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
                  "absolute z-10 max-w-full select-none whitespace-pre-wrap break-words px-1 leading-tight",
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
                  fontSize: `${Math.max(10, layer.fontSize * box.height)}px`,
                  textShadow: empty ? "none" : "0 1px 2px rgba(0,0,0,0.45)",
                }}
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

export function ArtTextEditorPanel({
  overlay,
  selectedId,
  onSelect,
  onChange,
  brandFonts,
  colors,
}: {
  overlay: MediaTextOverlay;
  selectedId: string | null;
  onSelect: (id: string) => void;
  onChange: (overlay: MediaTextOverlay) => void;
  brandFonts: { primary?: string; secondary?: string };
  colors: BrandColor[];
}) {
  const { t } = useTranslation();
  const selected = overlay.layers.find((layer) => layer.id === selectedId) ?? overlay.layers[0] ?? null;
  const options = fontOptionsForSelect(selected?.fontFamily);
  const pinned = [...new Set(
    [brandFonts.primary, brandFonts.secondary]
      .map((name) => (name ?? "").trim())
      .filter(Boolean),
  )];
  const adjustments = normalizeImageAdjustments(
    overlay.adjustments ?? createDefaultImageAdjustments(),
  );

  useEffect(() => {
    void loadBrandFonts([
      ...BRAND_FONT_OPTIONS.map((font) => font.family),
      ...pinned,
      selected?.fontFamily ?? "",
    ]);
  }, [pinned, selected?.fontFamily]);

  function patchLayer(id: string, patch: Partial<MediaTextLayer>) {
    onChange({
      ...overlay,
      layers: overlay.layers.map((layer) => (layer.id === id ? { ...layer, ...patch } : layer)),
    });
  }

  function addLayer() {
    const next = createTextLayer("", {
      role: "custom",
      label: t("project.detail.artText.layer", { n: overlay.layers.length + 1 }),
      fontFamily: resolveBrandFont(brandFonts.primary),
      fontWeight: "700",
      y: overlay.layers.length === 0 ? 0.22 : 0.5,
      color: colors[0]?.hex || "#FFFFFF",
    });
    onChange({ ...overlay, layers: [...overlay.layers, next] });
    onSelect(next.id);
  }

  function removeLayer(id: string) {
    const next = overlay.layers.filter((layer) => layer.id !== id);
    onChange({ ...overlay, layers: next });
    onSelect(next[0]?.id ?? "");
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
                    onValueChange={(value) => patchLayer(selected.id, { fontFamily: value })}
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
                            style={{ fontFamily: brandFontFamilyCss(font.family) }}
                          >
                            {font.family}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1.5">
                    <Label>{t("project.detail.artText.weight")}</Label>
                    <Select
                      value={selected.fontWeight}
                      onValueChange={(value) =>
                        patchLayer(selected.id, { fontWeight: value as "400" | "700" })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="400">{t("project.detail.artText.weightRegular")}</SelectItem>
                        <SelectItem value="700">{t("project.detail.artText.weightBold")}</SelectItem>
                      </SelectContent>
                    </Select>
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

        <TabsContent value="image" className="mt-0 min-h-0 flex-1 overflow-y-auto p-4">
          <ImageAdjustmentsPanel
            adjustments={adjustments}
            onChange={(next) => onChange({ ...overlay, adjustments: next })}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
