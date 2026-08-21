import { useEffect } from "react";
import { Plus, Trash2 } from "lucide-react";
import { useTranslation } from "react-i18next";
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
import { MAX_BRAND_COLORS, type BrandColor, type BrandFonts } from "@/lib/api";
import {
  brandFontFamilyCss,
  fontOptionsForSelect,
  loadBrandFonts,
} from "@/lib/brand-fonts";

const FONT_NONE = "__none__";

export type BrandKitValue = {
  brand_colors: BrandColor[];
  brand_fonts: BrandFonts;
  brand_guidance: string;
};

export function BrandKitFields({
  value,
  onChange,
  idPrefix = "brand-kit",
  showHeader = true,
}: {
  value: BrandKitValue;
  onChange: (next: BrandKitValue) => void;
  idPrefix?: string;
  showHeader?: boolean;
}) {
  const { t } = useTranslation();
  const colors = value.brand_colors ?? [];
  const fonts = value.brand_fonts ?? {};
  const primaryOptions = fontOptionsForSelect(fonts.primary);
  const secondaryOptions = fontOptionsForSelect(fonts.secondary);

  useEffect(() => {
    void loadBrandFonts([fonts.primary ?? "", fonts.secondary ?? ""]);
  }, [fonts.primary, fonts.secondary]);

  function setColors(next: BrandColor[]) {
    onChange({ ...value, brand_colors: next });
  }

  function setFonts(patch: Partial<BrandFonts>) {
    onChange({ ...value, brand_fonts: { ...fonts, ...patch } });
  }

  function updateColor(index: number, patch: Partial<BrandColor>) {
    setColors(colors.map((color, i) => (i === index ? { ...color, ...patch } : color)));
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
        <div className="space-y-1.5">
          <Label htmlFor={`${idPrefix}-font-primary`}>{t("clients.brandKit.fontPrimary")}</Label>
          <Select
            value={fonts.primary?.trim() || FONT_NONE}
            onValueChange={(next) =>
              setFonts({ primary: next === FONT_NONE ? "" : next })
            }
          >
            <SelectTrigger id={`${idPrefix}-font-primary`}>
              <SelectValue placeholder={t("clients.brandKit.fontSelect")} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={FONT_NONE}>{t("clients.brandKit.fontNone")}</SelectItem>
              {primaryOptions.map((font) => (
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
        <div className="space-y-1.5">
          <Label htmlFor={`${idPrefix}-font-secondary`}>
            {t("clients.brandKit.fontSecondary")}
          </Label>
          <Select
            value={fonts.secondary?.trim() || FONT_NONE}
            onValueChange={(next) =>
              setFonts({ secondary: next === FONT_NONE ? "" : next })
            }
          >
            <SelectTrigger id={`${idPrefix}-font-secondary`}>
              <SelectValue placeholder={t("clients.brandKit.fontSelect")} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={FONT_NONE}>{t("clients.brandKit.fontNone")}</SelectItem>
              {secondaryOptions.map((font) => (
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
