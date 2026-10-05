import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import {
  Check,
  ChevronDown,
  Download,
  Expand,
  ImagePlus,
  ListOrdered,
  Loader2,
  Palette,
  Pencil,
  Plus,
  Trash2,
  Upload,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Card, CardContent, CardTitle } from "@/components/ui/card";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DESIGN_ASPECT_RATIOS,
  DESIGN_TEMPLATE_ACCEPT,
  brandKitFromClient,
  contentUsesDedicatedThumbnail,
  defaultAspectForFormat,
  designAspectI18nKey,
  designAspectPreviewClass,
  designAspectThumbClass,
  generateDesign,
  getClient,
  isReelsFormat,
  listDesignTemplates,
  listLibraryAssets,
  parseDesignAspectRatio,
  saveGeneratedArtToLibrary,
  updateDesignTemplateProject,
  uploadContentMedia,
  type ContentFormat,
  type DesignAspectRatio,
  type DesignProvider,
  type DesignTemplate,
  type LibraryAsset,
} from "@/lib/api";
import { MediaLightbox } from "@/components/content-media-preview";
import { ArtTextOverlayView } from "@/components/art-text-editor";
import { ContentMediaLibraryPicker } from "@/components/content-media-library-picker";
import { downloadImageFromUrl } from "@/lib/download-image";
import { cn } from "@/lib/utils";
import {
  createDefaultImageAdjustments,
  createDefaultOverlay,
  createTextLayer,
  ensureArtLayoutLayers,
  flattenOverlayToFile,
  formatInstagramHandle,
  normalizeImageToDesignCanvas,
  overlayFromTemplateLayout,
  parseDesignTemplateLayout,
  resolveBrandTagline,
  serializeDesignTemplateLayout,
  type MediaTextLayer,
  type MediaTextOverlay,
} from "@/lib/media-text-overlay";

const MAX_SLIDES = 8;
const NONE_TEMPLATE = "__none__";
const GENERATED_TEMPLATE_PREFIX = "gen:";
const PHOTO_ACCEPT = "image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp";

type TemplateSource = "library" | "upload";

type LibraryPhoto = { url: string; name: string };

function generatedTemplateId(assetId: string) {
  return `${GENERATED_TEMPLATE_PREFIX}${assetId}`;
}

function parseGeneratedTemplateId(value: string): string | null {
  if (!value.startsWith(GENERATED_TEMPLATE_PREFIX)) return null;
  return value.slice(GENERATED_TEMPLATE_PREFIX.length);
}

type SlideDraft = {
  id: string;
  photoFile: File | null;
  photoLibrary: LibraryPhoto | null;
  overlayText: string;
  secondaryText: string;
  templateId: string;
  templateFile: File | null;
  resultUrl: string | null;
  overlay: MediaTextOverlay | null;
  /** Arte já enviada ao mockup / mídia do conteúdo. */
  approved: boolean;
  /** Arte gerada por IA e salva na biblioteca. */
  savedToLibrary?: boolean;
};

type DesignApplyItem = { url: string; overlay?: MediaTextOverlay };

function templateAspect(template: DesignTemplate): DesignAspectRatio {
  return parseDesignAspectRatio(template.aspect_ratio, defaultAspectForFormat(template.format));
}

function TemplateOptionLabel({
  name,
  imageUrl,
  aspect,
  showAspect = false,
  onExpandImage,
  expandLabel,
}: {
  name: string;
  imageUrl?: string | null;
  aspect: DesignAspectRatio;
  showAspect?: boolean;
  /** When set, clicking the thumbnail expands the image without opening the select. */
  onExpandImage?: () => void;
  expandLabel?: string;
}) {
  const thumbClass = designAspectThumbClass(aspect);
  const thumb = imageUrl ? (
    onExpandImage ? (
      <button
        type="button"
        className={cn(
          "relative shrink-0 cursor-zoom-in overflow-hidden rounded-md border bg-muted",
          thumbClass,
        )}
        aria-label={expandLabel}
        onPointerDown={(e) => {
          e.preventDefault();
          e.stopPropagation();
        }}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          onExpandImage();
        }}
      >
        <img
          src={imageUrl}
          alt=""
          loading="lazy"
          decoding="async"
          className="pointer-events-none h-full w-full object-cover"
        />
      </button>
    ) : (
      <img
        src={imageUrl}
        alt=""
        loading="lazy"
        decoding="async"
        className={cn("pointer-events-none shrink-0 rounded-md border bg-muted object-cover", thumbClass)}
      />
    )
  ) : (
    <span className={cn("shrink-0 rounded-md border bg-muted", thumbClass)} aria-hidden="true" />
  );
  return (
    <span className="flex min-w-0 items-center gap-2.5">
      {thumb}
      <span className="min-w-0 truncate">
        {name}
        {showAspect ? (
          <span className="ml-1.5 text-muted-foreground tabular-nums">{aspect}</span>
        ) : null}
      </span>
    </span>
  );
}

function TemplateSelectItems({
  templates,
  showAspect = false,
}: {
  templates: DesignTemplate[];
  showAspect?: boolean;
}) {
  return (
    <>
      {templates.map((template) => (
        <SelectItem key={template.id} value={template.id} className="h-auto py-1.5">
          <TemplateOptionLabel
            name={template.name}
            imageUrl={template.file_url}
            aspect={templateAspect(template)}
            showAspect={showAspect}
          />
        </SelectItem>
      ))}
    </>
  );
}

function GeneratedArtSelectItems({
  arts,
  preferredAspect,
  groupLabel,
}: {
  arts: LibraryAsset[];
  preferredAspect: DesignAspectRatio;
  groupLabel: string;
}) {
  if (arts.length === 0) return null;
  return (
    <SelectGroup>
      <SelectLabel>{groupLabel}</SelectLabel>
      {arts.map((art) => (
        <SelectItem key={art.id} value={generatedTemplateId(art.id)} className="h-auto py-1.5">
          <TemplateOptionLabel
            name={art.name}
            imageUrl={art.file_url}
            aspect={preferredAspect}
          />
        </SelectItem>
      ))}
    </SelectGroup>
  );
}

function sortTemplatesForAspect(
  templates: DesignTemplate[],
  preferredAspect: DesignAspectRatio,
): DesignTemplate[] {
  return [...templates].sort((a, b) => {
    const aMatch = templateAspect(a) === preferredAspect ? 0 : 1;
    const bMatch = templateAspect(b) === preferredAspect ? 0 : 1;
    if (aMatch !== bMatch) return aMatch - bMatch;
    return a.name.localeCompare(b.name, "pt-BR");
  });
}

function GeneratedArtPreview({
  src,
  overlay,
  alt,
  onExpand,
  className,
  imgClassName,
}: {
  src: string;
  overlay?: MediaTextOverlay | null;
  alt: string;
  onExpand: () => void;
  className?: string;
  imgClassName?: string;
}) {
  const { t } = useTranslation();
  return (
    <button
      type="button"
      onClick={onExpand}
      aria-label={t("project.detail.designAssistant.editText")}
      className={cn(
        "group relative cursor-zoom-in overflow-hidden rounded-md",
        className,
      )}
    >
      {overlay ? (
        <ArtTextOverlayView overlay={overlay} className={cn("h-full w-full", imgClassName)} />
      ) : (
        <img src={src} alt={alt} className={cn("block", imgClassName)} />
      )}
      <span className="pointer-events-none absolute right-2 top-2 rounded-full bg-black/55 p-1.5 text-white opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">
        <Expand className="h-3.5 w-3.5" aria-hidden="true" />
      </span>
    </button>
  );
}

