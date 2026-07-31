import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useMutation } from "@tanstack/react-query";
import { ChevronDown, Loader2, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardTitle } from "@/components/ui/card";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  suggestContent,
  type ContentFormat,
  type ContentSuggestion,
} from "@/lib/api";

export type ContentAiAssistantApply = {
  title: string;
  caption: string;
  cta: string;
  hashtags: string;
  theme: string | null;
  locucao: string;
  roteiro: string;
};

type ContentAiAssistantProps = {
  contentId: string;
  projectId: string;
  clientId: string;
  format: ContentFormat;
  onApply: (suggestion: ContentAiAssistantApply) => void | Promise<void>;
};

function parseVideoUrls(raw: string): string[] {
  return raw
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

export function ContentAiAssistant({
  contentId,
  projectId,
  clientId,
  format,
  onApply,
}: ContentAiAssistantProps) {
  const { t, i18n } = useTranslation();
  const [open, setOpen] = useState(false);
  const [prompt, setPrompt] = useState("");
  const [references, setReferences] = useState("");
  const [youtubeUrls, setYoutubeUrls] = useState("");
  const [instagramUrls, setInstagramUrls] = useState("");
  const [transcription, setTranscription] = useState("");
  const [draft, setDraft] = useState<ContentSuggestion | null>(null);

  const needsLocucao = format === "reels" || format === "recorded_video";
  const needsRoteiro = format === "carousel";

  const generateMutation = useMutation({
    mutationFn: () =>
      suggestContent({
        contentId,
        projectId,
        clientId,
        prompt,
        references,
        youtubeUrls: parseVideoUrls(youtubeUrls),
        instagramUrls: parseVideoUrls(instagramUrls),
        transcription,
        format,
        locale: i18n.resolvedLanguage ?? i18n.language,
      }),
    onSuccess: (suggestion) => {
      setDraft(suggestion);
      toast.success(t("project.detail.assistant.generated"));
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const updateDraft = <K extends keyof ContentSuggestion>(key: K, value: ContentSuggestion[K]) => {
    setDraft((prev) => (prev ? { ...prev, [key]: value } : prev));
  };

  const handleApply = async () => {
    if (!draft) return;
    await onApply({
      title: draft.title,
      caption: draft.caption,
      cta: draft.cta,
      hashtags: draft.hashtags,
      theme: draft.theme,
      locucao: draft.locucao,
      roteiro: draft.roteiro,
    });
    toast.success(t("project.detail.assistant.applied"));
  };

  const handleDiscard = () => {
    setDraft(null);
  };

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <Card className="rounded-xl">
        <CollapsibleTrigger asChild>
          <button
            type="button"
            className={`flex w-full flex-row items-center gap-3 px-6 pt-6 text-left transition-colors hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 rounded-t-xl [&[data-state=open]_svg.assistant-chevron]:rotate-180 ${
              open ? "pb-3" : "pb-6 rounded-b-xl"
            }`}
          >
            <div className="min-w-0 flex-1">
              <CardTitle className="flex items-center gap-2 text-base">
                <Sparkles className="size-4 text-primary" />
                {t("project.detail.assistant.title")}
              </CardTitle>
              <p className="mt-1 text-sm text-muted-foreground">
                {t("project.detail.assistant.hint")}
              </p>
            </div>
            <ChevronDown
              className="assistant-chevron h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200"
              aria-hidden="true"
            />
          </button>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <CardContent className="space-y-4 pt-0">
            <div className="space-y-1.5">
              <Label htmlFor="ai-prompt" variant="highlight">
                {t("project.detail.assistant.prompt")}
              </Label>
              <Textarea
                id="ai-prompt"
                rows={3}
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder={t("project.detail.assistant.promptPlaceholder")}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ai-references" variant="highlight">
                {t("project.detail.assistant.references")}
              </Label>
              <Textarea
                id="ai-references"
                rows={3}
                value={references}
                onChange={(e) => setReferences(e.target.value)}
                placeholder={t("project.detail.assistant.referencesPlaceholder")}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ai-youtube" variant="highlight">
                {t("project.detail.assistant.youtube")}
              </Label>
              <Textarea
                id="ai-youtube"
                rows={2}
                value={youtubeUrls}
                onChange={(e) => setYoutubeUrls(e.target.value)}
                placeholder={t("project.detail.assistant.youtubePlaceholder")}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ai-instagram" variant="highlight">
                {t("project.detail.assistant.instagram")}
              </Label>
              <Textarea
                id="ai-instagram"
                rows={2}
                value={instagramUrls}
                onChange={(e) => setInstagramUrls(e.target.value)}
                placeholder={t("project.detail.assistant.instagramPlaceholder")}
              />
            </div>
            <p className="text-xs text-muted-foreground">
              {t("project.detail.assistant.videoLinksHint")}
            </p>
            <div className="space-y-1.5">
              <Label htmlFor="ai-transcription" variant="highlight">
                {t("project.detail.assistant.transcription")}
              </Label>
              <Textarea
                id="ai-transcription"
                rows={5}
                value={transcription}
                onChange={(e) => setTranscription(e.target.value)}
                placeholder={t("project.detail.assistant.transcriptionPlaceholder")}
              />
              <p className="text-xs text-muted-foreground">
                {t("project.detail.assistant.transcriptionHint")}
              </p>
            </div>

            <Button
              type="button"
              onClick={() => generateMutation.mutate()}
              disabled={!prompt.trim() || generateMutation.isPending}
            >
              {generateMutation.isPending ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  {t("project.detail.assistant.generating")}
                </>
              ) : (
                <>
                  <Sparkles className="size-4" />
                  {t("project.detail.assistant.generate")}
                </>
              )}
            </Button>

            {draft ? (
              <div className="space-y-4 rounded-lg border border-border bg-muted/30 p-4">
                <p className="text-sm font-medium">
                  {t("project.detail.assistant.previewTitle")}
                </p>
                <div className="space-y-1.5">
                  <Label htmlFor="ai-draft-title">{t("project.content.title")}</Label>
                  <Input
                    id="ai-draft-title"
                    value={draft.title}
                    onChange={(e) => updateDraft("title", e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="ai-draft-caption">{t("project.detail.caption")}</Label>
                  <Textarea
                    id="ai-draft-caption"
                    rows={4}
                    value={draft.caption}
                    onChange={(e) => updateDraft("caption", e.target.value)}
                  />
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label htmlFor="ai-draft-cta">{t("project.detail.cta")}</Label>
                    <Input
                      id="ai-draft-cta"
                      value={draft.cta}
                      onChange={(e) => updateDraft("cta", e.target.value)}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="ai-draft-hashtags">{t("project.detail.hashtags")}</Label>
                    <Input
                      id="ai-draft-hashtags"
                      value={draft.hashtags}
                      onChange={(e) => updateDraft("hashtags", e.target.value)}
                    />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="ai-draft-theme">{t("project.calendar.columns.theme")}</Label>
                  <Input
                    id="ai-draft-theme"
                    value={draft.theme ?? ""}
                    onChange={(e) => updateDraft("theme", e.target.value || null)}
                    placeholder={t("project.calendar.noTheme")}
                  />
                </div>
                {needsLocucao ? (
                  <div className="space-y-1.5">
                    <Label htmlFor="ai-draft-locucao">{t("project.detail.locucao")}</Label>
                    <Textarea
                      id="ai-draft-locucao"
                      rows={4}
                      value={draft.locucao}
                      onChange={(e) => updateDraft("locucao", e.target.value)}
                    />
                  </div>
                ) : null}
                {needsRoteiro ? (
                  <div className="space-y-1.5">
                    <Label htmlFor="ai-draft-roteiro">{t("project.detail.roteiro")}</Label>
                    <Textarea
                      id="ai-draft-roteiro"
                      rows={5}
                      value={draft.roteiro}
                      onChange={(e) => updateDraft("roteiro", e.target.value)}
                    />
                  </div>
                ) : null}
                <div className="flex flex-wrap gap-2">
                  <Button type="button" onClick={handleApply}>
                    {t("project.detail.assistant.apply")}
                  </Button>
                  <Button type="button" variant="outline" onClick={handleDiscard}>
                    {t("project.detail.assistant.discard")}
                  </Button>
                </div>
              </div>
            ) : null}
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}
