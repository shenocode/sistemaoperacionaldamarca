import { useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { useTranslation } from "react-i18next";
import { Plus, Trash2 } from "lucide-react";
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
import { cn } from "@/lib/utils";
import {
  BRAND_FONT_OPTIONS,
  brandFontFamilyCss,
  fontOptionsForSelect,
  loadBrandFonts,
  resolveBrandFont,
} from "@/lib/brand-fonts";
import {
  createTextLayer,
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
    const x = clamp01((event.clientX - (frameRef.current?.getBoundingClientRect().left ?? 0) - box.left) / box.width);
    const y = clamp01((event.clientY - (frameRef.current?.getBoundingClientRect().top ?? 0) - box.top) / box.height);
    onMove?.(id, x, y);
  }

  return (
    <div ref={frameRef} className={cn("relative h-full w-full overflow-hidden", className)}>
      <img
        ref={imgRef}
        src={overlay.baseUrl}
        alt=""
        className="h-full w-full object-contain"
        draggable={false}
      />
      {box.width > 0 ? (
        <div
          className="absolute overflow-hidden"
          style={{ left: box.left, top: box.top, width: box.width, height: box.height }}
        >
          {overlay.layers.map((layer) => {
            if (!layer.text.trim()) return null;
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
                  "absolute max-w-full select-none whitespace-pre-wrap break-words px-1 leading-tight",
                  interactive && "cursor-grab active:cursor-grabbing",
                  selected && "ring-2 ring-sky-400 ring-offset-1 ring-offset-transparent",
                )}
                style={{
                  left: `${layer.x * 100}%`,
                  top: `${layer.y * 100}%`,
                  width: `${layer.maxWidth * 100}%`,
                  transform: "translate(-50%, -50%)",
                  textAlign: layer.align,
                  color: layer.color,
                  fontFamily: brandFontFamilyCss(layer.fontFamily),
                  fontWeight: layer.fontWeight,
                  fontSize: `${Math.max(10, layer.fontSize * box.height)}px`,
                  textShadow: "0 1px 2px rgba(0,0,0,0.45)",
                }}
              >
                {layer.text}
              </div>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

function clamp01(value: number) {
  return Math.min(1, Math.max(0, value));
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
    <div className="flex h-full min-h-0 flex-col gap-3 overflow-y-auto p-4 text-foreground">
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
            {t("project.detail.artText.layer", { n: index + 1 })}
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
                      <SelectItem key={`pinned-${family}`} value={family} style={{ fontFamily: brandFontFamilyCss(family) }}>
                        {family} · {t("project.detail.artText.brandFont")}
                      </SelectItem>
                    ))}
                  </>
                ) : null}
                {options
                  .filter((font) => !pinned.includes(font.family))
                  .map((font) => (
                    <SelectItem key={font.id} value={font.family} style={{ fontFamily: brandFontFamilyCss(font.family) }}>
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
                onValueChange={(value) => patchLayer(selected.id, { fontWeight: value as "400" | "700" })}
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
                onValueChange={(value) => patchLayer(selected.id, { align: value as TextLayerAlign })}
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
              onValueChange={([value]) => patchLayer(selected.id, { fontSize: value ?? selected.fontSize })}
            />
          </div>
          <div className="space-y-1.5">
            <Label>{t("project.detail.artText.color")}</Label>
            {colors.length > 0 ? (
              <div className="flex flex-wrap gap-1.5">
                {colors.map((color, index) => (
                  <button
                    key={`${color.hex}-${index}`}
                    type="button"
                    title={color.name || color.hex}
                    className={cn(
                      "h-7 w-7 rounded-md border",
                      selected.color.toLowerCase() === color.hex.toLowerCase() && "ring-2 ring-ring",
                    )}
                    style={{ backgroundColor: color.hex }}
                    onClick={() => patchLayer(selected.id, { color: color.hex })}
                  />
                ))}
              </div>
            ) : null}
            <Input
              value={selected.color}
              onChange={(e) => patchLayer(selected.id, { color: e.target.value })}
              placeholder="#FFFFFF"
            />
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
  );
}
