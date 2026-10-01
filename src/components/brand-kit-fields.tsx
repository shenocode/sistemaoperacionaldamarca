import { useEffect, useRef, useState, type InputHTMLAttributes, type RefObject } from "react";
import { FolderUp, Plus, Trash2, Upload } from "lucide-react";
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
  MAX_BRAND_SECONDARY_FONTS,
  brandFontFamilyFromFileName,
  brandFontsFromSecondaries,
  isBrandFontFileName,
  listBrandSecondaryFonts,
  uploadBrandFont,
  type BrandColor,
  type BrandFontEntry,
  type BrandFonts,
} from "@/lib/api";
import {
  BRAND_GOOGLE_FONT_OPTIONS,
  BRAND_KIT_FONT_OPTIONS,
  brandFontFamilyCss,
  brandFontNeedsFile,
  brandFontsToFileMap,
  isGoogleBrandFont,
  listBrandFontFamilies,
  loadBrandFonts,
} from "@/lib/brand-fonts";

const FONT_NONE = "__none__";
const FONT_OTHER = "__other__";

export type BrandKitValue = {
  brand_colors: BrandColor[];
  brand_fonts: BrandFonts;
  brand_guidance: string;
};

type FontSlotTarget = "primary" | { secondaryIndex: number };

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
  const secondaries = listBrandSecondaryFonts(fonts);
  const [otherPrimary, setOtherPrimary] = useState(() => isOtherName(fonts.primary));
  const [otherSecondaries, setOtherSecondaries] = useState<Record<number, boolean>>(() =>
    Object.fromEntries(secondaries.map((entry, index) => [index, isOtherName(entry.family)])),
  );
  const [uploadingKey, setUploadingKey] = useState<string | null>(null);
  const primaryFileRef = useRef<HTMLInputElement>(null);
  const primaryFolderRef = useRef<HTMLInputElement>(null);
  const secondaryFileRefs = useRef<Record<number, HTMLInputElement | null>>({});
  const secondaryFolderRefs = useRef<Record<number, HTMLInputElement | null>>({});

  useEffect(() => {
    void loadBrandFonts(listBrandFontFamilies(fonts), brandFontsToFileMap(fonts));
  }, [
    fonts.primary,
    fonts.secondary,
    fonts.primaryFileUrl,
    fonts.secondaryFileUrl,
    fonts.extras,
  ]);

  function setColors(next: BrandColor[]) {
    onChange({ ...value, brand_colors: next });
  }

  function setFonts(patch: Partial<BrandFonts>) {
    onChange({ ...value, brand_fonts: { ...fonts, ...patch } });
  }

  function setSecondaries(next: BrandFontEntry[]) {
    onChange({
      ...value,
      brand_fonts: brandFontsFromSecondaries(fonts, next),
    });
  }

  function updateColor(index: number, patch: Partial<BrandColor>) {
    setColors(colors.map((color, i) => (i === index ? { ...color, ...patch } : color)));
  }

  function setOtherSecondary(index: number, next: boolean) {
    setOtherSecondaries((prev) => ({ ...prev, [index]: next }));
  }

  async function handleFontUploads(target: FontSlotTarget, fileList: FileList | File[] | null) {
    // Copy immediately — resetting the <input> empties a live FileList in some browsers.
    const raw = fileList ? Array.from(fileList) : [];
    const files = raw.filter((file) => {
      const name = file.name || (file as File & { webkitRelativePath?: string }).webkitRelativePath || "";
      return isBrandFontFileName(name);
    });
    if (files.length === 0) {
      toast.error(t("clients.brandKit.fontUploadNoFontFiles"));
      return;
    }
    if (!clientId) {
      toast.error(t("clients.brandKit.fontUploadNoClient"));
      return;
    }

    const uploadKey =
      target === "primary" ? "primary" : `secondary-${target.secondaryIndex}`;
    setUploadingKey(uploadKey);

    try {
      const uploaded: BrandFontEntry[] = [];
      for (const file of files) {
        const url = await uploadBrandFont(clientId, file);
        uploaded.push({
          family: brandFontFamilyFromFileName(file.name) || "Custom Font",
          fileUrl: url,
        });
      }

      if (target === "primary") {
        const [first, ...rest] = uploaded;
        const family = fonts.primary?.trim() || first.family;
        let nextSecondaries = [...secondaries];
        for (const entry of rest) {
          if (nextSecondaries.length >= MAX_BRAND_SECONDARY_FONTS) break;
          const emptyIdx = nextSecondaries.findIndex((s) => !s.family.trim() && !s.fileUrl?.trim());
          if (emptyIdx >= 0) {
            nextSecondaries[emptyIdx] = entry;
          } else {
            nextSecondaries.push(entry);
          }
        }
        nextSecondaries = nextSecondaries.slice(0, MAX_BRAND_SECONDARY_FONTS);
        onChange({
          ...value,
          brand_fonts: brandFontsFromSecondaries(
            { ...fonts, primary: family, primaryFileUrl: first.fileUrl },
            nextSecondaries,
          ),
        });
      } else {
        const index = target.secondaryIndex;
        const [first, ...rest] = uploaded;
        const next = [...secondaries];
        while (next.length <= index) next.push({ family: "" });
        const existingFamily = next[index]?.family?.trim();
        next[index] = {
          family: existingFamily || first.family,
          fileUrl: first.fileUrl,
        };
        for (const entry of rest) {
          if (next.length >= MAX_BRAND_SECONDARY_FONTS) break;
          next.push(entry);
        }
        setSecondaries(next.slice(0, MAX_BRAND_SECONDARY_FONTS));
      }

      toast.success(
        files.length === 1
          ? t("clients.brandKit.fontUploadOk")
          : t("clients.brandKit.fontUploadOkMany", { count: files.length }),
      );
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("clients.brandKit.fontUploadError"));
    } finally {
      setUploadingKey(null);
    }
  }

  function renderFontSelect(opts: {
    slotId: string;
    label: string;
    family: string;
    fileUrl?: string;
    otherMode: boolean;
    setOther: (next: boolean) => void;
    onFamilyChange: (family: string, clearFile: boolean) => void;
    onClear: () => void;
    uploadTarget: FontSlotTarget;
    fileInputRef?: (el: HTMLInputElement | null) => void;
    folderInputRef?: (el: HTMLInputElement | null) => void;
    fileRef?: RefObject<HTMLInputElement | null>;
    folderRef?: RefObject<HTMLInputElement | null>;
    onPickFiles?: () => void;
    onPickFolder?: () => void;
    canRemove?: boolean;
    onRemove?: () => void;
  }) {
    const {
      slotId,
      label,
      family,
      fileUrl,
      otherMode,
      setOther,
      onFamilyChange,
      onClear,
      uploadTarget,
      fileInputRef,
      folderInputRef,
      fileRef,
      folderRef,
      onPickFiles,
      onPickFolder,
      canRemove,
      onRemove,
    } = opts;
    const trimmed = family.trim();
    const needsFile = brandFontNeedsFile(trimmed) && !fileUrl?.trim();
    const showUpload = Boolean(trimmed) && brandFontNeedsFile(trimmed);
    const inCurated =
      BRAND_KIT_FONT_OPTIONS.some((f) => f.family.toLowerCase() === trimmed.toLowerCase()) ||
      BRAND_GOOGLE_FONT_OPTIONS.some((f) => f.family.toLowerCase() === trimmed.toLowerCase());
    const selectValue = !trimmed
      ? FONT_NONE
      : otherMode || (!inCurated && brandFontNeedsFile(trimmed))
        ? FONT_OTHER
        : trimmed;
    const uploadKey =
      uploadTarget === "primary" ? "primary" : `secondary-${uploadTarget.secondaryIndex}`;
    const uploading = uploadingKey === uploadKey;

    const kitOptions = BRAND_KIT_FONT_OPTIONS;
    const googleOptions = BRAND_GOOGLE_FONT_OPTIONS;
    const orphan =
      trimmed &&
      !kitOptions.some((f) => f.family.toLowerCase() === trimmed.toLowerCase()) &&
      !googleOptions.some((f) => f.family.toLowerCase() === trimmed.toLowerCase()) &&
      !otherMode
        ? trimmed
        : null;

    return (
      <div className="space-y-1.5">
        <div className="flex items-center justify-between gap-2">
          <Label htmlFor={slotId}>{label}</Label>
          {canRemove ? (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-8 w-8 shrink-0"
              onClick={onRemove}
              aria-label={t("clients.brandKit.removeSecondaryFont")}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          ) : null}
        </div>
        <Select
          value={selectValue}
          onValueChange={(next) => {
            if (next === FONT_NONE) {
              setOther(false);
              onClear();
              return;
            }
            if (next === FONT_OTHER) {
              setOther(true);
              if (isGoogleBrandFont(family) || !family.trim()) {
                onFamilyChange("", true);
              }
              return;
            }
            setOther(false);
            const sameFamily = trimmed.toLowerCase() === next.toLowerCase();
            onFamilyChange(next, !sameFamily);
          }}
        >
          <SelectTrigger id={slotId}>
            <SelectValue placeholder={t("clients.brandKit.fontSelect")} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={FONT_NONE}>{t("clients.brandKit.fontNone")}</SelectItem>
            <SelectItem value={FONT_OTHER}>{t("clients.brandKit.fontOther")}</SelectItem>
            {orphan ? (
              <SelectItem value={orphan} style={{ fontFamily: brandFontFamilyCss(orphan) }}>
                {orphan}
              </SelectItem>
            ) : null}
            <div className="px-2 py-1.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
              {t("clients.brandKit.fontGroupKit")}
            </div>
            {kitOptions.map((font) => (
              <SelectItem key={`kit-${slotId}-${font.id}`} value={font.family}>
                {font.family}
              </SelectItem>
            ))}
            <div className="px-2 py-1.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
              {t("clients.brandKit.fontGroupGoogle")}
            </div>
            {googleOptions.map((font) => (
              <SelectItem
                key={`google-${slotId}-${font.id}`}
                value={font.family}
                style={{ fontFamily: brandFontFamilyCss(font.family) }}
              >
                {font.family}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {otherMode ? (
          <div className="space-y-1.5">
            <Label htmlFor={`${slotId}-name`}>{t("clients.brandKit.fontCustomName")}</Label>
            <Input
              id={`${slotId}-name`}
              value={family}
              onChange={(e) => {
                const next = e.target.value;
                const same = trimmed.toLowerCase() === next.trim().toLowerCase();
                onFamilyChange(next, !same);
              }}
              placeholder={t("clients.brandKit.fontCustomNamePlaceholder")}
            />
          </div>
        ) : null}

        {showUpload ? (
          <div className="space-y-2 rounded-md border border-dashed p-3">
            <p className="text-xs text-muted-foreground">{t("clients.brandKit.fontFileHint")}</p>
            <input
              ref={fileInputRef ?? fileRef}
              type="file"
              accept={BRAND_FONT_ACCEPT}
              multiple
              className="hidden"
              onChange={(e) => {
                const list = e.target.files ? Array.from(e.target.files) : [];
                e.target.value = "";
                void handleFontUploads(uploadTarget, list);
              }}
            />
            <input
              ref={folderInputRef ?? folderRef}
              type="file"
              multiple
              className="hidden"
              // Chromium/Safari: pick a folder and expose files inside.
              {...({ webkitdirectory: "", directory: "" } as InputHTMLAttributes<HTMLInputElement>)}
              onChange={(e) => {
                const list = e.target.files ? Array.from(e.target.files) : [];
                e.target.value = "";
                void handleFontUploads(uploadTarget, list);
              }}
            />
            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={!clientId || uploading}
                onClick={() => (onPickFiles ? onPickFiles() : fileRef?.current?.click())}
              >
                <Upload className="mr-1.5 h-4 w-4" aria-hidden="true" />
                {uploading
                  ? t("clients.brandKit.fontUploading")
                  : fileUrl?.trim()
                    ? t("clients.brandKit.fontReplaceFile")
                    : t("clients.brandKit.fontUploadFile")}
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={!clientId || uploading}
                onClick={() => (onPickFolder ? onPickFolder() : folderRef?.current?.click())}
              >
                <FolderUp className="mr-1.5 h-4 w-4" aria-hidden="true" />
                {t("clients.brandKit.fontUploadFolder")}
              </Button>
              {fileUrl?.trim() ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => onFamilyChange(family, true)}
                >
                  {t("clients.brandKit.fontClearFile")}
                </Button>
              ) : null}
            </div>
            <p className="text-[11px] text-muted-foreground">
              {t("clients.brandKit.fontBatchHint")}
            </p>
            {fileUrl?.trim() ? (
              <p className="text-xs text-muted-foreground">{t("clients.brandKit.fontFileReady")}</p>
            ) : needsFile ? (
              <p className="text-xs text-amber-600 dark:text-amber-400">
                {t("clients.brandKit.fontFileRequired")}
              </p>
            ) : null}
          </div>
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
            onClick={() => setColors([...colors, { name: "", hex: "#000000" }])}
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

      <div className="space-y-4">
        {renderFontSelect({
          slotId: `${idPrefix}-font-primary`,
          label: t("clients.brandKit.fontPrimary"),
          family: fonts.primary ?? "",
          fileUrl: fonts.primaryFileUrl,
          otherMode: otherPrimary,
          setOther: setOtherPrimary,
          onClear: () => setFonts({ primary: "", primaryFileUrl: "" }),
          onFamilyChange: (next, clearFile) => {
            const same = (fonts.primary ?? "").trim().toLowerCase() === next.trim().toLowerCase();
            setFonts({
              primary: next,
              primaryFileUrl: clearFile || !same ? "" : fonts.primaryFileUrl,
            });
          },
          uploadTarget: "primary",
          fileRef: primaryFileRef,
          folderRef: primaryFolderRef,
        })}

        <div className="space-y-3">
          <div className="flex items-center justify-between gap-2">
            <Label>{t("clients.brandKit.fontSecondaries")}</Label>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={secondaries.length >= MAX_BRAND_SECONDARY_FONTS}
              onClick={() => {
                if (secondaries.length >= MAX_BRAND_SECONDARY_FONTS) return;
                setSecondaries([...secondaries, { family: "" }]);
              }}
            >
              <Plus className="mr-1.5 h-4 w-4" aria-hidden="true" />
              {t("clients.brandKit.addSecondaryFont")}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">{t("clients.brandKit.fontSecondariesHint")}</p>
          <div className="grid gap-4 sm:grid-cols-2">
            {secondaries.map((entry, index) =>
              renderFontSelect({
                slotId: `${idPrefix}-font-secondary-${index}`,
                label:
                  secondaries.length === 1
                    ? t("clients.brandKit.fontSecondary")
                    : t("clients.brandKit.fontSecondaryN", { n: index + 1 }),
                family: entry.family ?? "",
                fileUrl: entry.fileUrl,
                otherMode: Boolean(otherSecondaries[index]) || isOtherName(entry.family),
                setOther: (next) => setOtherSecondary(index, next),
                onClear: () => {
                  const next = [...secondaries];
                  next[index] = { family: "", fileUrl: undefined };
                  setSecondaries(next);
                },
                onFamilyChange: (nextFamily, clearFile) => {
                  const next = [...secondaries];
                  const prev = next[index] ?? { family: "" };
                  const same =
                    (prev.family ?? "").trim().toLowerCase() === nextFamily.trim().toLowerCase();
                  next[index] = {
                    family: nextFamily,
                    fileUrl: clearFile || !same ? undefined : prev.fileUrl,
                  };
                  setSecondaries(next);
                },
                uploadTarget: { secondaryIndex: index },
                fileInputRef: (el) => {
                  secondaryFileRefs.current[index] = el;
                },
                folderInputRef: (el) => {
                  secondaryFolderRefs.current[index] = el;
                },
                onPickFiles: () => secondaryFileRefs.current[index]?.click(),
                onPickFolder: () => secondaryFolderRefs.current[index]?.click(),
                canRemove: secondaries.length > 1,
                onRemove: () => {
                  setSecondaries(secondaries.filter((_, i) => i !== index));
                  setOtherSecondaries((prev) => {
                    const next: Record<number, boolean> = {};
                    Object.entries(prev).forEach(([key, val]) => {
                      const i = Number(key);
                      if (i < index) next[i] = val;
                      if (i > index) next[i - 1] = val;
                    });
                    return next;
                  });
                },
              }),
            )}
          </div>
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

function isOtherName(value: string | undefined | null) {
  const trimmed = (value ?? "").trim();
  if (!trimmed) return false;
  if (isGoogleBrandFont(trimmed)) return false;
  return !BRAND_KIT_FONT_OPTIONS.some((f) => f.family.toLowerCase() === trimmed.toLowerCase());
}

function normalizeHex(value: string | undefined): string {
  const raw = (value ?? "").trim();
  if (/^#[0-9A-Fa-f]{6}$/.test(raw)) return raw;
  if (/^[0-9A-Fa-f]{6}$/.test(raw)) return `#${raw}`;
  return "#000000";
}
