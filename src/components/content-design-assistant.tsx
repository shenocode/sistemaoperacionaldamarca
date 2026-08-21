import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { ChevronDown, Download, Expand, ImagePlus, Loader2, Palette, Plus, Trash2, Upload } from "lucide-react";
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
  DESIGN_TEMPLATE_ACCEPT,
  brandKitFromClient,
  generateDesign,
  getClient,
  listDesignTemplates,
  saveGeneratedArtToLibrary,
  uploadContentMedia,
  type DesignProvider,
  type DesignTemplate,
  type DesignTemplateFormat,
} from "@/lib/api";
import { MediaLightbox } from "@/components/content-media-preview";
import { downloadImageFromUrl } from "@/lib/download-image";
import { cn } from "@/lib/utils";
import {
  createDefaultOverlay,
  flattenOverlayToFile,
  type MediaTextOverlay,
} from "@/lib/media-text-overlay";

const MAX_SLIDES = 8;
const NONE_TEMPLATE = "__none__";
const PHOTO_ACCEPT = "image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp";

type TemplateSource = "library" | "upload";

type SlideDraft = {
  id: string;
  photoFile: File | null;
  overlayText: string;
  secondaryText: string;
  templateId: string;
  templateFile: File | null;
  resultUrl: string | null;
  overlay: MediaTextOverlay | null;
};

function TemplateOptionLabel({
  name,
  imageUrl,
}: {
  name: string;
  imageUrl?: string | null;
}) {
  return (
    <span className="flex min-w-0 items-center gap-2.5">
      {imageUrl ? (
        <img
          src={imageUrl}
          alt=""
          loading="lazy"
          decoding="async"
          className="pointer-events-none h-12 w-9 shrink-0 rounded-md border bg-muted object-cover"
        />
      ) : (
        <span className="h-12 w-9 shrink-0 rounded-md border bg-muted" aria-hidden="true" />
      )}
      <span className="truncate">{name}</span>
    </span>
  );
}

function TemplateSelectItems({ templates }: { templates: DesignTemplate[] }) {
  return (
    <>
      {templates.map((template) => (
        <SelectItem key={template.id} value={template.id} className="h-auto py-1.5">
          <TemplateOptionLabel name={template.name} imageUrl={template.file_url} />
        </SelectItem>
      ))}
    </>
  );
}

function GeneratedArtPreview({
  src,
  alt,
  onExpand,
  className,
  imgClassName,
}: {
  src: string;
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
      aria-label={t("project.detail.expandMedia")}
      className={cn(
        "group relative cursor-zoom-in overflow-hidden rounded-md",
        className,
      )}
    >
      <img src={src} alt={alt} className={cn("block", imgClassName)} />
      <span className="pointer-events-none absolute right-2 top-2 rounded-full bg-black/55 p-1.5 text-white opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">
        <Expand className="h-3.5 w-3.5" aria-hidden="true" />
      </span>
    </button>
  );
}

