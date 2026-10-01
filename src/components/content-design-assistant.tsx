import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import {
  Check,
  ChevronDown,
  Download,
  Expand,
  ImagePlus,
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
  ensureArtLayoutLayers,
  flattenOverlayToFile,
  formatInstagramHandle,
  normalizeImageToDesignCanvas,
  resolveBrandTagline,
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
}: {
  name: string;
  imageUrl?: string | null;
  aspect: DesignAspectRatio;
  showAspect?: boolean;
}) {
  const thumbClass = designAspectThumbClass(aspect);
  return (
    <span className="flex min-w-0 items-center gap-2.5">
      {imageUrl ? (
        <img
          src={imageUrl}
          alt=""
          loading="lazy"
          decoding="async"
          className={cn("pointer-events-none shrink-0 rounded-md border bg-muted object-cover", thumbClass)}
        />
      ) : (
        <span className={cn("shrink-0 rounded-md border bg-muted", thumbClass)} aria-hidden="true" />
      )}
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
  label,
  onGenerate,
}: {
  busy: boolean;
  isPending: boolean;
  size?: "default" | "sm";
  label?: string;
  onGenerate: (provider: DesignProvider) => void;
}) {
  const { t } = useTranslation();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button type="button" size={size} disabled={busy}>
          {isPending ? (
            <>
              <Loader2 className="size-4 animate-spin" />
              {t("project.detail.designAssistant.generating")}
            </>
          ) : (
            <>
              <Palette className="size-4" />
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

function parseRoteiroSlides(roteiro: string): string[] {
  const lines = roteiro
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  if (lines.length === 0) return [];

  const numbered: string[] = [];
  let usedNumbered = false;
  for (const line of lines) {
    const match = line.match(/^slide\s*(\d+)\s*[:\-–]\s*(.*)$/i);
    if (match) {
      usedNumbered = true;
      const index = Number(match[1]) - 1;
      if (index >= 0 && index < MAX_SLIDES) {
        numbered[index] = match[2].trim();
      }
    }
  }
  if (usedNumbered) {
    const length = Math.min(Math.max(numbered.length, 1), MAX_SLIDES);
    return Array.from({ length }, (_, i) => numbered[i] ?? "");
  }
  return lines.slice(0, MAX_SLIDES);
}

function formatRoteiroFromSlides(slides: SlideDraft[]): string {
  return slides
    .map((slide, index) => {
      const text = slide.overlayText.replace(/\s+/g, " ").trim();
      return text ? `Slide ${index + 1}: ${text}` : `Slide ${index + 1}:`;
    })
    .join("\n");
}

function mergeSlidesFromRoteiro(prev: SlideDraft[], texts: string[]): SlideDraft[] {
  if (texts.length === 0) {
    if (prev.length === 0) return [createSlide()];
    let changed = false;
    const next = prev.map((slide) => {
      if (!slide.overlayText) return slide;
      changed = true;
      return { ...slide, overlayText: "" };
    });
    return changed ? next : prev;
  }
  return texts.map((text, index) => {
    const existing = prev[index];
    if (!existing) return createSlide(text);
    if (existing.overlayText === text) return existing;
    return { ...existing, overlayText: text };
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
  const [slides, setSlides] = useState<SlideDraft[]>([createSlide()]);
  const [openSlideId, setOpenSlideId] = useState("");
  const lastEmittedRoteiroRef = useRef<string | null>(null);
  const [generatingSlideId, setGeneratingSlideId] = useState<string | null>(null);
  const [lightbox, setLightbox] = useState<{ mode: "static" | "carousel"; index: number } | null>(
    null,
  );
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
    if (isCarousel) return;
    setOverlayText((prev) => (prev.trim() ? prev : defaultOverlay));
  }, [isCarousel, defaultOverlay]);

  useEffect(() => {
    if (!isCarousel) return;
    if (lastEmittedRoteiroRef.current !== null && lastEmittedRoteiroRef.current === roteiro) {
      return;
    }
    lastEmittedRoteiroRef.current = roteiro;
    const fromRoteiro = parseRoteiroSlides(roteiro);
    setSlides((prev) => {
      if (fromRoteiro.length === 0) {
        if (prev.length === 0) return [createSlide(defaultOverlay)];
        return mergeSlidesFromRoteiro(prev, []);
      }
      const merged = mergeSlidesFromRoteiro(prev, fromRoteiro);
      const unchanged =
        merged.length === prev.length &&
        merged.every((slide, index) => slide.id === prev[index].id && slide.overlayText === prev[index].overlayText);
      return unchanged ? prev : merged;
    });
  }, [isCarousel, roteiro, defaultOverlay]);

  function applySlides(next: SlideDraft[]) {
    setSlides(next);
    // Do not push reformatted text back into the content form.
    // Round-tripping through Slide N: lines was overwriting the user's saved roteiro
    // (collapsing multi-line slides / resurrecting stale slide drafts after save).
    lastEmittedRoteiroRef.current = formatRoteiroFromSlides(next);
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
      if (templates[0]) return templates[0].id;
      if (generatedArts[0]?.id) return generatedTemplateId(generatedArts[0].id);
      return "";
    });
    setTemplateSource("library");
  }, [templates, generatedArts, hasLibraryTemplates]);

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
  ) {
    // Com foto: fundo = foto (sem tipografia do template/IA).
    // Textos do formulário viram só camadas editáveis (título, @, topo, apoio).
    const baseSource = photoUrl || aiUrl;
    const normalizedBlob = await normalizeImageToDesignCanvas(baseSource, aspectRatio);
    const normalizedFile = new File([normalizedBlob], `${label}-canvas.png`, { type: "image/png" });
    const normalizedUrl = await uploadContentMedia(projectId, normalizedFile);

    const overlay: MediaTextOverlay = {
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
  const canEditStatic =
    hasStaticPhoto ||
    (templateSource === "upload" ? Boolean(templateFile) : Boolean(selectedTemplateId));

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
    mutationFn: async () => {
      const photoUrl = await resolveEditBaseUrl({
        file: photoFile,
        library: photoLibrary,
        templateSource,
        templateId: selectedTemplateId,
        templateFile,
      });
      if (!photoUrl) throw new Error(t("project.detail.designAssistant.needPhoto"));
      return composeGeneratedArt(photoUrl, overlayText, secondaryText, artBaseName, photoUrl);
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
    mutationFn: async (slideId: string) => {
      const slide = slides.find((item) => item.id === slideId);
      if (!slide) throw new Error("Slide não encontrado");
      const slideTemplateFile = slide.templateFile;
      const slideTemplateId =
        slide.templateId !== NONE_TEMPLATE ? slide.templateId : selectedTemplateId;
      const useUpload =
        Boolean(slideTemplateFile) ||
        (slide.templateId === NONE_TEMPLATE && templateSource === "upload");
      const photoUrl = await resolveEditBaseUrl({
        file: slide.photoFile,
        library: slide.photoLibrary,
        templateSource: useUpload ? "upload" : "library",
        templateId: slideTemplateId,
        templateFile: slideTemplateFile ?? (useUpload ? templateFile : null),
      });
      if (!photoUrl) throw new Error(t("project.detail.designAssistant.needPhoto"));
      setGeneratingSlideId(slideId);
      const composed = await composeGeneratedArt(
        photoUrl,
        slide.overlayText,
        slide.secondaryText,
        `${artBaseName}-slide`,
        photoUrl,
      );
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
        return { url: overlay.baseUrl, overlay, slideId: slide.id };
      });
  }, [lightbox, resultUrl, resultOverlay, slides, kit, brandHandle, brandTagline, overlayText, secondaryText]);

  async function handleLightboxSave(index: number, overlay: MediaTextOverlay) {
    try {
      const file = await flattenOverlayToFile(overlay, `${artBaseName}-edit.png`);
      const url = await uploadContentMedia(projectId, file);

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
          <Label variant="highlight">{t("project.detail.designAssistant.template")}</Label>
          <p className="text-xs text-muted-foreground">
            {t("project.detail.designAssistant.templateHint", { aspect: aspectRatio })}
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
          </div>
          {templateSource === "library" ? (
            !hasLibraryTemplates ? (
              <p className="text-xs text-muted-foreground">
                {t("project.detail.designAssistant.templateNone")}
              </p>
            ) : (
              <Select value={selectedTemplateId} onValueChange={setSelectedTemplateId}>
                <SelectTrigger className="h-auto min-h-14 py-1.5 [&>span]:line-clamp-none">
                  <SelectValue placeholder={t("project.detail.designAssistant.templateSelect")} />
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
            <p className="text-xs text-muted-foreground">
              {templateFile
                ? t("project.detail.designAssistant.fileSelected", { name: templateFile.name })
                : t("project.detail.designAssistant.templateUploadHint")}
            </p>
          )}
          {selectedTemplateId && templateSource === "library"
            ? (() => {
                const generatedId = parseGeneratedTemplateId(selectedTemplateId);
                if (generatedId) {
                  const selected = generatedArts.find((item) => item.id === generatedId);
                  if (!selected?.file_url) return null;
                  return (
                    <img
                      src={selected.file_url}
                      alt=""
                      className={cn(
                        "mt-2 rounded-md border object-cover",
                        designAspectPreviewClass(aspectRatio, "sm"),
                      )}
                    />
                  );
                }
                const selected = templates.find((item) => item.id === selectedTemplateId);
                if (!selected?.file_url) return null;
                const nativeAspect = templateAspect(selected);
                return (
                  <>
                    {nativeAspect !== aspectRatio ? (
                      <p className="text-xs text-amber-700 dark:text-amber-400">
                        {t("project.detail.designAssistant.templateAspectMismatch", {
                          templateAspect: nativeAspect,
                          aspect: aspectRatio,
                        })}
                      </p>
                    ) : null}
                    <img
                      src={selected.file_url}
                      alt=""
                      className={cn(
                        "mt-2 rounded-md border object-cover",
                        designAspectPreviewClass(nativeAspect, "sm"),
                      )}
                    />
                  </>
                );
              })()
            : null}
          {templateFile && templateSource === "upload" ? (
            <p className="text-xs font-medium text-foreground">{templateFile.name}</p>
          ) : null}
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
              <Button
                type="button"
                variant="secondary"
                onClick={() => editStaticMutation.mutate()}
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
              <p className="text-sm font-medium">{t("project.detail.designAssistant.defaultTemplate")}</p>
              <div className="flex flex-wrap gap-2">
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
                  busy={busy || slides.length === 0}
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
                const slideCanEdit =
                  Boolean(slide.photoFile || slide.photoLibrary) ||
                  Boolean(slide.templateFile) ||
                  (slide.templateId !== NONE_TEMPLATE && Boolean(slide.templateId)) ||
                  (slide.templateId === NONE_TEMPLATE &&
                    (templateSource === "upload"
                      ? Boolean(templateFile)
                      : Boolean(selectedTemplateId)));
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
                        <Button
                          type="button"
                          size="sm"
                          variant="secondary"
                          disabled={busy || !slideCanEdit}
                          onClick={() => editSlideMutation.mutate(slide.id)}
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
                        <GenerateArtMenu
                          busy={busy}
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
                      <Label>{t("project.detail.designAssistant.slideTemplate")}</Label>
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
      items={lightboxItems.map(({ url, overlay }) => ({ url, overlay }))}
      title={t("project.detail.designAssistant.previewTitle")}
      initialIndex={lightbox?.index ?? 0}
      textEditor={{
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
      }}
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
