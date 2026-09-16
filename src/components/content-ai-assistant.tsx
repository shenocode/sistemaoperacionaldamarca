import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "@tanstack/react-router";
import { useMutation, useQuery } from "@tanstack/react-query";
import { ChevronDown, KeyRound, Loader2, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  ContentAiDocumentField,
  type AssistantDocumentRef,
} from "@/components/content-ai-document-field";
import {
  formatLocucaoScript,
  locucaoPartsFromSuggestion,
} from "@/lib/locucao-script";
import {
  getAdminAiKeysStatus,
  suggestContent,
  type ContentFormat,
  type ContentSuggestion,
  type DesignProvider,
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

function withLocucaoParts(suggestion: ContentSuggestion): ContentSuggestion {
  const parts = locucaoPartsFromSuggestion(suggestion);
  return {
    ...suggestion,
    locucaoHook: parts.hook,
    locucaoBody: parts.body,
    locucaoCta: parts.cta,
    locucao: formatLocucaoScript(parts) || suggestion.locucao,
  };
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
  const [tiktokUrls, setTiktokUrls] = useState("");
  const [transcription, setTranscription] = useState("");
  const [webSearch, setWebSearch] = useState(false);
  const [refineInstruction, setRefineInstruction] = useState("");
  const [attachedDocument, setAttachedDocument] = useState<AssistantDocumentRef | null>(null);
  const [draft, setDraft] = useState<ContentSuggestion | null>(null);
  const [provider, setProvider] = useState<DesignProvider>("openai");
  const generatingRef = useRef(false);
  const didInitProvider = useRef(false);

  const keysQuery = useQuery({
    queryKey: ["admin-ai-keys"],
    queryFn: getAdminAiKeysStatus,
  });
  const openaiConfigured = Boolean(keysQuery.data?.openaiConfigured);
  const geminiConfigured = Boolean(keysQuery.data?.geminiConfigured);
  const selectedKeyConfigured = provider === "gemini" ? geminiConfigured : openaiConfigured;
  const blockForMissingKey = !keysQuery.isLoading && !keysQuery.isError && !selectedKeyConfigured;

  useEffect(() => {
    if (didInitProvider.current || keysQuery.isLoading || keysQuery.isError) return;
    didInitProvider.current = true;
    if (!openaiConfigured && geminiConfigured) setProvider("gemini");
  }, [keysQuery.isLoading, keysQuery.isError, openaiConfigured, geminiConfigured]);

  const needsLocucao = format === "reels" || format === "recorded_video" || format === "youtube_short";
  const needsRoteiro = format === "carousel";

  const applySuggestion = (suggestion: ContentSuggestion) => {
    const next = withLocucaoParts(suggestion);
    setDraft(next);
    if (next.webSearchUnavailable) {
      toast.warning(t("project.detail.assistant.webSearchUnavailable"));
    }
  };

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
        tiktokUrls: parseVideoUrls(tiktokUrls),
        transcription,
        libraryAssetId: attachedDocument?.libraryAssetId,
        documentUrl: attachedDocument?.documentUrl,
        documentName: attachedDocument?.documentName,
        format,
        locale: i18n.resolvedLanguage ?? i18n.language,
        provider,
        webSearch,
      }),
    onSuccess: (suggestion) => {
      applySuggestion(suggestion);
      toast.success(t("project.detail.assistant.generated"));
    },
    onError: (err: Error) => toast.error(err.message),
    onSettled: () => {
      generatingRef.current = false;
    },
  });

  const refineMutation = useMutation({
    mutationFn: () => {
      if (!draft) throw new Error(t("project.detail.assistant.refineNeedDraft"));
      return suggestContent({
        contentId,
        projectId,
        clientId,
        prompt,
        references,
        youtubeUrls: parseVideoUrls(youtubeUrls),
        instagramUrls: parseVideoUrls(instagramUrls),
        tiktokUrls: parseVideoUrls(tiktokUrls),
        transcription,
        libraryAssetId: attachedDocument?.libraryAssetId,
        documentUrl: attachedDocument?.documentUrl,
        documentName: attachedDocument?.documentName,
        format,
        locale: i18n.resolvedLanguage ?? i18n.language,
        provider,
        webSearch,
        mode: "refine",
        refineInstruction,
        currentDraft: draft,
      });
    },
    onSuccess: (suggestion) => {
      applySuggestion(suggestion);
      setRefineInstruction("");
      toast.success(t("project.detail.assistant.refined"));
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const updateDraft = <K extends keyof ContentSuggestion>(key: K, value: ContentSuggestion[K]) => {
    setDraft((prev) => (prev ? { ...prev, [key]: value } : prev));
  };

  const updateLocucaoPart = (key: "locucaoHook" | "locucaoBody" | "locucaoCta", value: string) => {
    setDraft((prev) => {
      if (!prev) return prev;
      const next = { ...prev, [key]: value };
      const locucao = formatLocucaoScript({
        hook: next.locucaoHook,
        body: next.locucaoBody,
        cta: next.locucaoCta,
      });
      return { ...next, locucao };
    });
  };

  const handleApply = async () => {
    if (!draft) return;
    await onApply({
      title: draft.title,
      caption: draft.caption,
      cta: draft.cta,
      hashtags: draft.hashtags,
      theme: draft.theme,
      locucao: needsLocucao
        ? formatLocucaoScript({
            hook: draft.locucaoHook,
            body: draft.locucaoBody,
            cta: draft.locucaoCta,
          }) || draft.locucao
        : draft.locucao,
      roteiro: draft.roteiro,
    });
    toast.success(t("project.detail.assistant.applied"));
  };

  const handleDiscard = () => {
    setDraft(null);
    setRefineInstruction("");
  };

  const busy = generateMutation.isPending || refineMutation.isPending;

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
              <Label variant="highlight">{t("project.detail.assistant.provider")}</Label>
              <p className="text-xs text-muted-foreground">
                {t("project.detail.assistant.providerHint")}
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
                    {t("project.detail.assistant.providerOpenAI")}
                  </SelectItem>
                  <SelectItem value="gemini">
                    {t("project.detail.assistant.providerGemini")}
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
            {!keysQuery.isLoading && !selectedKeyConfigured ? (
              <Alert>
                <KeyRound className="h-4 w-4" />
                <AlertTitle>
                  {provider === "gemini"
                    ? t("project.detail.assistant.missingGeminiTitle")
                    : t("project.detail.assistant.platformKeyTitle")}
                </AlertTitle>
                <AlertDescription className="space-y-2">
                  <p>
                    {provider === "gemini"
                      ? t("project.detail.assistant.missingGeminiBody")
                      : t("project.detail.assistant.platformKeyBody")}
                  </p>
                  <Link to="/settings" className="inline-flex text-xs font-medium text-primary hover:underline">
                    {t("project.detail.assistant.openAiSettings")}
                  </Link>
                </AlertDescription>
              </Alert>
            ) : null}
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
            <ContentAiDocumentField
              clientId={clientId}
              projectId={projectId}
              value={attachedDocument}
              onChange={setAttachedDocument}
              disabled={busy}
            />
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
            <div className="space-y-1.5">
              <Label htmlFor="ai-tiktok" variant="highlight">
                {t("project.detail.assistant.tiktok")}
              </Label>
              <Textarea
                id="ai-tiktok"
                rows={2}
                value={tiktokUrls}
                onChange={(e) => setTiktokUrls(e.target.value)}
                placeholder={t("project.detail.assistant.tiktokPlaceholder")}
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
            <label className="flex items-start gap-2 text-sm">
              <Checkbox
                checked={webSearch}
                onCheckedChange={(value) => setWebSearch(value === true)}
                className="mt-0.5"
              />
              <span>
                {t("project.detail.assistant.webSearch")}
                <span className="mt-0.5 block text-xs text-muted-foreground">
                  {t("project.detail.assistant.webSearchHint")}
                </span>
              </span>
            </label>

            <Button
              type="button"
              onClick={() => {
                if (generatingRef.current || !prompt.trim() || busy) return;
                if (blockForMissingKey) {
                  toast.error(
                    provider === "gemini"
                      ? t("project.detail.assistant.missingGeminiError")
                      : t("project.detail.assistant.missingKeyError"),
                  );
                  return;
                }
                generatingRef.current = true;
                generateMutation.mutate();
              }}
              disabled={!prompt.trim() || busy || blockForMissingKey}
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
                  <div className="space-y-3">
                    <p className="text-sm font-medium">{t("project.detail.locucao")}</p>
                    <div className="space-y-1.5">
                      <Label htmlFor="ai-draft-hook">{t("project.detail.assistant.hook")}</Label>
                      <Textarea
                        id="ai-draft-hook"
                        rows={2}
                        value={draft.locucaoHook}
                        onChange={(e) => updateLocucaoPart("locucaoHook", e.target.value)}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="ai-draft-body">{t("project.detail.assistant.body")}</Label>
                      <Textarea
                        id="ai-draft-body"
                        rows={4}
                        value={draft.locucaoBody}
                        onChange={(e) => updateLocucaoPart("locucaoBody", e.target.value)}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="ai-draft-spoken-cta">{t("project.detail.assistant.spokenCta")}</Label>
                      <Textarea
                        id="ai-draft-spoken-cta"
                        rows={2}
                        value={draft.locucaoCta}
                        onChange={(e) => updateLocucaoPart("locucaoCta", e.target.value)}
                      />
                    </div>
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
                {draft.webSources && draft.webSources.length > 0 ? (
                  <div className="space-y-1.5">
                    <p className="text-sm font-medium">{t("project.detail.assistant.sources")}</p>
                    <ul className="space-y-1 text-xs text-muted-foreground">
                      {draft.webSources.map((source) => (
                        <li key={source.url}>
                          <a
                            href={source.url}
                            target="_blank"
                            rel="noreferrer"
                            className="text-primary hover:underline"
                          >
                            {source.title || source.url}
                          </a>
                          {source.snippet ? ` — ${source.snippet}` : null}
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
                <div className="space-y-1.5">
                  <Label htmlFor="ai-refine">{t("project.detail.assistant.refine")}</Label>
                  <Textarea
                    id="ai-refine"
                    rows={2}
                    value={refineInstruction}
                    onChange={(e) => setRefineInstruction(e.target.value)}
                    placeholder={t("project.detail.assistant.refinePlaceholder")}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      if (!refineInstruction.trim() || busy || blockForMissingKey) return;
                      refineMutation.mutate();
                    }}
                    disabled={!refineInstruction.trim() || busy || blockForMissingKey}
                  >
                    {refineMutation.isPending ? (
                      <>
                        <Loader2 className="size-4 animate-spin" />
                        {t("project.detail.assistant.refining")}
                      </>
                    ) : (
                      t("project.detail.assistant.refineSubmit")
                    )}
                  </Button>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button type="button" onClick={handleApply} disabled={busy}>
                    {t("project.detail.assistant.apply")}
                  </Button>
                  <Button type="button" variant="outline" onClick={handleDiscard} disabled={busy}>
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
