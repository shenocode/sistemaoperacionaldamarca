import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "@tanstack/react-router";
import { useMutation, useQuery } from "@tanstack/react-query";
import { ChevronDown, KeyRound, Loader2, RotateCcw, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
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
import { ContentAiReferencesField } from "@/components/content-ai-references-field";
import {
  formatLocucaoScript,
  locucaoPartsFromSuggestion,
} from "@/lib/locucao-script";
import {
  getAdminAiKeysStatus,
  suggestContent,
  type AiChatProvider,
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
  /** Clears copy fields filled by a previous Approve (form only; caller should still save). */
  onClearAppliedFields?: () => void | Promise<void>;
};

type PersistedAssistantState = {
  open: boolean;
  prompt: string;
  selectedLibraryAssetIds: string[];
  transcription: string;
  webSearch: boolean;
  refineInstruction: string;
  draft: ContentSuggestion | null;
  provider: AiChatProvider;
  appliedOnce: boolean;
};

const ASSISTANT_STORAGE_PREFIX = "som:content-ai-assistant:";

function assistantStorageKey(contentId: string) {
  return `${ASSISTANT_STORAGE_PREFIX}${contentId}`;
}

function isAiChatProvider(value: unknown): value is AiChatProvider {
  return value === "openai" || value === "gemini" || value === "claude";
}

function isContentSuggestion(value: unknown): value is ContentSuggestion {
  if (!value || typeof value !== "object") return false;
  const row = value as Record<string, unknown>;
  return (
    typeof row.title === "string" &&
    typeof row.caption === "string" &&
    typeof row.cta === "string" &&
    typeof row.hashtags === "string" &&
    (row.theme === null || typeof row.theme === "string") &&
    typeof row.locucao === "string" &&
    typeof row.locucaoHook === "string" &&
    typeof row.locucaoBody === "string" &&
    typeof row.locucaoCta === "string" &&
    typeof row.roteiro === "string"
  );
}

function readPersistedAssistantState(contentId: string): PersistedAssistantState | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(assistantStorageKey(contentId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<PersistedAssistantState>;
    return {
      open: Boolean(parsed.open),
      prompt: typeof parsed.prompt === "string" ? parsed.prompt : "",
      selectedLibraryAssetIds: Array.isArray(parsed.selectedLibraryAssetIds)
        ? parsed.selectedLibraryAssetIds.filter((id): id is string => typeof id === "string")
        : [],
      transcription: typeof parsed.transcription === "string" ? parsed.transcription : "",
      webSearch: Boolean(parsed.webSearch),
      refineInstruction:
        typeof parsed.refineInstruction === "string" ? parsed.refineInstruction : "",
      draft: isContentSuggestion(parsed.draft) ? parsed.draft : null,
      provider: isAiChatProvider(parsed.provider) ? parsed.provider : "openai",
      appliedOnce: Boolean(parsed.appliedOnce),
    };
  } catch {
    return null;
  }
}

function writePersistedAssistantState(contentId: string, state: PersistedAssistantState) {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(assistantStorageKey(contentId), JSON.stringify(state));
  } catch {
    // Ignore quota / private-mode failures; UI still works in-memory.
  }
}

