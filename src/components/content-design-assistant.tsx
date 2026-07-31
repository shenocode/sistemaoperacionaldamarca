import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { ChevronDown, Download, ImagePlus, Loader2, Palette, Plus, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
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
  generateDesign,
  listDesignTemplates,
  saveGeneratedArtToLibrary,
  uploadContentMedia,
  type DesignProvider,
  type DesignTemplateFormat,
} from "@/lib/api";
import { downloadImageFromUrl } from "@/lib/download-image";

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
};

function createSlide(overlayText = "", secondaryText = ""): SlideDraft {
  return {
    id: crypto.randomUUID(),
    photoFile: null,
    overlayText,
    secondaryText,
    templateId: NONE_TEMPLATE,
    templateFile: null,
    resultUrl: null,
  };
}

function parseRoteiroSlides(roteiro: string): string[] {
  const lines = roteiro
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  const slides: string[] = [];
  for (const line of lines) {
    const match = line.match(/^slide\s*(\d+)\s*[:\-–]\s*(.+)$/i);
    if (match) {
      const index = Number(match[1]) - 1;
      if (index >= 0 && index < MAX_SLIDES) {
        slides[index] = match[2].trim();
      }
    }
  }
  const compact = slides.filter((text): text is string => typeof text === "string" && text.length > 0);
  return compact.length > 0 ? compact : lines.slice(0, MAX_SLIDES);
}

export function ContentDesignAssistant({
  contentId,
  projectId,
  clientId,
  format,
  title,
  caption,
  roteiro,
  onApply,
}: {
  contentId: string;
  projectId: string;
  clientId: string;
  format: DesignTemplateFormat;
  title: string;
  caption: string;
  roteiro: string;
  onApply: (urls: string[]) => void;
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

  const [templateSource, setTemplateSource] = useState<TemplateSource>("library");
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>("");
  const [templateFile, setTemplateFile] = useState<File | null>(null);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [overlayText, setOverlayText] = useState("");
  const [secondaryText, setSecondaryText] = useState("");
  const [guidance, setGuidance] = useState("");
  const [resultUrl, setResultUrl] = useState<string | null>(null);
  const [slides, setSlides] = useState<SlideDraft[]>([createSlide()]);
  const [generatingSlideId, setGeneratingSlideId] = useState<string | null>(null);
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
    const fromRoteiro = parseRoteiroSlides(roteiro);
    if (fromRoteiro.length > 0) {
      setSlides(fromRoteiro.map((text) => createSlide(text)));
      return;
    }
    setSlides((prev) => (prev.length > 0 ? prev : [createSlide(defaultOverlay)]));
  }, [isCarousel, roteiro, defaultOverlay]);

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
      if (!photoFile) throw new Error(t("project.detail.designAssistant.needPhoto"));
      if (!overlayText.trim()) throw new Error(t("project.detail.designAssistant.needText"));
      const photoUrl = await uploadContentMedia(projectId, photoFile);
      return generateDesign({
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
    },
    onSuccess: async (result) => {
      setResultUrl(result.imageUrl);
      await persistGeneratedArt(result.imageUrl, artBaseName);
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
    if (!slide.photoFile) throw new Error(t("project.detail.designAssistant.needPhoto"));
    if (!slide.overlayText.trim()) throw new Error(t("project.detail.designAssistant.needText"));

    const photoUrl = await uploadContentMedia(projectId, slide.photoFile);
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
    return result.imageUrl;
  }

  const generateSlideMutation = useMutation({
    mutationFn: async (slideId: string) => {
      const slide = slides.find((item) => item.id === slideId);
      if (!slide) throw new Error("Slide não encontrado");
      setGeneratingSlideId(slideId);
      const imageUrl = await generateOneSlide(slide);
      return { slideId, imageUrl };
    },
    onSuccess: async ({ slideId, imageUrl }) => {
      setSlides((prev) =>
        prev.map((slide) => (slide.id === slideId ? { ...slide, resultUrl: imageUrl } : slide)),
      );
      const index = slides.findIndex((item) => item.id === slideId);
      await persistGeneratedArt(
        imageUrl,
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
        const imageUrl = await generateOneSlide(slide);
        urls.push(imageUrl);
        setSlides((prev) =>
          prev.map((item) => (item.id === slide.id ? { ...item, resultUrl: imageUrl } : item)),
        );
        await persistGeneratedArt(imageUrl, `${artBaseName}-slide-${index + 1}`);
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
    onApply([resultUrl]);
    toast.success(t("project.detail.designAssistant.applied"));
  };

  const handleApplyCarousel = () => {
    const urls = slides.map((slide) => slide.resultUrl).filter((url): url is string => Boolean(url));
    if (urls.length === 0) return;
    onApply(urls);
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
                <SelectTrigger>
                  <SelectValue placeholder={t("project.detail.designAssistant.templateSelect")} />
                </SelectTrigger>
                <SelectContent>
                  {templates.map((template) => (
                    <SelectItem key={template.id} value={template.id}>
                      {template.name}
                    </SelectItem>
                  ))}
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
                <img
                  src={resultUrl}
                  alt=""
                  className="mx-auto max-h-80 w-full max-w-sm rounded-md object-contain"
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
                  <Button type="button" variant="outline" onClick={() => setResultUrl(null)}>
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
                    setSlides((prev) => [...prev, createSlide()]);
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

            <div className="space-y-4">
              {slides.map((slide, index) => {
                const slideBusy = generatingSlideId === slide.id;
                return (
                  <div
                    key={slide.id}
                    className="space-y-3 rounded-lg border border-border p-4"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-medium">
                        {t("project.detail.designAssistant.slide", { n: index + 1 })}
                      </p>
                      <div className="flex gap-1">
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
                            onClick={() =>
                              setSlides((prev) => prev.filter((item) => item.id !== slide.id))
                            }
                          >
                            <Trash2 className="size-4" />
                          </Button>
                        ) : null}
                      </div>
                    </div>

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
                          setSlides((prev) =>
                            prev.map((item) =>
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
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value={NONE_TEMPLATE}>
                            {t("project.detail.designAssistant.defaultTemplate")}
                          </SelectItem>
                          {templates.map((template) => (
                            <SelectItem key={template.id} value={template.id}>
                              {template.name}
                            </SelectItem>
                          ))}
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
                        <img
                          src={slide.resultUrl}
                          alt=""
                          className="h-40 w-40 rounded-md border object-cover"
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
                  </div>
                );
              })}
            </div>

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
                      setSlides((prev) => prev.map((slide) => ({ ...slide, resultUrl: null })))
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
  );
}