function GenerateArtMenu({
  busy,
  isPending,
  size = "default",
  variant = "default",
  label,
  pendingLabel,
  icon = "palette",
  onGenerate,
}: {
  busy: boolean;
  isPending: boolean;
  size?: "default" | "sm";
  variant?: "default" | "secondary";
  label?: string;
  pendingLabel?: string;
  icon?: "palette" | "pencil";
  onGenerate: (provider: DesignProvider) => void;
}) {
  const { t } = useTranslation();
  const Icon = icon === "pencil" ? Pencil : Palette;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button type="button" size={size} variant={variant} disabled={busy}>
          {isPending ? (
            <>
              <Loader2 className="size-4 animate-spin" />
              {pendingLabel ?? t("project.detail.designAssistant.generating")}
            </>
          ) : (
            <>
              <Icon className="size-4" />
              {label ?? t("project.detail.designAssistant.generate")}
              <ChevronDown className="size-3.5 opacity-70" aria-hidden="true" />
            </>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-64">
        <DropdownMenuLabel>{t("project.detail.designAssistant.provider")}</DropdownMenuLabel>
        <p className="px-2 pb-1.5 text-xs text-muted-foreground">
          {t("project.detail.designAssistant.providerHint")}
        </p>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onSelect={() => onGenerate("openai")}
        >
          {t("project.detail.designAssistant.providerOpenAI")}
        </DropdownMenuItem>
        <DropdownMenuItem
          onSelect={() => onGenerate("gemini")}
        >
          {t("project.detail.designAssistant.providerGemini")}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function createSlide(overlayText = "", secondaryText = ""): SlideDraft {
  return {
    id: crypto.randomUUID(),
    photoFile: null,
    photoLibrary: null,
    overlayText,
    secondaryText,
    templateId: NONE_TEMPLATE,
    templateFile: null,
    resultUrl: null,
    overlay: null,
    approved: false,
  };
}

function isImageLibraryAsset(asset: LibraryAsset) {
  if (!asset.file_url?.trim()) return false;
  if (asset.category === "images" || asset.category === "generated_arts") return true;
  return Boolean(asset.mime_type?.startsWith("image/"));
}

/** Labels on the header line (e.g. "SLIDE 1 — CAPA") that are not slide copy. */
const SLIDE_ROLE_LABELS = new Set([
  "capa",
  "cover",
  "fecho",
  "final",
  "end",
  "cta",
  "abertura",
  "encerramento",
  "intro",
  "hook",
  "punch",
]);

function isSlideRoleLabel(text: string): boolean {
  const normalized = text.trim().toLowerCase().replace(/[.!…]+$/u, "");
  return SLIDE_ROLE_LABELS.has(normalized);
}

/**
 * Splits carousel roteiro into per-slide texts.
 * Supports:
 * - `Slide 1: texto na mesma linha`
 * - Block form: `SLIDE 1 — CAPA` / `SLIDE 2` + multiline body until the next header
 */
function parseRoteiroSlides(roteiro: string): string[] {
  const raw = roteiro.replace(/\r\n/g, "\n").trim();
  if (!raw) return [];

  const lines = raw.split("\n");
  // SLIDE 1 | SLIDE 1 — CAPA | Slide 1: copy…
  const headerRe = /^slide\s*(\d+)\s*(?:[:\-–—]\s*(.*))?$/iu;

  const blocks = new Map<number, string[]>();
  let currentIndex: number | null = null;
  let foundHeaders = false;

  for (const line of lines) {
    const trimmed = line.trim();
    const match = trimmed.match(headerRe);
    if (match) {
      foundHeaders = true;
      const index = Number(match[1]) - 1;
      if (index < 0 || index >= MAX_SLIDES) {
        currentIndex = null;
        continue;
      }
      currentIndex = index;
      if (!blocks.has(index)) blocks.set(index, []);
      const sameLine = (match[2] ?? "").trim();
      if (sameLine && !isSlideRoleLabel(sameLine)) {
        blocks.get(index)!.push(sameLine);
      }
      continue;
    }
    if (currentIndex !== null && trimmed) {
      blocks.get(currentIndex)!.push(trimmed);
    }
  }

  if (foundHeaders) {
    const maxIndex = blocks.size === 0 ? 0 : Math.max(...blocks.keys());
    const length = Math.min(Math.max(maxIndex + 1, 1), MAX_SLIDES);
    return Array.from({ length }, (_, i) => (blocks.get(i) ?? []).join("\n").trim());
  }

  return lines
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, MAX_SLIDES);
}

function mergeSlidesFromRoteiro(prev: SlideDraft[], texts: string[]): SlideDraft[] {
  if (texts.length === 0) {
    if (prev.length === 0) return [createSlide()];
    let changed = false;
    const next = prev.map((slide) => {
      if (!slide.overlayText) return slide;
      changed = true;
      return { ...slide, overlayText: "", approved: false };
    });
    return changed ? next : prev;
  }
  return texts.map((text, index) => {
    const existing = prev[index];
    if (!existing) return createSlide(text);
    if (existing.overlayText === text) return existing;
    return { ...existing, overlayText: text, approved: false };
  });
}

export function ContentDesignAssistant({
  contentId,
  projectId,
  clientId,
  format,
  title,
  caption,
  roteiro,
  onRoteiroChange: _onRoteiroChange,
  onApply,
  onApplyAtIndex,
}: {
  contentId: string;
  projectId: string;
  clientId: string;
  format: ContentFormat;
  title: string;
  caption: string;
  roteiro: string;
  /** @deprecated Kept for API compat — slide edits no longer rewrite the form roteiro. */
  onRoteiroChange?: (roteiro: string) => void;
  onApply: (items: DesignApplyItem[]) => void;
  /** Inclui/substitui um slide na mídia (mockup) pela posição. Retorna false se a ordem impedir. */
  onApplyAtIndex?: (index: number, item: DesignApplyItem) => boolean;
}) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const isCarousel = format === "carousel";
  const applyTarget = contentUsesDedicatedThumbnail(format)
    ? isReelsFormat(format)
      ? "cover"
      : "thumbnail"
    : "media";
  const [aspectRatio, setAspectRatio] = useState<DesignAspectRatio>(() =>
    defaultAspectForFormat(format),
  );

  const templatesQuery = useQuery({
    queryKey: ["design-templates", clientId],
    queryFn: () => listDesignTemplates(clientId),
  });
  const templates = useMemo(
    () => sortTemplatesForAspect(templatesQuery.data ?? [], aspectRatio),
    [templatesQuery.data, aspectRatio],
  );

  const libraryQuery = useQuery({
    queryKey: ["library", clientId],
    queryFn: () => listLibraryAssets(clientId),
  });
  const generatedArts = useMemo(
    () =>
      (libraryQuery.data ?? []).filter(
        (asset) => asset.category === "generated_arts" && Boolean(asset.file_url?.trim()),
      ),
    [libraryQuery.data],
  );
  const hasLibraryTemplates = templates.length > 0 || generatedArts.length > 0;
  const generatedArtsGroupLabel = t("project.detail.designAssistant.generatedArtsGroup");

  const clientQuery = useQuery({
    queryKey: ["clients", clientId],
    queryFn: () => getClient(clientId),
  });
  const kit = brandKitFromClient(clientQuery.data ?? {});
  const brandHandle = formatInstagramHandle(clientQuery.data?.instagram);
  const brandTagline = resolveBrandTagline(kit.brand_fonts.notes);

  const [templateSource, setTemplateSource] = useState<TemplateSource>("library");
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>("");
  const [templateFile, setTemplateFile] = useState<File | null>(null);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoLibrary, setPhotoLibrary] = useState<LibraryPhoto | null>(null);
  const [photoLibraryOpen, setPhotoLibraryOpen] = useState(false);
  const [slidePhotoLibraryOpenId, setSlidePhotoLibraryOpenId] = useState<string | null>(null);
  const [overlayText, setOverlayText] = useState("");
  const [secondaryText, setSecondaryText] = useState("");
  const [guidance, setGuidance] = useState("");
  const [resultUrl, setResultUrl] = useState<string | null>(null);
  const [resultOverlay, setResultOverlay] = useState<MediaTextOverlay | null>(null);
  const [resultSavedToLibrary, setResultSavedToLibrary] = useState(false);
  /** Template da biblioteca cuja edição deve persistir layout em camadas. */
  const [editSourceTemplateId, setEditSourceTemplateId] = useState<string | null>(null);
  const [slides, setSlides] = useState<SlideDraft[]>([createSlide()]);
  const [openSlideId, setOpenSlideId] = useState("");
  const [generatingSlideId, setGeneratingSlideId] = useState<string | null>(null);
  const [lightbox, setLightbox] = useState<
    | { mode: "static"; index: number }
    | { mode: "carousel"; index: number }
    | { mode: "template"; url: string }
    | null
  >(null);
  const [templateSectionOpen, setTemplateSectionOpen] = useState(!isCarousel);
  const templateFileInputRef = useRef<HTMLInputElement>(null);
  const photoFileInputRef = useRef<HTMLInputElement>(null);
  const slidePhotoInputRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const slideTemplateInputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  const defaultOverlay = useMemo(() => {
    const fromTitle = title.trim();
    if (fromTitle) return fromTitle;
    const fromCaption = caption.trim().split(/\n/)[0]?.trim() ?? "";
    return fromCaption.slice(0, 180);
  }, [title, caption]);

  useEffect(() => {
    setAspectRatio(defaultAspectForFormat(format));
  }, [format]);

  useEffect(() => {
    setTemplateSectionOpen(!isCarousel);
  }, [isCarousel]);

  useEffect(() => {
    if (isCarousel) return;
    setOverlayText((prev) => (prev.trim() ? prev : defaultOverlay));
  }, [isCarousel, defaultOverlay]);

  function applySlides(next: SlideDraft[]) {
    setSlides(next);
  }

  function handleApplyRoteiro() {
    const fromRoteiro = parseRoteiroSlides(roteiro);
    const filled = fromRoteiro.filter((text) => text.trim());
    if (filled.length === 0) {
      toast.error(t("project.detail.designAssistant.applyRoteiroEmpty"));
      return;
    }
    const merged = mergeSlidesFromRoteiro(slides, fromRoteiro);
    applySlides(merged);
    if (merged[0]) setOpenSlideId(merged[0].id);
    toast.success(
      t("project.detail.designAssistant.applyRoteiroDone", { count: filled.length }),
    );
  }

  useEffect(() => {
    if (!hasLibraryTemplates) {
      setSelectedTemplateId("");
      setTemplateSource("upload");
      return;
    }
    setSelectedTemplateId((current) => {
      const generatedId = parseGeneratedTemplateId(current);
      if (generatedId && generatedArts.some((art) => art.id === generatedId)) {
        return current;
      }
      if (templates.some((item) => item.id === current)) return current;
      // Carrossel: template global opcional — não pré-seleciona.
      if (isCarousel) return "";
      if (templates[0]) return templates[0].id;
      if (generatedArts[0]?.id) return generatedTemplateId(generatedArts[0].id);
      return "";
    });
    setTemplateSource("library");
  }, [templates, generatedArts, hasLibraryTemplates, isCarousel]);

  async function resolveTemplateUrl(opts: {
    source: TemplateSource;
    templateId: string;
    file: File | null;
  }): Promise<string> {
    if (opts.source === "library") {
      const generatedId = parseGeneratedTemplateId(opts.templateId);
      if (generatedId) {
        const art = generatedArts.find((item) => item.id === generatedId);
        if (!art?.file_url) throw new Error(t("project.detail.designAssistant.needTemplate"));
        return art.file_url;
      }
      const template = templates.find((item) => item.id === opts.templateId);
      if (!template?.file_url) throw new Error(t("project.detail.designAssistant.needTemplate"));
      return template.file_url;
    }
    if (!opts.file) throw new Error(t("project.detail.designAssistant.needTemplate"));
    return uploadContentMedia(projectId, opts.file);
  }

  const artBaseName = useMemo(() => {
    const raw = title.trim() || "arte";
    return raw.replace(/[^\w.\-()+ ]+/g, "_").slice(0, 80);
  }, [title]);

  async function composeGeneratedArt(
    aiUrl: string,
    overlayTextValue: string,
    secondaryTextValue: string,
    label: string,
    photoUrl?: string,
    existingLayers?: MediaTextLayer[],
  ) {
    // Com foto: fundo = foto (sem tipografia do template/IA).
    // Textos do formulário viram só camadas editáveis (título, @, topo, apoio).
    // Com existingLayers: projeto aberto a partir do template (textos já extraídos).
    const baseSource = photoUrl || aiUrl;
    const normalizedBlob = await normalizeImageToDesignCanvas(baseSource, aspectRatio);
    const normalizedFile = new File([normalizedBlob], `${label}-canvas.png`, { type: "image/png" });
    const normalizedUrl = await uploadContentMedia(projectId, normalizedFile);

    const overlay: MediaTextOverlay = existingLayers?.length
      ? {
          baseUrl: normalizedUrl,
          layers: existingLayers,
          adjustments: createDefaultImageAdjustments(),
        }
      : {
          ...createDefaultOverlay({
            baseUrl: normalizedUrl,
            overlayText: overlayTextValue,
            secondaryText: secondaryTextValue,
            headerLeft: brandHandle,
            headerRight: brandTagline,
            primaryFont: kit.brand_fonts.primary,
            secondaryFont: kit.brand_fonts.secondary,
            colors: kit.brand_colors,
          }),
          adjustments: photoUrl
            ? {
                ...createDefaultImageAdjustments(),
                contrast: 14,
                saturation: -6,
                vignette: 0.42,
                brightness: -8,
                warmth: -4,
              }
            : createDefaultImageAdjustments(),
        };

    const file = await flattenOverlayToFile(overlay, `${label}.png`);
    const url = await uploadContentMedia(projectId, file);
    return { url, overlay };
  }

  function layersFromExtracted(raw: unknown): MediaTextLayer[] {
    const layout = parseDesignTemplateLayout({ layers: raw });
    if (layout?.layers.length) {
      return layout.layers.map((layer) =>
        createTextLayer(layer.text, {
          ...layer,
          fontFamily:
            layer.role === "headline"
              ? kit.brand_fonts.primary || layer.fontFamily
              : kit.brand_fonts.secondary || layer.fontFamily,
        }),
      );
    }
    return [];
  }

  function resolveLibraryTemplateProject(templateId: string): {
    templateId: string | null;
    backgroundUrl: string | null;
    layout: ReturnType<typeof parseDesignTemplateLayout>;
  } {
    if (!templateId || templateId === NONE_TEMPLATE || parseGeneratedTemplateId(templateId)) {
      return { templateId: null, backgroundUrl: null, layout: null };
    }
    const template = templates.find((item) => item.id === templateId);
    if (!template) return { templateId: null, backgroundUrl: null, layout: null };
    const layout = parseDesignTemplateLayout(template.layout);
    if (!layout) return { templateId: template.id, backgroundUrl: null, layout: null };
    const backgroundUrl = (template.background_url || template.file_url || "").trim() || null;
    return { templateId: template.id, backgroundUrl, layout };
  }

  /** Abre foto/template como projeto editável (todas as camadas de texto selecionáveis). */
  async function openEditableProject(opts: {
    file: File | null;
    library: LibraryPhoto | null;
    templateSource: TemplateSource;
    templateId: string;
    templateFile: File | null;
    overlayTextValue: string;
    secondaryTextValue: string;
    label: string;
    provider?: DesignProvider;
  }) {
    const hasPhoto = Boolean(opts.file || opts.library);
    if (hasPhoto) {
      const photoUrl = await resolveEditBaseUrl(opts);
      if (!photoUrl) throw new Error(t("project.detail.designAssistant.needPhoto"));
      setEditSourceTemplateId(null);
      return composeGeneratedArt(
        photoUrl,
        opts.overlayTextValue,
        opts.secondaryTextValue,
        opts.label,
        photoUrl,
      );
    }

    const libraryProject =
      opts.templateSource === "library"
        ? resolveLibraryTemplateProject(opts.templateId)
        : { templateId: null, backgroundUrl: null, layout: null };

    if (libraryProject.layout && libraryProject.backgroundUrl) {
      setEditSourceTemplateId(libraryProject.templateId);
      const normalizedBlob = await normalizeImageToDesignCanvas(
        libraryProject.backgroundUrl,
        aspectRatio,
      );
      const normalizedFile = new File([normalizedBlob], `${opts.label}-canvas.png`, {
        type: "image/png",
      });
      const normalizedUrl = await uploadContentMedia(projectId, normalizedFile);
      const overlay = overlayFromTemplateLayout(normalizedUrl, libraryProject.layout, {
        overlayText: opts.overlayTextValue,
        secondaryText: opts.secondaryTextValue,
        headerLeft: brandHandle,
        headerRight: brandTagline,
        primaryFont: kit.brand_fonts.primary,
        secondaryFont: kit.brand_fonts.secondary,
      });
      const file = await flattenOverlayToFile(overlay, `${opts.label}.png`);
      const url = await uploadContentMedia(projectId, file);
      return { url, overlay };
    }

    const templateUrl = await resolveTemplateUrl({
      source: opts.templateSource,
      templateId: opts.templateId,
      file: opts.templateFile,
    });
    const provider = opts.provider === "gemini" ? "gemini" : "openai";
    const opened = await generateDesign({
      contentId,
      projectId,
      clientId,
      format,
      aspectRatio,
      provider,
      mode: "open_editable",
      templateUrl,
      overlayText: opts.overlayTextValue || " ",
      secondaryText: opts.secondaryTextValue,
      guidance,
    });
    const extracted = layersFromExtracted(opened.layers);
    const layers =
      extracted.length > 0
        ? extracted
        : createDefaultOverlay({
            baseUrl: opened.imageUrl,
            overlayText: opts.overlayTextValue,
            secondaryText: opts.secondaryTextValue,
            headerLeft: brandHandle,
            headerRight: brandTagline,
            primaryFont: kit.brand_fonts.primary,
            secondaryFont: kit.brand_fonts.secondary,
            colors: kit.brand_colors,
          }).layers;

    setEditSourceTemplateId(
      opts.templateSource === "library" && !parseGeneratedTemplateId(opts.templateId)
        ? opts.templateId || null
        : null,
    );

    return composeGeneratedArt(
      opened.imageUrl,
      opts.overlayTextValue,
      opts.secondaryTextValue,
      opts.label,
      opened.imageUrl,
      layers,
    );
  }

  async function persistGeneratedArt(imageUrl: string, label: string, notes?: string) {
    try {
      await saveGeneratedArtToLibrary({
        clientId,
        imageUrl,
        name: label,
        notes: notes ?? `Gerada no conteúdo ${contentId}`,
      });
      void queryClient.invalidateQueries({ queryKey: ["library", clientId] });
    } catch (err) {
      console.error(err);
      toast.error(
        err instanceof Error
          ? err.message
          : t("project.detail.designAssistant.librarySaveError"),
      );
    }
  }

  async function resolvePhotoUrl(file: File | null, library: LibraryPhoto | null) {
    if (file) return uploadContentMedia(projectId, file);
    if (library?.url) return library.url;
    return undefined;
  }

  async function resolveEditBaseUrl(opts: {
    file: File | null;
    library: LibraryPhoto | null;
    templateSource: TemplateSource;
    templateId: string;
    templateFile: File | null;
  }) {
    const fromPhoto = await resolvePhotoUrl(opts.file, opts.library);
    if (fromPhoto) return fromPhoto;
    if (opts.templateSource === "upload") {
      if (!opts.templateFile) return undefined;
      return resolveTemplateUrl({
        source: "upload",
        templateId: opts.templateId,
        file: opts.templateFile,
      });
    }
    if (!opts.templateId || opts.templateId === NONE_TEMPLATE) return undefined;
    return resolveTemplateUrl({
      source: "library",
      templateId: opts.templateId,
      file: null,
    });
  }

  const hasStaticPhoto = Boolean(photoFile || photoLibrary);
  const selectedLibraryLayout =
    templateSource === "library" && selectedTemplateId
      ? parseDesignTemplateLayout(
          templates.find((item) => item.id === selectedTemplateId)?.layout,
        )
      : null;
  const canEditStatic =
    hasStaticPhoto ||
    (templateSource === "upload" ? Boolean(templateFile) : Boolean(selectedTemplateId));
  const editNeedsAi = !hasStaticPhoto && !selectedLibraryLayout;

  const generateStaticMutation = useMutation({
    mutationFn: async (selectedProvider: DesignProvider) => {
      const templateUrl = await resolveTemplateUrl({
        source: templateSource,
        templateId: selectedTemplateId,
        file: templateFile,
      });
      if (!overlayText.trim()) throw new Error(t("project.detail.designAssistant.needText"));
      const photoUrl = await resolvePhotoUrl(photoFile, photoLibrary);
      const result = await generateDesign({
        contentId,
        projectId,
        clientId,
        format,
        aspectRatio,
        provider: selectedProvider,
        templateUrl,
        photoUrl,
        overlayText,
        secondaryText,
        guidance,
      });
      return composeGeneratedArt(result.imageUrl, overlayText, secondaryText, artBaseName, photoUrl);
    },
    onSuccess: async (composed) => {
      setResultUrl(composed.url);
      setResultOverlay(composed.overlay);
      await persistGeneratedArt(composed.url, artBaseName);
      setResultSavedToLibrary(true);
      toast.success(t("project.detail.designAssistant.generated"));
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const editStaticMutation = useMutation({
    mutationFn: async (selectedProvider?: DesignProvider) => {
      return openEditableProject({
        file: photoFile,
        library: photoLibrary,
        templateSource,
        templateId: selectedTemplateId,
        templateFile,
        overlayTextValue: overlayText,
        secondaryTextValue: secondaryText,
        label: artBaseName,
        provider: selectedProvider,
      });
    },
    onSuccess: async (composed) => {
      setResultUrl(composed.url);
      setResultOverlay(composed.overlay);
      await persistGeneratedArt(
        composed.url,
        artBaseName,
        `Editada no conteúdo ${contentId}`,
      );
      setResultSavedToLibrary(true);
      setLightbox({ mode: "static", index: 0 });
      toast.success(t("project.detail.designAssistant.edited"));
    },
    onError: (err: Error) => toast.error(err.message),
  });

  async function generateOneSlide(slide: SlideDraft, selectedProvider: DesignProvider) {
    const slideTemplateFile = slide.templateFile;
    const slideTemplateId = slide.templateId !== NONE_TEMPLATE ? slide.templateId : selectedTemplateId;
    const useUpload =
      Boolean(slideTemplateFile) ||
      (slide.templateId === NONE_TEMPLATE && templateSource === "upload");

    const templateUrl = await resolveTemplateUrl({
      source: useUpload ? "upload" : "library",
      templateId: slideTemplateId,
      file: slideTemplateFile ?? (useUpload ? templateFile : null),
    });
    if (!slide.overlayText.trim()) throw new Error(t("project.detail.designAssistant.needText"));

    const photoUrl = await resolvePhotoUrl(slide.photoFile, slide.photoLibrary);
    const result = await generateDesign({
      contentId,
      projectId,
      clientId,
      format: "carousel",
      aspectRatio,
      provider: selectedProvider,
      templateUrl,
      photoUrl: photoUrl,
      overlayText: slide.overlayText,
      secondaryText: slide.secondaryText,
      guidance,
    });
    const composed = await composeGeneratedArt(
      result.imageUrl,
      slide.overlayText,
      slide.secondaryText,
      `${artBaseName}-slide`,
      photoUrl,
    );
    return composed;
  }

  const generateSlideMutation = useMutation({
    mutationFn: async ({
      slideId,
      provider: selectedProvider,
    }: {
      slideId: string;
      provider: DesignProvider;
    }) => {
      const slide = slides.find((item) => item.id === slideId);
      if (!slide) throw new Error("Slide não encontrado");
      setGeneratingSlideId(slideId);
      const composed = await generateOneSlide(slide, selectedProvider);
      return { slideId, ...composed };
    },
    onSuccess: async ({ slideId, url, overlay }) => {
      setSlides((prev) =>
        prev.map((slide) =>
          slide.id === slideId
            ? { ...slide, resultUrl: url, overlay, approved: false, savedToLibrary: true }
            : slide,
        ),
      );
      const index = slides.findIndex((item) => item.id === slideId);
      await persistGeneratedArt(
        url,
        `${artBaseName}-slide-${Math.max(index, 0) + 1}`,
      );
      toast.success(t("project.detail.designAssistant.generated"));
    },
    onError: (err: Error) => toast.error(err.message),
    onSettled: () => setGeneratingSlideId(null),
  });

  const editSlideMutation = useMutation({
    mutationFn: async ({
      slideId,
      provider: selectedProvider,
    }: {
      slideId: string;
      provider?: DesignProvider;
    }) => {
      const slide = slides.find((item) => item.id === slideId);
      if (!slide) throw new Error("Slide não encontrado");
      const slideTemplateFile = slide.templateFile;
      const slideTemplateId =
        slide.templateId !== NONE_TEMPLATE ? slide.templateId : selectedTemplateId;
      const useUpload =
        Boolean(slideTemplateFile) ||
        (slide.templateId === NONE_TEMPLATE && templateSource === "upload");
      setGeneratingSlideId(slideId);
      const composed = await openEditableProject({
        file: slide.photoFile,
        library: slide.photoLibrary,
        templateSource: useUpload ? "upload" : "library",
        templateId: slideTemplateId,
        templateFile: slideTemplateFile ?? (useUpload ? templateFile : null),
        overlayTextValue: slide.overlayText,
        secondaryTextValue: slide.secondaryText,
        label: `${artBaseName}-slide`,
        provider: selectedProvider,
      });
      return { slideId, ...composed };
    },
    onSuccess: async ({ slideId, url, overlay }) => {
      let lightboxIndex = 0;
      setSlides((prev) => {
        const next = prev.map((slide) =>
          slide.id === slideId
            ? {
                ...slide,
                resultUrl: url,
                overlay,
                approved: false,
                savedToLibrary: true,
              }
            : slide,
        );
        const items = next.filter((slide) => slide.resultUrl);
        lightboxIndex = Math.max(
          items.findIndex((slide) => slide.id === slideId),
          0,
        );
        return next;
      });
      const index = slides.findIndex((item) => item.id === slideId);
      await persistGeneratedArt(
        url,
        `${artBaseName}-slide-${Math.max(index, 0) + 1}`,
        `Editada no conteúdo ${contentId}`,
      );
      setLightbox({ mode: "carousel", index: lightboxIndex });
      toast.success(t("project.detail.designAssistant.edited"));
    },
    onError: (err: Error) => toast.error(err.message),
    onSettled: () => setGeneratingSlideId(null),
  });

  const generateAllMutation = useMutation({
    mutationFn: async (selectedProvider: DesignProvider) => {
      const urls: string[] = [];
      for (const [index, slide] of slides.entries()) {
        setGeneratingSlideId(slide.id);
        const composed = await generateOneSlide(slide, selectedProvider);
        urls.push(composed.url);
        setSlides((prev) =>
          prev.map((item) =>
            item.id === slide.id
              ? {
                  ...item,
                  resultUrl: composed.url,
                  overlay: composed.overlay,
                  approved: false,
                  savedToLibrary: true,
                }
              : item,
          ),
        );
        await persistGeneratedArt(composed.url, `${artBaseName}-slide-${index + 1}`);
      }
      return urls;
    },
    onSuccess: () => {
      toast.success(t("project.detail.designAssistant.generatedAll"));
    },
    onError: (err: Error) => toast.error(err.message),
    onSettled: () => setGeneratingSlideId(null),
  });

  const allSlidesHaveTemplate = slides.every((slide) => {
    if (slide.templateFile) return true;
    if (slide.templateId !== NONE_TEMPLATE && slide.templateId) return true;
    if (templateSource === "upload") return Boolean(templateFile);
    return Boolean(selectedTemplateId);
  });

  const busy =
    generateStaticMutation.isPending ||
    editStaticMutation.isPending ||
    generateSlideMutation.isPending ||
    editSlideMutation.isPending ||
    generateAllMutation.isPending;

  const applyLabel =
    applyTarget === "cover"
      ? t("project.detail.designAssistant.applyCover")
      : applyTarget === "thumbnail"
        ? t("project.detail.designAssistant.applyThumbnail")
        : t("project.detail.designAssistant.apply");
  const appliedLabel =
    applyTarget === "cover"
      ? t("project.detail.designAssistant.appliedCover")
      : applyTarget === "thumbnail"
        ? t("project.detail.designAssistant.appliedThumbnail")
        : t("project.detail.designAssistant.applied");

  const handleApplyStatic = () => {
    if (!resultUrl) return;
    onApply([{ url: resultUrl, overlay: resultOverlay ?? undefined }]);
    toast.success(appliedLabel);
  };

  const handleApproveSlide = (slideId: string) => {
    const index = slides.findIndex((item) => item.id === slideId);
    const slide = index >= 0 ? slides[index] : undefined;
    if (!slide?.resultUrl) return;

    const item: DesignApplyItem = {
      url: slide.resultUrl,
      overlay: slide.overlay ?? undefined,
    };

    const applied = onApplyAtIndex
      ? onApplyAtIndex(index, item)
      : (onApply([item]), true);

    if (!applied) return;

    setSlides((prev) =>
      prev.map((entry) => (entry.id === slideId ? { ...entry, approved: true } : entry)),
    );
    toast.success(t("project.detail.designAssistant.appliedSlide"));
  };

  const handleApplyCarousel = () => {
    const items = slides
      .filter((slide): slide is SlideDraft & { resultUrl: string } => Boolean(slide.resultUrl))
      .map((slide) => ({ url: slide.resultUrl, overlay: slide.overlay ?? undefined }));
    if (items.length === 0) return;
    onApply(items);
    setSlides((prev) =>
      prev.map((slide) => (slide.resultUrl ? { ...slide, approved: true } : slide)),
    );
    toast.success(t("project.detail.designAssistant.appliedAll"));
  };

  async function handleDownload(url: string, name: string, format: "png" | "jpg") {
    try {
      await downloadImageFromUrl(url, name, format);
      toast.success(t("project.detail.designAssistant.downloadStarted"));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("project.detail.designAssistant.downloadError"));
    }
  }

  const lightboxItems = useMemo(() => {
    if (!lightbox) return [];
    if (lightbox.mode === "template") {
      return [{ url: lightbox.url }];
    }
    const withLayout = (overlay: MediaTextOverlay, copy?: { overlayText?: string; secondaryText?: string }) =>
      ensureArtLayoutLayers(overlay, {
        overlayText: copy?.overlayText,
        secondaryText: copy?.secondaryText,
        headerLeft: brandHandle,
        headerRight: brandTagline,
        primaryFont: kit.brand_fonts.primary,
        secondaryFont: kit.brand_fonts.secondary,
        colors: kit.brand_colors,
      });
    if (lightbox.mode === "static") {
      if (!resultUrl) return [];
      const overlay = withLayout(
        resultOverlay ??
          createDefaultOverlay({
            baseUrl: resultUrl,
            overlayText,
            secondaryText,
            headerLeft: brandHandle,
            headerRight: brandTagline,
            primaryFont: kit.brand_fonts.primary,
            secondaryFont: kit.brand_fonts.secondary,
            colors: kit.brand_colors,
          }),
        { overlayText, secondaryText },
      );
      return [{ url: overlay.baseUrl, overlay }];
    }
    return slides
      .filter((slide): slide is SlideDraft & { resultUrl: string } => Boolean(slide.resultUrl))
      .map((slide) => {
        const overlay = withLayout(
          slide.overlay ??
            createDefaultOverlay({
              baseUrl: slide.resultUrl,
              overlayText: slide.overlayText,
              secondaryText: slide.secondaryText,
              headerLeft: brandHandle,
              headerRight: brandTagline,
              primaryFont: kit.brand_fonts.primary,
              secondaryFont: kit.brand_fonts.secondary,
              colors: kit.brand_colors,
            }),
          { overlayText: slide.overlayText, secondaryText: slide.secondaryText },
        );
        return { url: overlay.baseUrl, overlay };
      });
  }, [lightbox, resultUrl, resultOverlay, slides, kit, brandHandle, brandTagline, overlayText, secondaryText]);

  const selectedGlobalTemplate = useMemo(() => {
    if (templateSource !== "library" || !selectedTemplateId) return null;
    const generatedId = parseGeneratedTemplateId(selectedTemplateId);
    if (generatedId) {
      const art = generatedArts.find((item) => item.id === generatedId);
      if (!art?.file_url) return null;
      return { name: art.name, imageUrl: art.file_url, aspect: aspectRatio as DesignAspectRatio };
    }
    const selected = templates.find((item) => item.id === selectedTemplateId);
    if (!selected?.file_url) return null;
    return {
      name: selected.name,
      imageUrl: selected.file_url,
      aspect: templateAspect(selected),
    };
  }, [templateSource, selectedTemplateId, generatedArts, templates, aspectRatio]);

  const templateFilePreviewUrl = useMemo(() => {
    if (!templateFile) return null;
    return URL.createObjectURL(templateFile);
  }, [templateFile]);

  useEffect(() => {
    return () => {
      if (templateFilePreviewUrl) URL.revokeObjectURL(templateFilePreviewUrl);
    };
  }, [templateFilePreviewUrl]);

  const globalTemplateSummary = useMemo(() => {
    if (templateSource === "upload" && templateFile) return templateFile.name;
    if (selectedGlobalTemplate) return selectedGlobalTemplate.name;
    return null;
  }, [templateSource, templateFile, selectedGlobalTemplate]);

  async function handleLightboxSave(index: number, overlay: MediaTextOverlay) {
    if (!lightbox || lightbox.mode === "template") return;
    try {
      const file = await flattenOverlayToFile(overlay, `${artBaseName}-edit.png`);
      const url = await uploadContentMedia(projectId, file);

      if (editSourceTemplateId) {
        try {
          await updateDesignTemplateProject(editSourceTemplateId, {
            backgroundUrl: overlay.baseUrl,
            layout: serializeDesignTemplateLayout(overlay),
          });
          void queryClient.invalidateQueries({ queryKey: ["design-templates", clientId] });
        } catch (persistErr) {
          console.error(persistErr);
        }
      }

      if (lightbox?.mode === "static") {
        setResultUrl(url);
        setResultOverlay(overlay);
        toast.success(t("project.detail.artText.saved"));
        return;
      }

      const targets = slides.filter((slide) => slide.resultUrl);
      const target = targets[index];
      if (!target) return;

      const slideIndex = slides.findIndex((slide) => slide.id === target.id);
      const wasApproved = target.approved;

      setSlides((prev) =>
        prev.map((slide) =>
          slide.id === target.id
            ? { ...slide, resultUrl: url, overlay, approved: wasApproved }
            : slide,
        ),
      );

      if (wasApproved && slideIndex >= 0 && onApplyAtIndex) {
        onApplyAtIndex(slideIndex, { url, overlay });
      }

      toast.success(t("project.detail.artText.saved"));
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : t("project.detail.artText.saveError"),
      );
      throw err;
    }
  }

  return (
    <>
    <Collapsible open={open} onOpenChange={setOpen}>
      <Card className="rounded-xl">
        <CollapsibleTrigger asChild>
          <button
            type="button"
            className={`flex w-full flex-row items-center gap-3 px-6 pt-6 text-left transition-colors hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 rounded-t-xl [&[data-state=open]_svg.design-assistant-chevron]:rotate-180 ${
              open ? "pb-3" : "pb-6 rounded-b-xl"
            }`}
          >
            <div className="min-w-0 flex-1">
              <CardTitle className="flex items-center gap-2 text-base">
                <Palette className="size-4 text-primary" />
                {t("project.detail.designAssistant.title")}
              </CardTitle>
              <p className="mt-1 text-sm text-muted-foreground">
                {t("project.detail.designAssistant.hint", { aspect: aspectRatio })}
                {applyTarget !== "media"
                  ? ` ${t("project.detail.designAssistant.hintVideo")}`
                  : ""}
              </p>
            </div>
            <ChevronDown
              className="design-assistant-chevron h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200"
              aria-hidden="true"
            />
          </button>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <CardContent className="space-y-4 pt-0">
        <div className="space-y-1.5">
          <Label variant="highlight">{t("project.detail.designAssistant.aspect")}</Label>
          <p className="text-xs text-muted-foreground">
            {t("project.detail.designAssistant.aspectHint")}
          </p>
          <Select
            value={aspectRatio}
            onValueChange={(value) => setAspectRatio(value as DesignAspectRatio)}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
                  {DESIGN_ASPECT_RATIOS.map((ratio) => (
                    <SelectItem key={ratio} value={ratio}>
                      {t(`project.detail.designAssistant.aspects.${designAspectI18nKey(ratio)}`)}
                    </SelectItem>
                  ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Collapsible
            open={templateSectionOpen}
            onOpenChange={setTemplateSectionOpen}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0 space-y-0.5">
                <Label variant="highlight">
                  {isCarousel
                    ? t("project.detail.designAssistant.defaultTemplate")
                    : t("project.detail.designAssistant.template")}
                </Label>
                {!templateSectionOpen ? (
                  <p className="text-xs text-muted-foreground">
                    {globalTemplateSummary
                      ? t("project.detail.designAssistant.templateCollapsedSelected", {
                          name: globalTemplateSummary,
                        })
                      : t("project.detail.designAssistant.templateCollapsedEmpty")}
                  </p>
                ) : null}
              </div>
              <CollapsibleTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="shrink-0 gap-1 px-2 text-muted-foreground"
                  aria-label={
                    templateSectionOpen
                      ? t("project.detail.designAssistant.templateCollapse")
                      : t("project.detail.designAssistant.templateExpand")
                  }
                >
                  <ChevronDown
                    className={cn(
                      "h-4 w-4 transition-transform duration-200",
                      templateSectionOpen && "rotate-180",
                    )}
                    aria-hidden="true"
                  />
                </Button>
              </CollapsibleTrigger>
            </div>
            <CollapsibleContent className="space-y-1.5 pt-1.5">
          <p className="text-xs text-muted-foreground">
            {isCarousel
              ? t("project.detail.designAssistant.templateHintCarousel", { aspect: aspectRatio })
              : t("project.detail.designAssistant.templateHint", { aspect: aspectRatio })}
          </p>
          <input
            ref={templateFileInputRef}
            type="file"
            accept={DESIGN_TEMPLATE_ACCEPT}
            className="sr-only"
            onChange={(e) => {
              const file = e.target.files?.[0] ?? null;
              setTemplateFile(file);
              if (file) setTemplateSource("upload");
              e.target.value = "";
            }}
          />
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              size="sm"
              variant={templateSource === "library" ? "default" : "outline"}
              onClick={() => setTemplateSource("library")}
              disabled={!hasLibraryTemplates}
            >
              {t("project.detail.designAssistant.templateLibrary")}
            </Button>
            <Button
              type="button"
              size="sm"
              variant={templateSource === "upload" ? "default" : "outline"}
              onClick={() => {
                setTemplateSource("upload");
                templateFileInputRef.current?.click();
              }}
            >
              <Upload className="mr-1.5 size-3.5" aria-hidden="true" />
              {t("project.detail.designAssistant.templateUpload")}
            </Button>
            {isCarousel && (selectedTemplateId || templateFile) ? (
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={() => {
                  setSelectedTemplateId("");
                  setTemplateFile(null);
                  setTemplateSource(hasLibraryTemplates ? "library" : "upload");
                }}
              >
                {t("project.detail.designAssistant.templateClear")}
              </Button>
            ) : null}
          </div>
          {templateSource === "library" ? (
            !hasLibraryTemplates ? (
              <p className="text-xs text-muted-foreground">
                {t("project.detail.designAssistant.templateNone")}
              </p>
            ) : (
              <Select
                value={selectedTemplateId}
                onValueChange={setSelectedTemplateId}
              >
                <SelectTrigger className="h-auto min-h-14 py-1.5 [&>span]:line-clamp-none">
                  {selectedGlobalTemplate ? (
                    <TemplateOptionLabel
                      name={selectedGlobalTemplate.name}
                      imageUrl={selectedGlobalTemplate.imageUrl}
                      aspect={selectedGlobalTemplate.aspect}
                      showAspect
                      expandLabel={t("project.detail.designAssistant.expandTemplate")}
                      onExpandImage={() =>
                        setLightbox({ mode: "template", url: selectedGlobalTemplate.imageUrl })
                      }
                    />
                  ) : (
                    <SelectValue placeholder={t("project.detail.designAssistant.templateSelect")} />
                  )}
                </SelectTrigger>
                <SelectContent className="max-h-80">
                  {templates.length > 0 ? (
                    <SelectGroup>
                      <SelectLabel>
                        {t("project.detail.designAssistant.templatesGroup")}
                      </SelectLabel>
                      <TemplateSelectItems templates={templates} showAspect />
                    </SelectGroup>
                  ) : null}
                  <GeneratedArtSelectItems
                    arts={generatedArts}
                    preferredAspect={aspectRatio}
                    groupLabel={generatedArtsGroupLabel}
                  />
                </SelectContent>
              </Select>
            )
          ) : (
            <div className="space-y-1.5">
              {templateFile && templateFilePreviewUrl ? (
                <TemplateOptionLabel
                  name={templateFile.name}
                  imageUrl={templateFilePreviewUrl}
                  aspect={aspectRatio}
                  expandLabel={t("project.detail.designAssistant.expandTemplate")}
                  onExpandImage={() =>
                    setLightbox({ mode: "template", url: templateFilePreviewUrl })
                  }
                />
              ) : (
                <p className="text-xs text-muted-foreground">
                  {t("project.detail.designAssistant.templateUploadHint")}
                </p>
              )}
            </div>
          )}
          {selectedGlobalTemplate &&
          selectedGlobalTemplate.aspect !== aspectRatio &&
          templateSource === "library" ? (
            <p className="text-xs text-amber-700 dark:text-amber-400">
              {t("project.detail.designAssistant.templateAspectMismatch", {
                templateAspect: selectedGlobalTemplate.aspect,
                aspect: aspectRatio,
              })}
            </p>
          ) : null}
            </CollapsibleContent>
          </Collapsible>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="design-guidance" variant="highlight">
            {t("project.detail.designAssistant.guidance")}
          </Label>
          <Textarea
            id="design-guidance"
            rows={2}
            value={guidance}
            onChange={(e) => setGuidance(e.target.value)}
            placeholder={t("project.detail.designAssistant.guidancePlaceholder")}
          />
        </div>

        {!isCarousel ? (
          <>
            <div className="space-y-1.5">
              <input
                ref={photoFileInputRef}
                type="file"
                accept={PHOTO_ACCEPT}
                className="sr-only"
                onChange={(e) => {
                  setPhotoFile(e.target.files?.[0] ?? null);
                  setPhotoLibrary(null);
                  e.target.value = "";
                }}
              />
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => photoFileInputRef.current?.click()}
                >
                  <ImagePlus className="mr-1.5 size-4" aria-hidden="true" />
                  {t("project.detail.designAssistant.photo")}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setPhotoLibraryOpen(true)}
                >
                  {t("project.detail.designAssistant.photoFromLibrary")}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                {photoFile
                  ? t("project.detail.designAssistant.fileSelected", { name: photoFile.name })
                  : photoLibrary
                    ? t("project.detail.designAssistant.fileSelected", {
                        name: photoLibrary.name,
                      })
                    : t("project.detail.designAssistant.photoHint")}
              </p>
              <ContentMediaLibraryPicker
                clientId={clientId}
                open={photoLibraryOpen}
                onOpenChange={setPhotoLibraryOpen}
                onSelect={(asset) => {
                  if (!isImageLibraryAsset(asset) || !asset.file_url) {
                    toast.error(t("project.detail.designAssistant.needPhoto"));
                    return;
                  }
                  setPhotoFile(null);
                  setPhotoLibrary({ url: asset.file_url, name: asset.name });
                  setPhotoLibraryOpen(false);
                }}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="design-overlay" variant="highlight">
                {t("project.detail.designAssistant.overlayText")}
              </Label>
              <p className="text-xs text-muted-foreground">
                {t("project.detail.designAssistant.overlayHint")}
              </p>
              <Textarea
                id="design-overlay"
                rows={2}
                value={overlayText}
                onChange={(e) => setOverlayText(e.target.value)}
                placeholder={t("project.detail.designAssistant.overlayPlaceholder")}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="design-secondary" variant="highlight">
                {t("project.detail.designAssistant.secondaryText")}
              </Label>
              <p className="text-xs text-muted-foreground">
                {t("project.detail.designAssistant.secondaryHint")}
              </p>
              <Textarea
                id="design-secondary"
                rows={2}
                value={secondaryText}
                onChange={(e) => setSecondaryText(e.target.value)}
                placeholder={t("project.detail.designAssistant.secondaryPlaceholder")}
              />
            </div>
            <div className="flex flex-wrap gap-2">
              {editNeedsAi ? (
                <GenerateArtMenu
                  busy={busy}
                  isPending={editStaticMutation.isPending}
                  variant="secondary"
                  icon="pencil"
                  label={t("project.detail.designAssistant.editImage")}
                  pendingLabel={t("project.detail.designAssistant.editingImage")}
                  onGenerate={(selectedProvider) =>
                    editStaticMutation.mutate(selectedProvider)
                  }
                />
              ) : (
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => editStaticMutation.mutate(undefined)}
                  disabled={busy || !canEditStatic}
                >
                  {editStaticMutation.isPending ? (
                    <>
                      <Loader2 className="size-4 animate-spin" />
                      {t("project.detail.designAssistant.editingImage")}
                    </>
                  ) : (
                    <>
                      <Pencil className="size-4" />
                      {t("project.detail.designAssistant.editImage")}
                    </>
                  )}
                </Button>
              )}
              <GenerateArtMenu
                busy={busy}
                isPending={generateStaticMutation.isPending}
                onGenerate={(selectedProvider) =>
                  generateStaticMutation.mutate(selectedProvider)
                }
              />
            </div>
            {resultUrl ? (
              <div className="space-y-3 rounded-lg border border-border bg-muted/30 p-4">
                <p className="text-sm font-medium">
                  {t("project.detail.designAssistant.previewTitle")}
                </p>
                <GeneratedArtPreview
                  src={resultUrl}
                  overlay={resultOverlay}
                  alt={t("project.detail.designAssistant.previewTitle")}
                  onExpand={() => setLightbox({ mode: "static", index: 0 })}
                  className={cn(
                    "bg-muted/40",
                    designAspectPreviewClass(aspectRatio, "md"),
                  )}
                  imgClassName="h-full w-full object-contain"
                />
                <div className="flex flex-wrap gap-2">
                  <Button type="button" onClick={handleApplyStatic}>
                    {applyLabel}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => void handleDownload(resultUrl, artBaseName, "png")}
                  >
                    <Download className="size-4" />
                    {t("project.detail.designAssistant.downloadPng")}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => void handleDownload(resultUrl, artBaseName, "jpg")}
                  >
                    <Download className="size-4" />
                    {t("project.detail.designAssistant.downloadJpg")}
                  </Button>
                  <Button type="button" variant="outline" onClick={() => { setResultUrl(null); setResultOverlay(null); setResultSavedToLibrary(false); }}>
                    {t("project.detail.designAssistant.discard")}
                  </Button>
                </div>
                {resultSavedToLibrary ? (
                  <p className="text-xs text-muted-foreground">
                    {t("project.detail.designAssistant.savedToLibrary")}
                  </p>
                ) : null}
              </div>
            ) : null}
          </>
        ) : (
          <>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm font-medium">{t("project.detail.designAssistant.slidesHeading")}</p>
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={busy || !roteiro.trim()}
                  onClick={handleApplyRoteiro}
                >
                  <ListOrdered className="mr-1 size-4" />
                  {t("project.detail.designAssistant.applyRoteiro")}
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={slides.length >= MAX_SLIDES || busy}
                  onClick={() => {
                    if (slides.length >= MAX_SLIDES) {
                      toast.error(t("project.detail.designAssistant.maxSlides", { count: MAX_SLIDES }));
                      return;
                    }
                    const slide = createSlide();
                    applySlides([...slides, slide]);
                    setOpenSlideId(slide.id);
                  }}
                >
                  <Plus className="mr-1 size-4" />
                  {t("project.detail.designAssistant.addSlide")}
                </Button>
                <GenerateArtMenu
                  busy={busy || slides.length === 0 || !allSlidesHaveTemplate}
                  isPending={generateAllMutation.isPending}
                  size="sm"
                  label={t("project.detail.designAssistant.generateAll")}
                  onGenerate={(selectedProvider) =>
                    generateAllMutation.mutate(selectedProvider)
                  }
                />
              </div>
            </div>

            <Accordion
              type="single"
              collapsible
              value={openSlideId || undefined}
              onValueChange={(value) => setOpenSlideId(value ?? "")}
              className="space-y-3"
            >
              {slides.map((slide, index) => {
                const slideBusy = generatingSlideId === slide.id;
                const preview = slide.overlayText.replace(/\s+/g, " ").trim();
                const slideHasTemplate =
                  Boolean(slide.templateFile) ||
                  (slide.templateId !== NONE_TEMPLATE && Boolean(slide.templateId)) ||
                  (slide.templateId === NONE_TEMPLATE &&
                    (templateSource === "upload"
                      ? Boolean(templateFile)
                      : Boolean(selectedTemplateId)));
                const slideCanEdit =
                  Boolean(slide.photoFile || slide.photoLibrary) || slideHasTemplate;
                const slideTemplateIdForEdit =
                  slide.templateId !== NONE_TEMPLATE ? slide.templateId : selectedTemplateId;
                const slideEditNeedsAi =
                  !slide.photoFile &&
                  !slide.photoLibrary &&
                  !parseDesignTemplateLayout(
                    templates.find((item) => item.id === slideTemplateIdForEdit)?.layout,
                  );
                return (
                  <AccordionItem
                    key={slide.id}
                    value={slide.id}
                    className="border-b-0 rounded-lg border border-border px-4"
                  >
                    <div className="flex items-start gap-2">
                      <div className="min-w-0 flex-1">
                      <AccordionTrigger
                        className="w-full items-start py-3 hover:no-underline [&[data-state=open]_svg.slide-chevron]:rotate-180 [&>svg:last-child]:hidden"
                      >
                        <span className="flex min-w-0 items-start gap-2 text-left">
                          <ChevronDown
                            className="slide-chevron mt-1 h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200"
                            aria-hidden="true"
                          />
                          <span className="min-w-0">
                            <span className="flex items-center gap-1.5 text-base font-semibold">
                              {t("project.detail.designAssistant.slide", { n: index + 1 })}
                              {slide.approved ? (
                                <Check
                                  className="size-3.5 shrink-0 text-primary"
                                  aria-label={t("project.detail.designAssistant.approved")}
                                />
                              ) : null}
                            </span>
                            {preview ? (
                              <span className="mt-0.5 block truncate text-sm font-normal text-muted-foreground">
                                {preview}
                              </span>
                            ) : null}
                          </span>
                        </span>
                      </AccordionTrigger>
                      </div>
                      <div className="flex shrink-0 items-center gap-1 py-2.5">
                        {slideEditNeedsAi ? (
                          <GenerateArtMenu
                            busy={busy || !slideCanEdit}
                            isPending={slideBusy && editSlideMutation.isPending}
                            size="sm"
                            variant="secondary"
                            icon="pencil"
                            label={t("project.detail.designAssistant.editImage")}
                            pendingLabel={t("project.detail.designAssistant.editingImage")}
                            onGenerate={(selectedProvider) =>
                              editSlideMutation.mutate({
                                slideId: slide.id,
                                provider: selectedProvider,
                              })
                            }
                          />
                        ) : (
                          <Button
                            type="button"
                            size="sm"
                            variant="secondary"
                            disabled={busy || !slideCanEdit}
                            onClick={() =>
                              editSlideMutation.mutate({ slideId: slide.id })
                            }
                          >
                            {slideBusy && editSlideMutation.isPending ? (
                              <Loader2 className="size-4 animate-spin" />
                            ) : (
                              <>
                                <Pencil className="size-3.5" />
                                {t("project.detail.designAssistant.editImage")}
                              </>
                            )}
                          </Button>
                        )}
                        <GenerateArtMenu
                          busy={busy || !slideHasTemplate}
                          isPending={slideBusy && generateSlideMutation.isPending}
                          size="sm"
                          onGenerate={(selectedProvider) =>
                            generateSlideMutation.mutate({
                              slideId: slide.id,
                              provider: selectedProvider,
                            })
                          }
                        />
                        {slides.length > 1 ? (
                          <Button
                            type="button"
                            size="icon"
                            variant="ghost"
                            disabled={busy}
                            aria-label={t("project.detail.designAssistant.removeSlide")}
                            onClick={() => {
                              applySlides(slides.filter((item) => item.id !== slide.id));
                              setOpenSlideId((current) => (current === slide.id ? "" : current));
                            }}
                          >
                            <Trash2 className="size-4" />
                          </Button>
                        ) : null}
                      </div>
                    </div>

                    <AccordionContent className="space-y-3">
                    <div className="space-y-1.5">
                      <input
                        ref={(node) => {
                          slidePhotoInputRefs.current[slide.id] = node;
                        }}
                        type="file"
                        accept={PHOTO_ACCEPT}
                        className="sr-only"
                        onChange={(e) => {
                          const file = e.target.files?.[0] ?? null;
                          setSlides((prev) =>
                            prev.map((item) =>
                              item.id === slide.id
                                ? { ...item, photoFile: file, photoLibrary: null }
                                : item,
                            ),
                          );
                          e.target.value = "";
                        }}
                      />
                      <div className="flex flex-wrap gap-2">
                        <Button
                          type="button"
                          size="sm"
                          variant="secondary"
                          onClick={() => slidePhotoInputRefs.current[slide.id]?.click()}
                        >
                          <ImagePlus className="mr-1.5 size-3.5" aria-hidden="true" />
                          {t("project.detail.designAssistant.slidePhoto")}
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() => setSlidePhotoLibraryOpenId(slide.id)}
                        >
                          {t("project.detail.designAssistant.photoFromLibrary")}
                        </Button>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {slide.photoFile
                          ? t("project.detail.designAssistant.fileSelected", {
                              name: slide.photoFile.name,
                            })
                          : slide.photoLibrary
                            ? t("project.detail.designAssistant.fileSelected", {
                                name: slide.photoLibrary.name,
                              })
                            : t("project.detail.designAssistant.photoHint")}
                      </p>
                    </div>

                    <div className="space-y-1.5">
                      <Label>{t("project.detail.designAssistant.slideText")}</Label>
                      <p className="text-xs text-muted-foreground">
                        {t("project.detail.designAssistant.overlayHint")}
                      </p>
                      <Textarea
                        rows={2}
                        value={slide.overlayText}
                        onChange={(e) => {
                          const value = e.target.value;
                          applySlides(
                            slides.map((item) =>
                              item.id === slide.id ? { ...item, overlayText: value } : item,
                            ),
                          );
                        }}
                        placeholder={t("project.detail.designAssistant.overlayPlaceholder")}
                      />
                    </div>

                    <div className="space-y-1.5">
                      <Label>{t("project.detail.designAssistant.slideSecondaryText")}</Label>
                      <p className="text-xs text-muted-foreground">
                        {t("project.detail.designAssistant.secondaryHint")}
                      </p>
                      <Textarea
                        rows={2}
                        value={slide.secondaryText}
                        onChange={(e) => {
                          const value = e.target.value;
                          setSlides((prev) =>
                            prev.map((item) =>
                              item.id === slide.id ? { ...item, secondaryText: value } : item,
                            ),
                          );
                        }}
                        placeholder={t("project.detail.designAssistant.secondaryPlaceholder")}
                      />
                    </div>

                    <div className="space-y-1.5">
                      <Label>
                        {selectedTemplateId || templateFile
                          ? t("project.detail.designAssistant.slideTemplate")
                          : t("project.detail.designAssistant.slideTemplateRequired")}
                      </Label>
                      <p className="text-xs text-muted-foreground">
                        {selectedTemplateId || templateFile
                          ? t("project.detail.designAssistant.slideTemplateHint")
                          : t("project.detail.designAssistant.slideTemplateHintRequired")}
                      </p>
                      <Select
                        value={slide.templateId}
                        onValueChange={(value) =>
                          setSlides((prev) =>
                            prev.map((item) =>
                              item.id === slide.id
                                ? { ...item, templateId: value, templateFile: null }
                                : item,
                            ),
                          )
                        }
                      >
                        <SelectTrigger className="h-auto min-h-14 py-1.5 [&>span]:line-clamp-none">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="max-h-80">
                          <SelectItem value={NONE_TEMPLATE} className="h-auto py-1.5">
                            <TemplateOptionLabel
                              name={t("project.detail.designAssistant.defaultTemplate")}
                              imageUrl={
                                parseGeneratedTemplateId(selectedTemplateId)
                                  ? generatedArts.find(
                                      (item) =>
                                        item.id === parseGeneratedTemplateId(selectedTemplateId),
                                    )?.file_url
                                  : templates.find((item) => item.id === selectedTemplateId)
                                      ?.file_url
                              }
                              aspect={aspectRatio}
                            />
                          </SelectItem>
                          {templates.length > 0 ? (
                            <SelectGroup>
                              <SelectLabel>
                                {t("project.detail.designAssistant.templatesGroup")}
                              </SelectLabel>
                              <TemplateSelectItems templates={templates} showAspect />
                            </SelectGroup>
                          ) : null}
                          <GeneratedArtSelectItems
                            arts={generatedArts}
                            preferredAspect={aspectRatio}
                            groupLabel={generatedArtsGroupLabel}
                          />
                        </SelectContent>
                      </Select>
                      <input
                        ref={(node) => {
                          slideTemplateInputRefs.current[slide.id] = node;
                        }}
                        type="file"
                        accept={DESIGN_TEMPLATE_ACCEPT}
                        className="sr-only"
                        onChange={(e) => {
                          const file = e.target.files?.[0] ?? null;
                          setSlides((prev) =>
                            prev.map((item) =>
                              item.id === slide.id
                                ? { ...item, templateFile: file, templateId: NONE_TEMPLATE }
                                : item,
                            ),
                          );
                          e.target.value = "";
                        }}
                      />
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => slideTemplateInputRefs.current[slide.id]?.click()}
                      >
                        <Upload className="mr-1.5 size-3.5" aria-hidden="true" />
                        {t("project.detail.designAssistant.templateUpload")}
                      </Button>
                      {slide.templateFile ? (
                        <p className="text-xs text-muted-foreground">
                          {t("project.detail.designAssistant.fileSelected", {
                            name: slide.templateFile.name,
                          })}
                        </p>
                      ) : null}
                    </div>

                    {slide.resultUrl ? (
                      <div className="space-y-2">
                        <GeneratedArtPreview
                          src={slide.resultUrl}
                          overlay={slide.overlay}
                          alt={t("project.detail.designAssistant.slide", { n: index + 1 })}
                          onExpand={() => {
                            const items = slides.filter((item) => item.resultUrl);
                            const start = items.findIndex((item) => item.id === slide.id);
                            setLightbox({
                              mode: "carousel",
                              index: Math.max(start, 0),
                            });
                          }}
                          className={cn(
                            "border bg-muted/40",
                            designAspectPreviewClass(aspectRatio, "sm"),
                          )}
                          imgClassName="h-full w-full object-contain"
                        />
                        <div className="flex flex-wrap gap-2">
                          {slide.approved ? (
                            <Button type="button" size="sm" variant="secondary" disabled>
                              <Check className="size-3.5" />
                              {t("project.detail.designAssistant.approved")}
                            </Button>
                          ) : (
                            <Button
                              type="button"
                              size="sm"
                              onClick={() => handleApproveSlide(slide.id)}
                              disabled={busy}
                            >
                              <Check className="size-3.5" />
                              {t("project.detail.designAssistant.approve")}
                            </Button>
                          )}
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() =>
                              void handleDownload(
                                slide.resultUrl!,
                                `${artBaseName}-slide-${index + 1}`,
                                "png",
                              )
                            }
                          >
                            <Download className="size-3.5" />
                            PNG
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() =>
                              void handleDownload(
                                slide.resultUrl!,
                                `${artBaseName}-slide-${index + 1}`,
                                "jpg",
                              )
                            }
                          >
                            <Download className="size-3.5" />
                            JPG
                          </Button>
                        </div>
                      </div>
                    ) : null}
                    </AccordionContent>
                  </AccordionItem>
                );
              })}
            </Accordion>

            {slides.some((slide) => slide.resultUrl) ? (
              <div className="space-y-2">
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    onClick={handleApplyCarousel}
                    disabled={busy || slides.every((slide) => !slide.resultUrl || slide.approved)}
                  >
                    {t("project.detail.designAssistant.approveAll")}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() =>
                      setSlides((prev) =>
                        prev.map((slide) => ({
                          ...slide,
                          resultUrl: null,
                          overlay: null,
                          approved: false,
                          savedToLibrary: false,
                        })),
                      )
                    }
                  >
                    {t("project.detail.designAssistant.discard")}
                  </Button>
                </div>
                {slides.some((slide) => slide.resultUrl && slide.savedToLibrary) ? (
                  <p className="text-xs text-muted-foreground">
                    {t("project.detail.designAssistant.savedToLibrary")}
                  </p>
                ) : null}
              </div>
            ) : null}
          </>
        )}
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
    <MediaLightbox
      open={Boolean(lightbox)}
      onOpenChange={(open) => {
        if (!open) setLightbox(null);
      }}
      items={lightboxItems.map((item) => ({
        url: item.url,
        overlay: "overlay" in item ? item.overlay : undefined,
      }))}
      title={
        lightbox?.mode === "template"
          ? t("project.detail.designAssistant.template")
          : t("project.detail.designAssistant.previewTitle")
      }
      initialIndex={lightbox && lightbox.mode !== "template" ? lightbox.index : 0}
      textEditor={
        lightbox?.mode === "template"
          ? undefined
          : {
              brandFonts: kit.brand_fonts,
              colors: kit.brand_colors,
              headerLeft: brandHandle,
              headerRight: brandTagline || undefined,
              overlayText:
                lightbox?.mode === "carousel"
                  ? slides.filter((slide) => slide.resultUrl)[lightbox.index ?? 0]?.overlayText
                  : overlayText,
              secondaryText:
                lightbox?.mode === "carousel"
                  ? slides.filter((slide) => slide.resultUrl)[lightbox.index ?? 0]?.secondaryText
                  : secondaryText,
              onSave: handleLightboxSave,
            }
      }
    />
    <ContentMediaLibraryPicker
      clientId={clientId}
      open={Boolean(slidePhotoLibraryOpenId)}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) setSlidePhotoLibraryOpenId(null);
      }}
      onSelect={(asset) => {
        if (!slidePhotoLibraryOpenId) return;
        if (!isImageLibraryAsset(asset) || !asset.file_url) {
          toast.error(t("project.detail.designAssistant.needPhoto"));
          return;
        }
        const slideId = slidePhotoLibraryOpenId;
        setSlides((prev) =>
          prev.map((item) =>
            item.id === slideId
              ? {
                  ...item,
                  photoFile: null,
                  photoLibrary: { url: asset.file_url!, name: asset.name },
                }
              : item,
          ),
        );
        setSlidePhotoLibraryOpenId(null);
      }}
    />
    </>
  );
}
