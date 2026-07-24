import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Loader2, Palette, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
  DESIGN_TEMPLATE_ACCEPT,
  generateDesign,
  listDesignTemplates,
  uploadContentMedia,
  type DesignTemplateFormat,
} from "@/lib/api";

const MAX_SLIDES = 8;
const NONE_TEMPLATE = "__none__";

type TemplateSource = "library" | "upload";

type SlideDraft = {
  id: string;
  photoFile: File | null;
  overlayText: string;
  templateId: string;
  templateFile: File | null;
  resultUrl: string | null;
};

function createSlide(overlayText = ""): SlideDraft {
  return {
    id: crypto.randomUUID(),
    photoFile: null,
    overlayText,
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
  const isCarousel = format === "carousel";

  const templatesQuery = useQuery({
    queryKey: ["design-templates", projectId, format],
    queryFn: () => listDesignTemplates(projectId, format),
  });
  const templates = templatesQuery.data ?? [];

  const [templateSource, setTemplateSource] = useState<TemplateSource>("library");
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>("");
  const [templateFile, setTemplateFile] = useState<File | null>(null);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [overlayText, setOverlayText] = useState("");
  const [guidance, setGuidance] = useState("");
  const [resultUrl, setResultUrl] = useState<string | null>(null);
  const [slides, setSlides] = useState<SlideDraft[]>([createSlide()]);
  const [generatingSlideId, setGeneratingSlideId] = useState<string | null>(null);

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
        templateUrl,
        photoUrl,
        overlayText,
        guidance,
      });
    },
    onSuccess: (result) => {
      setResultUrl(result.imageUrl);
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
      templateUrl,
      photoUrl,
      overlayText: slide.overlayText,
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
    onSuccess: ({ slideId, imageUrl }) => {
      setSlides((prev) =>
        prev.map((slide) => (slide.id === slideId ? { ...slide, resultUrl: imageUrl } : slide)),
      );
      toast.success(t("project.detail.designAssistant.generated"));
    },
    onError: (err: Error) => toast.error(err.message),
    onSettled: () => setGeneratingSlideId(null),
  });

  const generateAllMutation = useMutation({
    mutationFn: async () => {
      const urls: string[] = [];
      for (const slide of slides) {
        setGeneratingSlideId(slide.id);
        const imageUrl = await generateOneSlide(slide);
        urls.push(imageUrl);
        setSlides((prev) =>
          prev.map((item) => (item.id === slide.id ? { ...item, resultUrl: imageUrl } : item)),
        );
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

  return (
    <Card className="rounded-xl">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Palette className="size-4 text-primary" />
          {t("project.detail.designAssistant.title")}
        </CardTitle>
        <p className="text-sm text-muted-foreground">{t("project.detail.designAssistant.hint")}</p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-1.5">
          <Label variant="highlight">{t("project.detail.designAssistant.template")}</Label>
          <p className="text-xs text-muted-foreground">
            {t("project.detail.designAssistant.templateHint")}
          </p>
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
              onClick={() => setTemplateSource("upload")}
            >
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
            <Input
              type="file"
              accept={DESIGN_TEMPLATE_ACCEPT}
              onChange={(e) => setTemplateFile(e.target.files?.[0] ?? null)}
            />
          )}
          {selectedTemplateId && templateSource === "library" ? (
            <img
              src={templates.find((item) => item.id === selectedTemplateId)?.file_url}
              alt=""
              className="mt-2 h-24 w-24 rounded-md border object-cover"
            />
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
              <Label htmlFor="design-photo" variant="highlight">
                {t("project.detail.designAssistant.photo")}
              </Label>
              <Input
                id="design-photo"
                type="file"
                accept="image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp"
                onChange={(e) => setPhotoFile(e.target.files?.[0] ?? null)}
              />
              <p className="text-xs text-muted-foreground">
                {t("project.detail.designAssistant.photoHint")}
              </p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="design-overlay" variant="highlight">
                {t("project.detail.designAssistant.overlayText")}
              </Label>
              <Textarea
                id="design-overlay"
                rows={3}
                value={overlayText}
                onChange={(e) => setOverlayText(e.target.value)}
                placeholder={t("project.detail.designAssistant.overlayPlaceholder")}
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
                  <Button type="button" variant="outline" onClick={() => setResultUrl(null)}>
                    {t("project.detail.designAssistant.discard")}
                  </Button>
                </div>
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
                      <Label>{t("project.detail.designAssistant.slidePhoto")}</Label>
                      <Input
                        type="file"
                        accept="image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp"
                        onChange={(e) => {
                          const file = e.target.files?.[0] ?? null;
                          setSlides((prev) =>
                            prev.map((item) =>
                              item.id === slide.id ? { ...item, photoFile: file } : item,
                            ),
                          );
                        }}
                      />
                    </div>

                    <div className="space-y-1.5">
                      <Label>{t("project.detail.designAssistant.slideText")}</Label>
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
                      <Input
                        type="file"
                        accept={DESIGN_TEMPLATE_ACCEPT}
                        onChange={(e) => {
                          const file = e.target.files?.[0] ?? null;
                          setSlides((prev) =>
                            prev.map((item) =>
                              item.id === slide.id
                                ? { ...item, templateFile: file, templateId: NONE_TEMPLATE }
                                : item,
                            ),
                          );
                        }}
                      />
                    </div>

                    {slide.resultUrl ? (
                      <img
                        src={slide.resultUrl}
                        alt=""
                        className="h-40 w-40 rounded-md border object-cover"
                      />
                    ) : null}
                  </div>
                );
              })}
            </div>

            {slides.some((slide) => slide.resultUrl) ? (
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
            ) : null}
          </>
        )}
      </CardContent>
    </Card>
  );
}