function createSlide(overlayText = "", secondaryText = ""): SlideDraft {
  return {
    id: crypto.randomUUID(),
    photoFile: null,
    overlayText,
    secondaryText,
    templateId: NONE_TEMPLATE,
    templateFile: null,
    resultUrl: null,
    overlay: null,
  };
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
  onRoteiroChange,
  onApply,
}: {
  contentId: string;
  projectId: string;
  clientId: string;
  format: DesignTemplateFormat;
  title: string;
  caption: string;
  roteiro: string;
  onRoteiroChange?: (roteiro: string) => void;
  onApply: (items: Array<{ url: string; overlay?: MediaTextOverlay }>) => void;
}) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const isCarousel = format === "carousel";

  const templatesQuery = useQuery({
    queryKey: ["design-templates", clientId, format],
    queryFn: () => listDesignTemplates(clientId, format),
  });
  const templates = templatesQuery.data ?? [];

  const clientQuery = useQuery({
    queryKey: ["clients", clientId],
    queryFn: () => getClient(clientId),
  });
  const kit = brandKitFromClient(clientQuery.data ?? {});

  const [templateSource, setTemplateSource] = useState<TemplateSource>("library");
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>("");
  const [templateFile, setTemplateFile] = useState<File | null>(null);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [overlayText, setOverlayText] = useState("");
  const [secondaryText, setSecondaryText] = useState("");
  const [guidance, setGuidance] = useState("");
  const [resultUrl, setResultUrl] = useState<string | null>(null);
  const [resultOverlay, setResultOverlay] = useState<MediaTextOverlay | null>(null);
  const [slides, setSlides] = useState<SlideDraft[]>([createSlide()]);
  const [openSlideId, setOpenSlideId] = useState("");
  const lastEmittedRoteiroRef = useRef<string | null>(null);
  const [generatingSlideId, setGeneratingSlideId] = useState<string | null>(null);
  const [lightbox, setLightbox] = useState<{ items: { url: string }[]; index: number } | null>(
    null,
  );
  const [provider, setProvider] = useState<DesignProvider>("openai");
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
    const formatted = formatRoteiroFromSlides(next);
    lastEmittedRoteiroRef.current = formatted;
    if (formatted !== roteiro) onRoteiroChange?.(formatted);
  }

  useEffect(() => {
    if (templates.length === 0) {
      setSelectedTemplateId("");
      setTemplateSource("upload");
      return;
    }
    setSelectedTemplateId((current) => current || templates[0].id);
    setTemplateSource("library");
  }, [templates]);

  async function resolveTemplateUrl(opts: {
    source: TemplateSource;
    templateId: string;
    file: File | null;
  }): Promise<string> {
    if (opts.source === "library") {
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
    baseUrl: string,
    overlayTextValue: string,
    secondaryTextValue: string,
    label: string,
  ) {
    const overlay = createDefaultOverlay({
      baseUrl,
      overlayText: overlayTextValue,
      secondaryText: secondaryTextValue,
      primaryFont: kit.brand_fonts.primary,
      secondaryFont: kit.brand_fonts.secondary,
      colors: kit.brand_colors,
    });
    const file = await flattenOverlayToFile(overlay, `${label}.png`);
    const url = await uploadContentMedia(projectId, file);
    return { url, overlay };
  }

  async function persistGeneratedArt(imageUrl: string, label: string) {
    try {
      await saveGeneratedArtToLibrary({
        clientId,
        imageUrl,
        name: label,
        notes: `Gerada no conteúdo ${contentId}`,
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

  const generateStaticMutation = useMutation({
    mutationFn: async () => {
      const templateUrl = await resolveTemplateUrl({
        source: templateSource,
        templateId: selectedTemplateId,
        file: templateFile,
      });
      if (!overlayText.trim()) throw new Error(t("project.detail.designAssistant.needText"));
      const photoUrl = photoFile ? await uploadContentMedia(projectId, photoFile) : undefined;
      const result = await generateDesign({
        contentId,
        projectId,
        clientId,
        format,
        provider,
        templateUrl,
        photoUrl,
        overlayText,
        secondaryText,
        guidance,
      });
      return composeGeneratedArt(result.imageUrl, overlayText, secondaryText, artBaseName);
    },
    onSuccess: async (composed) => {
      setResultUrl(composed.url);
      setResultOverlay(composed.overlay);
      await persistGeneratedArt(composed.url, artBaseName);
      toast.success(t("project.detail.designAssistant.generated"));
    },
    onError: (err: Error) => toast.error(err.message),
  });

  async function generateOneSlide(slide: SlideDraft) {
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

    const photoUrl = slide.photoFile
      ? await uploadContentMedia(projectId, slide.photoFile)
      : undefined;
    const result = await generateDesign({
      contentId,
      projectId,
      clientId,
      format: "carousel",
      provider,
      templateUrl,
      photoUrl,
      overlayText: slide.overlayText,
      secondaryText: slide.secondaryText,
      guidance,
    });
    const composed = await composeGeneratedArt(
      result.imageUrl,
      slide.overlayText,
      slide.secondaryText,
      `${artBaseName}-slide`,
    );
    return composed;
  }

  const generateSlideMutation = useMutation({
    mutationFn: async (slideId: string) => {
      const slide = slides.find((item) => item.id === slideId);
      if (!slide) throw new Error("Slide não encontrado");
      setGeneratingSlideId(slideId);
      const composed = await generateOneSlide(slide);
      return { slideId, ...composed };
    },
    onSuccess: async ({ slideId, url, overlay }) => {
      setSlides((prev) =>
        prev.map((slide) =>
          slide.id === slideId ? { ...slide, resultUrl: url, overlay } : slide,
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

  const generateAllMutation = useMutation({
    mutationFn: async () => {
      const urls: string[] = [];
      for (const [index, slide] of slides.entries()) {
        setGeneratingSlideId(slide.id);
        const composed = await generateOneSlide(slide);
        urls.push(composed.url);
        setSlides((prev) =>
          prev.map((item) =>
            item.id === slide.id
              ? { ...item, resultUrl: composed.url, overlay: composed.overlay }
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
    generateSlideMutation.isPending ||
    generateAllMutation.isPending;

  const handleApplyStatic = () => {
    if (!resultUrl) return;
    onApply([{ url: resultUrl, overlay: resultOverlay ?? undefined }]);
    toast.success(t("project.detail.designAssistant.applied"));
  };

  const handleApplyCarousel = () => {
    const items = slides
      .filter((slide): slide is SlideDraft & { resultUrl: string } => Boolean(slide.resultUrl))
      .map((slide) => ({ url: slide.resultUrl, overlay: slide.overlay ?? undefined }));
    if (items.length === 0) return;
    onApply(items);
    toast.success(t("project.detail.designAssistant.applied"));
  };

  async function handleDownload(url: string, name: string, format: "png" | "jpg") {
    try {
      await downloadImageFromUrl(url, name, format);
      toast.success(t("project.detail.designAssistant.downloadStarted"));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("project.detail.designAssistant.downloadError"));
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
                {t("project.detail.designAssistant.hint")}
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
          <Label variant="highlight">{t("project.detail.designAssistant.provider")}</Label>
          <p className="text-xs text-muted-foreground">
            {t("project.detail.designAssistant.providerHint")}
          </p>
          <Select
            value={provider}
            onValueChange={(value) => setProvider(value as DesignProvider)}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="openai">
                {t("project.detail.designAssistant.providerOpenAI")}
              </SelectItem>
              <SelectItem value="gemini">
                {t("project.detail.designAssistant.providerGemini")}
              </SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label variant="highlight">{t("project.detail.designAssistant.template")}</Label>
          <p className="text-xs text-muted-foreground">
            {t("project.detail.designAssistant.templateHint")}
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
              disabled={templates.length === 0}
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
            templates.length === 0 ? (
              <p className="text-xs text-muted-foreground">
                {t("project.detail.designAssistant.templateNone")}
              </p>
            ) : (
              <Select value={selectedTemplateId} onValueChange={setSelectedTemplateId}>
                <SelectTrigger className="h-auto min-h-14 py-1.5 [&>span]:line-clamp-none">
                  <SelectValue placeholder={t("project.detail.designAssistant.templateSelect")} />
                </SelectTrigger>
                <SelectContent className="max-h-80">
                  <TemplateSelectItems templates={templates} />
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
          {selectedTemplateId && templateSource === "library" ? (
            <img
              src={templates.find((item) => item.id === selectedTemplateId)?.file_url}
              alt=""
              className="mt-2 h-24 w-24 rounded-md border object-cover"
            />
          ) : null}
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
                  e.target.value = "";
                }}
              />
              <Button
                type="button"
                variant="secondary"
                onClick={() => photoFileInputRef.current?.click()}
              >
                <ImagePlus className="mr-1.5 size-4" aria-hidden="true" />
                {t("project.detail.designAssistant.photo")}
              </Button>
              <p className="text-xs text-muted-foreground">
                {photoFile
                  ? t("project.detail.designAssistant.fileSelected", { name: photoFile.name })
                  : t("project.detail.designAssistant.photoHint")}
              </p>
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
            <Button
              type="button"
              onClick={() => generateStaticMutation.mutate()}
              disabled={busy}
            >
              {busy ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  {t("project.detail.designAssistant.generating")}
                </>
              ) : (
                <>
                  <Palette className="size-4" />
                  {t("project.detail.designAssistant.generate")}
                </>
              )}
            </Button>
            {resultUrl ? (
              <div className="space-y-3 rounded-lg border border-border bg-muted/30 p-4">
                <p className="text-sm font-medium">
                  {t("project.detail.designAssistant.previewTitle")}
                </p>
                <GeneratedArtPreview
                  src={resultUrl}
                  alt={t("project.detail.designAssistant.previewTitle")}
                  onExpand={() => setLightbox({ items: [{ url: resultUrl }], index: 0 })}
                  className="mx-auto w-full max-w-sm aspect-[3/4] bg-muted/40"
                  imgClassName="h-full w-full object-contain"
                />
                <div className="flex flex-wrap gap-2">
                  <Button type="button" onClick={handleApplyStatic}>
                    {t("project.detail.designAssistant.apply")}
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
                  <Button type="button" variant="outline" onClick={() => { setResultUrl(null); setResultOverlay(null); }}>
                    {t("project.detail.designAssistant.discard")}
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  {t("project.detail.designAssistant.savedToLibrary")}
                </p>
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
                <Button
                  type="button"
                  size="sm"
                  onClick={() => generateAllMutation.mutate()}
                  disabled={busy || slides.length === 0}
                >
                  {generateAllMutation.isPending ? (
                    <>
                      <Loader2 className="size-4 animate-spin" />
                      {t("project.detail.designAssistant.generating")}
                    </>
                  ) : (
                    t("project.detail.designAssistant.generateAll")
                  )}
                </Button>
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
                            <span className="block text-base font-semibold">
                              {t("project.detail.designAssistant.slide", { n: index + 1 })}
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
                          disabled={busy}
                          onClick={() => generateSlideMutation.mutate(slide.id)}
                        >
                          {slideBusy ? (
                            <Loader2 className="size-4 animate-spin" />
                          ) : (
                            t("project.detail.designAssistant.generate")
                          )}
                        </Button>
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
                              item.id === slide.id ? { ...item, photoFile: file } : item,
                            ),
                          );
                          e.target.value = "";
                        }}
                      />
                      <Button
                        type="button"
                        size="sm"
                        variant="secondary"
                        onClick={() => slidePhotoInputRefs.current[slide.id]?.click()}
                      >
                        <ImagePlus className="mr-1.5 size-3.5" aria-hidden="true" />
                        {t("project.detail.designAssistant.slidePhoto")}
                      </Button>
                      <p className="text-xs text-muted-foreground">
                        {slide.photoFile
                          ? t("project.detail.designAssistant.fileSelected", {
                              name: slide.photoFile.name,
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
                                templates.find((item) => item.id === selectedTemplateId)?.file_url
                              }
                            />
                          </SelectItem>
                          <TemplateSelectItems templates={templates} />
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
                          alt={t("project.detail.designAssistant.slide", { n: index + 1 })}
                          onExpand={() => {
                            const items = slides
                              .filter((item) => item.resultUrl)
                              .map((item) => ({ url: item.resultUrl! }));
                            const start = items.findIndex((item) => item.url === slide.resultUrl);
                            setLightbox({ items, index: Math.max(start, 0) });
                          }}
                          className="w-40 aspect-[3/4] border bg-muted/40"
                          imgClassName="h-full w-full object-contain"
                        />
                        <div className="flex flex-wrap gap-2">
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
                  <Button type="button" onClick={handleApplyCarousel}>
                    {t("project.detail.designAssistant.apply")}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() =>
                      setSlides((prev) => prev.map((slide) => ({ ...slide, resultUrl: null, overlay: null })))
                    }
                  >
                    {t("project.detail.designAssistant.discard")}
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  {t("project.detail.designAssistant.savedToLibrary")}
                </p>
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
      items={lightbox?.items ?? []}
      title={t("project.detail.designAssistant.previewTitle")}
      initialIndex={lightbox?.index ?? 0}
    />
    </>
  );
}
