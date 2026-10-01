import { useEffect, useRef, useState } from "react";
import { Plus, Trash2, Upload } from "lucide-react";
import { useTranslation } from "react-i18next";
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
import {
  BRAND_FONT_ACCEPT,
  MAX_BRAND_COLORS,
  uploadBrandFont,
  type BrandColor,
  type BrandFonts,
} from "@/lib/api";
import {
  brandFontFamilyCss,
  brandFontsToFileMap,
  fontOptionsForSelect,
  isGoogleBrandFont,
  loadBrandFonts,
} from "@/lib/brand-fonts";

const FONT_NONE = "__none__";
const FONT_CUSTOM = "__custom__";

export type BrandKitValue = {
  brand_colors: BrandColor[];
  brand_fonts: BrandFonts;
  brand_guidance: string;
};

export function BrandKitFields({
  value,
  onChange,
  clientId,
  idPrefix = "brand-kit",
  showHeader = true,
}: {
  value: BrandKitValue;
  onChange: (next: BrandKitValue) => void;
  /** Required to upload custom font files. */
  clientId?: string;
  idPrefix?: string;
  showHeader?: boolean;
}) {
  const { t } = useTranslation();
  const colors = value.brand_colors ?? [];
  const fonts = value.brand_fonts ?? {};
  const primaryOptions = fontOptionsForSelect(fonts.primary);
  const secondaryOptions = fontOptionsForSelect(fonts.secondary);
  const [customPrimary, setCustomPrimary] = useState(
    () => Boolean(fonts.primary?.trim() && !isGoogleBrandFont(fonts.primary)),
  );
  const [customSecondary, setCustomSecondary] = useState(
    () => Boolean(fonts.secondary?.trim() && !isGoogleBrandFont(fonts.secondary)),
  );
  const [uploadingSlot, setUploadingSlot] = useState<"primary" | "secondary" | null>(null);
  const primaryFileRef = useRef<HTMLInputElement>(null);
  const secondaryFileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    void loadBrandFonts(
      [fonts.primary ?? "", fonts.secondary ?? ""],
      brandFontsToFileMap(fonts),
    );
  }, [fonts.primary, fonts.secondary, fonts.primaryFileUrl, fonts.secondaryFileUrl]);

  function setColors(next: BrandColor[]) {
    onChange({ ...value, brand_colors: next });
  }

  function setFonts(patch: Partial<BrandFonts>) {
    onChange({ ...value, brand_fonts: { ...fonts, ...patch } });
  }

  function updateColor(index: number, patch: Partial<BrandColor>) {
    setColors(colors.map((color, i) => (i === index ? { ...color, ...patch } : color)));
  }

  async function handleFontUpload(slot: "primary" | "secondary", file: File | undefined) {
    if (!file) return;
    if (!clientId) {
      toast.error(t("clients.brandKit.fontUploadNoClient"));
      return;
    }
    setUploadingSlot(slot);
    try {
      const url = await uploadBrandFont(clientId, file);
      const familyFromName = file.name.replace(/\.(woff2?|ttf|otf)$/i, "").replace(/[-_]+/g, " ").trim();
      if (slot === "primary") {
        const family = fonts.primary?.trim() || familyFromName || "Custom Font";
        setCustomPrimary(true);
        setFonts({ primary: family, primaryFileUrl: url });
      } else {
        const family = fonts.secondary?.trim() || familyFromName || "Custom Font";
        setCustomSecondary(true);
        setFonts({ secondary: family, secondaryFileUrl: url });
      }
      toast.success(t("clients.brandKit.fontUploadOk"));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("clients.brandKit.fontUploadError"));
    } finally {
      setUploadingSlot(null);
    }
  }

  function renderFontSlot(slot: "primary" | "secondary") {
    const family = slot === "primary" ? fonts.primary : fonts.secondary;
    const fileUrl = slot === "primary" ? fonts.primaryFileUrl : fonts.secondaryFileUrl;
    const options = slot === "primary" ? primaryOptions : secondaryOptions;
    const customMode = slot === "primary" ? customPrimary : customSecondary;
    const setCustom = slot === "primary" ? setCustomPrimary : setCustomSecondary;
    const fileRef = slot === "primary" ? primaryFileRef : secondaryFileRef;
    const label =
      slot === "primary" ? t("clients.brandKit.fontPrimary") : t("clients.brandKit.fontSecondary");
    const selectId = `${idPrefix}-font-${slot}`;
    const needsFile = Boolean(family?.trim()) && !isGoogleBrandFont(family) && !fileUrl?.trim();

    return (
      <div className="space-y-1.5">
        <Label htmlFor={selectId}>{label}</Label>
        <Select
          value={customMode ? FONT_CUSTOM : family?.trim() || FONT_NONE}
          onValueChange={(next) => {
            if (next === FONT_NONE) {
              setCustom(false);
              setFonts(
                slot === "primary"
                  ? { primary: "", primaryFileUrl: "" }
                  : { secondary: "", secondaryFileUrl: "" },
              );
              return;
            }
            if (next === FONT_CUSTOM) {
              setCustom(true);
              if (isGoogleBrandFont(family)) {
                setFonts(slot === "primary" ? { primary: "" } : { secondary: "" });
              }
              return;
            }
            setCustom(false);
            setFonts(
              slot === "primary"
                ? { primary: next, primaryFileUrl: "" }
                : { secondary: next, secondaryFileUrl: "" },
            );
          }}
        >
          <SelectTrigger id={selectId}>
            <SelectValue placeholder={t("clients.brandKit.fontSelect")} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={FONT_NONE}>{t("clients.brandKit.fontNone")}</SelectItem>
            <SelectItem value={FONT_CUSTOM}>{t("clients.brandKit.fontCustom")}</SelectItem>
            {options
              .filter((font) => isGoogleBrandFont(font.family))
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

        {customMode ? (
          <div className="space-y-2 rounded-md border border-dashed p-3">
            <div className="space-y-1.5">
              <Label htmlFor={`${selectId}-name`}>{t("clients.brandKit.fontCustomName")}</Label>
              <Input
                id={`${selectId}-name`}
                value={family ?? ""}
                onChange={(e) =>
                  setFonts(slot === "primary" ? { primary: e.target.value } : { secondary: e.target.value })
                }
                placeholder={t("clients.brandKit.fontCustomNamePlaceholder")}
              />
            </div>
            <input
              ref={fileRef}
              type="file"
              accept={BRAND_FONT_ACCEPT}
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                e.target.value = "";
                void handleFontUpload(slot, file);
              }}
            />
            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={!clientId || uploadingSlot === slot}
                onClick={() => fileRef.current?.click()}
              >
                <Upload className="mr-1.5 h-4 w-4" aria-hidden="true" />
                {uploadingSlot === slot
                  ? t("clients.brandKit.fontUploading")
                  : fileUrl?.trim()
                    ? t("clients.brandKit.fontReplaceFile")
                    : t("clients.brandKit.fontUploadFile")}
              </Button>
              {fileUrl?.trim() ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() =>
                    setFonts(
                      slot === "primary" ? { primaryFileUrl: "" } : { secondaryFileUrl: "" },
                    )
                  }
                >
                  {t("clients.brandKit.fontClearFile")}
                </Button>
              ) : null}
            </div>
            {fileUrl?.trim() ? (
              <p className="text-xs text-muted-foreground">{t("clients.brandKit.fontFileReady")}</p>
            ) : (
              <p className="text-xs text-amber-600 dark:text-amber-400">
                {t("clients.brandKit.fontFileHint")}
              </p>
            )}
          </div>
        ) : null}

        {needsFile && !customMode ? (
          <p className="text-xs text-amber-600 dark:text-amber-400">
            {t("clients.brandKit.fontFileHint")}
          </p>
        ) : null}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {showHeader ? (
        <div className="space-y-1">
          <p className="text-sm font-medium">{t("clients.brandKit.title")}</p>
          <p className="text-xs text-muted-foreground">{t("clients.brandKit.hint")}</p>
        </div>
      ) : null}

      <div className="space-y-2">
        <div className="flex items-center justify-between gap-2">
          <Label>{t("clients.brandKit.colors")}</Label>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={colors.length >= MAX_BRAND_COLORS}
            onClick={() =>
              setColors([...colors, { name: "", hex: "#000000" }])
            }
          >
            <Plus className="mr-1.5 h-4 w-4" aria-hidden="true" />
            {t("clients.brandKit.addColor")}
          </Button>
        </div>
        {colors.length === 0 ? (
          <p className="text-xs text-muted-foreground">{t("clients.brandKit.noColors")}</p>
        ) : (
          <ul className="space-y-2">
            {colors.map((color, index) => (
              <li key={`${idPrefix}-color-${index}`} className="flex items-end gap-2">
                <div
                  className="mb-2 h-9 w-9 shrink-0 rounded-md border"
                  style={{ backgroundColor: normalizeHex(color.hex) || "#000000" }}
                  aria-hidden="true"
                />
                <div className="min-w-0 flex-1 space-y-1.5">
                  <Label htmlFor={`${idPrefix}-color-name-${index}`}>
                    {t("clients.brandKit.colorName")}
                  </Label>
                  <Input
                    id={`${idPrefix}-color-name-${index}`}
                    value={color.name}
                    onChange={(e) => updateColor(index, { name: e.target.value })}
                    placeholder={t("clients.brandKit.colorNamePlaceholder")}
                  />
                </div>
                <div className="w-28 space-y-1.5">
                  <Label htmlFor={`${idPrefix}-color-hex-${index}`}>
                    {t("clients.brandKit.colorHex")}
                  </Label>
                  <Input
                    id={`${idPrefix}-color-hex-${index}`}
                    value={color.hex}
                    onChange={(e) => updateColor(index, { hex: e.target.value })}
                    placeholder="#1A1A1A"
                  />
                </div>
                <input
                  type="color"
                  className="mb-2 h-9 w-10 cursor-pointer rounded border bg-transparent p-0"
                  value={normalizeHex(color.hex) || "#000000"}
                  onChange={(e) => updateColor(index, { hex: e.target.value.toUpperCase() })}
                  aria-label={t("clients.brandKit.colorPicker")}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="mb-1 shrink-0"
                  onClick={() => setColors(colors.filter((_, i) => i !== index))}
                  aria-label={t("clients.brandKit.removeColor")}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {renderFontSlot("primary")}
        {renderFontSlot("secondary")}
      </div>
      <div className="space-y-1.5">
        <Label htmlFor={`${idPrefix}-font-notes`}>{t("clients.brandKit.fontNotes")}</Label>
        <Textarea
          id={`${idPrefix}-font-notes`}
          rows={2}
          value={fonts.notes ?? ""}
          onChange={(e) => setFonts({ notes: e.target.value })}
          placeholder={t("clients.brandKit.fontNotesPlaceholder")}
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor={`${idPrefix}-guidance`}>{t("clients.brandKit.guidance")}</Label>
        <p className="text-xs text-muted-foreground">{t("clients.brandKit.guidanceHint")}</p>
        <Textarea
          id={`${idPrefix}-guidance`}
          rows={4}
          value={value.brand_guidance ?? ""}
          onChange={(e) => onChange({ ...value, brand_guidance: e.target.value })}
          placeholder={t("clients.brandKit.guidancePlaceholder")}
        />
      </div>
    </div>
  );
}

function normalizeHex(value: string | undefined): string {
  const raw = (value ?? "").trim();
  if (/^#[0-9A-Fa-f]{6}$/.test(raw)) return raw;
  if (/^[0-9A-Fa-f]{6}$/.test(raw)) return `#${raw}`;
  return "#000000";
}
