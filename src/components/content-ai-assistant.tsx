import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useMutation } from "@tanstack/react-query";
import { Loader2, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
  onApply: (suggestion: ContentAiAssistantApply) => void;
};

function parseYoutubeUrls(raw: string): string[] {
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
  const { t } = useTranslation();
  const [prompt, setPrompt] = useState("");
  const [references, setReferences] = useState("");
  const [youtubeUrls, setYoutubeUrls] = useState("");
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
        youtubeUrls: parseYoutubeUrls(youtubeUrls),
        format,
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

  const handleApply = () => {
    if (!draft) return;
    onApply({
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
    <Card className="rounded-xl">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Sparkles className="size-4 text-primary" />
          {t("project.detail.assistant.title")}
        </CardTitle>
        <p className="text-sm text-muted-foreground">{t("project.detail.assistant.hint")}</p>
      </CardHeader>
      <CardContent className="space-y-4">
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
          <p className="text-xs text-muted-foreground">{t("project.detail.assistant.youtubeHint")}</p>
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
            <p className="text-sm font-medium">{t("project.detail.assistant.previewTitle")}</p>
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
    </Card>
  );
}
