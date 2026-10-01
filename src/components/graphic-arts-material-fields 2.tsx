import { useTranslation } from "react-i18next";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  GRAPHIC_ARTS_MATERIAL_PRESETS,
  GRAPHIC_ARTS_MATERIAL_TYPES,
  getGraphicArtsMaterialPreset,
  type GraphicArtsMaterialType,
} from "@/lib/api";

type GraphicArtsMaterialFieldsProps = {
  materialType: string;
  widthCm: string;
  heightCm: string;
  disabled?: boolean;
  idPrefix?: string;
  onMaterialTypeChange: (value: GraphicArtsMaterialType) => void;
  onWidthCmChange: (value: string) => void;
  onHeightCmChange: (value: string) => void;
  /** When true, selecting a preset overwrites width/height with defaults. */
  applyPresetDimensions?: boolean;
};

export function GraphicArtsMaterialFields({
  materialType,
  widthCm,
  heightCm,
  disabled = false,
  idPrefix = "graphic-arts",
  onMaterialTypeChange,
  onWidthCmChange,
  onHeightCmChange,
  applyPresetDimensions = true,
}: GraphicArtsMaterialFieldsProps) {
  const { t } = useTranslation();
  const resolvedType = GRAPHIC_ARTS_MATERIAL_TYPES.includes(
    materialType as GraphicArtsMaterialType,
  )
    ? (materialType as GraphicArtsMaterialType)
    : "other";

  return (
    <div className="space-y-3">
      <div className="space-y-1.5">
        <Label htmlFor={`${idPrefix}-material`}>
          {t("project.graphicArts.materialType")}
        </Label>
        <Select
          value={resolvedType}
          disabled={disabled}
          onValueChange={(value) => {
            const next = value as GraphicArtsMaterialType;
            onMaterialTypeChange(next);
            if (applyPresetDimensions) {
              const preset = getGraphicArtsMaterialPreset(next);
              onWidthCmChange(String(preset.widthCm));
              onHeightCmChange(String(preset.heightCm));
            }
          }}
        >
          <SelectTrigger id={`${idPrefix}-material`} className="h-9">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {GRAPHIC_ARTS_MATERIAL_PRESETS.map((preset) => (
              <SelectItem key={preset.id} value={preset.id}>
                {t(`project.graphicArts.materials.${preset.id}`)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="min-w-0 space-y-1.5">
          <Label htmlFor={`${idPrefix}-width`}>{t("project.graphicArts.widthCm")}</Label>
          <Input
            id={`${idPrefix}-width`}
            type="number"
            inputMode="decimal"
            min={0.1}
            step="0.1"
            value={widthCm}
            disabled={disabled}
            required
            onChange={(e) => onWidthCmChange(e.target.value)}
          />
        </div>
        <div className="min-w-0 space-y-1.5">
          <Label htmlFor={`${idPrefix}-height`}>{t("project.graphicArts.heightCm")}</Label>
          <Input
            id={`${idPrefix}-height`}
            type="number"
            inputMode="decimal"
            min={0.1}
            step="0.1"
            value={heightCm}
            disabled={disabled}
            required
            onChange={(e) => onHeightCmChange(e.target.value)}
          />
        </div>
      </div>
    </div>
  );
}

export function parseCmInput(value: string): number | null {
  const normalized = value.trim().replace(",", ".");
  if (!normalized) return null;
  const n = Number(normalized);
  if (!Number.isFinite(n) || n <= 0) return null;
  return n;
}