function clearPersistedAssistantState(contentId: string) {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.removeItem(assistantStorageKey(contentId));
  } catch {
    // ignore
  }
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
  onClearAppliedFields,
}: ContentAiAssistantProps) {
  const { t, i18n } = useTranslation();
  const [hydrated] = useState(() => readPersistedAssistantState(contentId));
  const [open, setOpen] = useState(() => Boolean(hydrated?.open || hydrated?.draft));
  const [prompt, setPrompt] = useState(() => hydrated?.prompt ?? "");
  const [selectedLibraryAssetIds, setSelectedLibraryAssetIds] = useState<string[]>(
    () => hydrated?.selectedLibraryAssetIds ?? [],
  );
  const [transcription, setTranscription] = useState(() => hydrated?.transcription ?? "");
  const [webSearch, setWebSearch] = useState(() => Boolean(hydrated?.webSearch));
  const [refineInstruction, setRefineInstruction] = useState(
    () => hydrated?.refineInstruction ?? "",
  );
  const [draft, setDraft] = useState<ContentSuggestion | null>(() => hydrated?.draft ?? null);
  const [provider, setProvider] = useState<AiChatProvider>(() => hydrated?.provider ?? "openai");
  const [appliedOnce, setAppliedOnce] = useState(() => Boolean(hydrated?.appliedOnce));
  const [resetDialogOpen, setResetDialogOpen] = useState(false);
  const generatingRef = useRef(false);
  const didInitProvider = useRef(Boolean(hydrated?.provider));

  const keysQuery = useQuery({
    queryKey: ["admin-ai-keys"],
    queryFn: getAdminAiKeysStatus,
  });
  const openaiConfigured = Boolean(keysQuery.data?.openaiConfigured);
  const geminiConfigured = Boolean(keysQuery.data?.geminiConfigured);
  const claudeConfigured = Boolean(keysQuery.data?.claudeConfigured);
  const selectedKeyConfigured =
    provider === "gemini"
      ? geminiConfigured
      : provider === "claude"
        ? claudeConfigured
        : openaiConfigured;
  const blockForMissingKey = !keysQuery.isLoading && !keysQuery.isError && !selectedKeyConfigured;

  useEffect(() => {
    if (didInitProvider.current || keysQuery.isLoading || keysQuery.isError) return;
    didInitProvider.current = true;
    if (!openaiConfigured && geminiConfigured) setProvider("gemini");
    else if (!openaiConfigured && !geminiConfigured && claudeConfigured) setProvider("claude");
  }, [keysQuery.isLoading, keysQuery.isError, openaiConfigured, geminiConfigured, claudeConfigured]);

  // Keep draft/prompt until Discard / Start over — remounts (nav, role flicker) must not wipe it.
  useEffect(() => {
    const hasWork =
      Boolean(prompt.trim()) ||
      selectedLibraryAssetIds.length > 0 ||
      Boolean(transcription.trim()) ||
      webSearch ||
      Boolean(refineInstruction.trim()) ||
      draft !== null ||
      appliedOnce;

    if (!hasWork) {
      clearPersistedAssistantState(contentId);
      return;
    }

    writePersistedAssistantState(contentId, {
      open,
      prompt,
      selectedLibraryAssetIds,
      transcription,
      webSearch,
      refineInstruction,
      draft,
      provider,
      appliedOnce,
    });
  }, [
    contentId,
    open,
    prompt,
    selectedLibraryAssetIds,
    transcription,
    webSearch,
    refineInstruction,
    draft,
    provider,
    appliedOnce,
  ]);

  const needsLocucao = format === "reels" || format === "recorded_video" || format === "youtube_short";
  const needsRoteiro = format === "carousel";

  const applySuggestion = (suggestion: ContentSuggestion) => {
    const next = withLocucaoParts(suggestion);
    setDraft(next);
    setOpen(true);
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
        libraryAssetIds: selectedLibraryAssetIds,
        transcription,
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
        libraryAssetIds: selectedLibraryAssetIds,
        transcription,
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
    setAppliedOnce(true);
    toast.success(t("project.detail.assistant.applied"));
  };

  const handleDiscard = () => {
    setDraft(null);
    setRefineInstruction("");
  };

  const resetAssistantState = () => {
    setPrompt("");
    setSelectedLibraryAssetIds([]);
    setTranscription("");
    setWebSearch(false);
    setRefineInstruction("");
    setDraft(null);
    clearPersistedAssistantState(contentId);
  };

  const canReset =
    Boolean(prompt.trim()) ||
    selectedLibraryAssetIds.length > 0 ||
    Boolean(transcription.trim()) ||
    webSearch ||
    Boolean(refineInstruction.trim()) ||
    draft !== null ||
    appliedOnce;

  const finishReset = async (clearForm: boolean) => {
    resetAssistantState();
    setAppliedOnce(false);
    setResetDialogOpen(false);
    clearPersistedAssistantState(contentId);
    if (clearForm && onClearAppliedFields) {
      await onClearAppliedFields();
      toast.success(t("project.detail.assistant.resetClearedWithForm"));
      return;
    }
    toast.success(t("project.detail.assistant.resetCleared"));
  };

  const handleStartOverClick = () => {
    if (appliedOnce && onClearAppliedFields) {
      setResetDialogOpen(true);
      return;
    }
    void finishReset(false);
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
                onValueChange={(value) => setProvider(value as AiChatProvider)}
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
                  <SelectItem value="claude">
                    {t("project.detail.assistant.providerClaude")}
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
                    : provider === "claude"
                      ? t("project.detail.assistant.missingClaudeTitle")
                      : t("project.detail.assistant.platformKeyTitle")}
                </AlertTitle>
                <AlertDescription className="space-y-2">
                  <p>
                    {provider === "gemini"
                      ? t("project.detail.assistant.missingGeminiBody")
                      : provider === "claude"
                        ? t("project.detail.assistant.missingClaudeBody")
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
            <ContentAiReferencesField
              clientId={clientId}
              selectedIds={selectedLibraryAssetIds}
              onChange={setSelectedLibraryAssetIds}
              disabled={busy}
            />
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

            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                onClick={() => {
                  if (generatingRef.current || !prompt.trim() || busy) return;
                  if (blockForMissingKey) {
                    toast.error(
                      provider === "gemini"
                        ? t("project.detail.assistant.missingGeminiError")
                        : provider === "claude"
                          ? t("project.detail.assistant.missingClaudeError")
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
              {canReset ? (
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleStartOverClick}
                  disabled={busy}
                >
                  <RotateCcw className="size-4" />
                  {t("project.detail.assistant.startOver")}
                </Button>
              ) : null}
            </div>

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
                <p className="text-xs text-muted-foreground">
                  {t("project.detail.assistant.discardHint")}
                </p>
              </div>
            ) : null}
          </CardContent>
        </CollapsibleContent>
      </Card>

      <AlertDialog open={resetDialogOpen} onOpenChange={setResetDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("project.detail.assistant.resetTitle")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("project.detail.assistant.resetDescriptionApplied")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-col gap-2 sm:flex-col sm:space-x-0">
            <AlertDialogAction
              onClick={(event) => {
                event.preventDefault();
                void finishReset(true);
              }}
            >
              {t("project.detail.assistant.resetWithForm")}
            </AlertDialogAction>
            <Button
              type="button"
              variant="outline"
              onClick={() => void finishReset(false)}
            >
              {t("project.detail.assistant.resetAssistantOnly")}
            </Button>
            <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Collapsible>
  );
}
