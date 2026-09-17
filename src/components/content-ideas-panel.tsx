import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
  calendarBlockMix,
  getAdminAiKeysStatus,
  suggestContentIdeas,
  updateCalendarBlockMix,
  type CalendarBlock,
  type ContentFormat,
  type ContentIdea,
  type ContentMix,
  type DesignProvider,
} from "@/lib/api";
import { DEFAULT_CONTENT_MIX, parseContentMix } from "@/lib/content-strategy";

type ContentIdeasPanelProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clientId: string;
  projectId: string;
  blocks: CalendarBlock[];
  allowedFormats: ContentFormat[];
  onAddIdea: (idea: ContentIdea, calendarBlockId: string | null) => Promise<void>;
};

export function ContentIdeasPanel({
  open,
  onOpenChange,
  clientId,
  projectId,
  blocks,
  allowedFormats,
  onAddIdea,
}: ContentIdeasPanelProps) {
  const { t, i18n } = useTranslation();
  const queryClient = useQueryClient();
  const [blockId, setBlockId] = useState("");
  const [mix, setMix] = useState<ContentMix>(DEFAULT_CONTENT_MIX);
  const [count, setCount] = useState("7");
  const [prompt, setPrompt] = useState("");
  const [webSearch, setWebSearch] = useState(false);
  const [provider, setProvider] = useState<DesignProvider>("openai");
  const [ideas, setIdeas] = useState<ContentIdea[]>([]);
  const [addingIndex, setAddingIndex] = useState<number | null>(null);

  const keysQuery = useQuery({
    queryKey: ["admin-ai-keys"],
    queryFn: getAdminAiKeysStatus,
    enabled: open,
  });
  const openaiConfigured = Boolean(keysQuery.data?.openaiConfigured);
  const geminiConfigured = Boolean(keysQuery.data?.geminiConfigured);
  const selectedKeyConfigured = provider === "gemini" ? geminiConfigured : openaiConfigured;

  useEffect(() => {
    if (!open) return;
    const last = blocks.at(-1);
    setBlockId((current) => current || last?.id || "");
    if (last) setMix(calendarBlockMix(last));
    if (!openaiConfigured && geminiConfigured) setProvider("gemini");
  }, [open, blocks, openaiConfigured, geminiConfigured]);

  const selectedBlock = blocks.find((block) => block.id === blockId) ?? null;

  const generateMutation = useMutation({
    mutationFn: () =>
      suggestContentIdeas({
        projectId,
        clientId,
        calendarBlockId: blockId || null,
        mix: parseContentMix(mix),
        count: Number(count) || 7,
        prompt,
        locale: i18n.resolvedLanguage ?? i18n.language,
        provider,
        webSearch,
        allowedFormats,
      }),
    onSuccess: (result) => {
      setIdeas(result.ideas);
      if (blockId) {
        void updateCalendarBlockMix(blockId, parseContentMix(mix)).then(() => {
          queryClient.invalidateQueries({ queryKey: ["calendar-blocks", projectId] });
        });
      }
      if (result.webSearchUnavailable) {
        toast.warning(t("project.detail.assistant.webSearchUnavailable"));
      }
      toast.success(t("project.calendar.ideas.generated", { count: result.ideas.length }));
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const setMixField = (key: keyof ContentMix, value: string) => {
    const n = Number(value);
    setMix((prev) => ({ ...prev, [key]: Number.isFinite(n) ? n : 0 }));
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (generateMutation.isPending || addingIndex !== null) return;
        onOpenChange(next);
        if (!next) {
          setIdeas([]);
          setPrompt("");
        }
      }}
    >
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{t("project.calendar.ideas.title")}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">{t("project.calendar.ideas.hint")}</p>
          {blocks.length > 0 ? (
            <div className="space-y-1.5">
              <Label>{t("project.calendar.selectPeriod")}</Label>
              <Select
                value={blockId}
                onValueChange={(value) => {
                  setBlockId(value);
                  const block = blocks.find((item) => item.id === value);
                  if (block) setMix(calendarBlockMix(block));
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder={t("project.calendar.selectPeriod")} />
                </SelectTrigger>
                <SelectContent>
                  {blocks.map((block) => (
                    <SelectItem key={block.id} value={block.id}>
                      {block.title.trim() || t("project.calendar.untitledPeriod")}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : null}
          <div className="grid grid-cols-3 gap-3">
            {(["tofu", "mofu", "bofu"] as const).map((stage) => (
              <div key={stage} className="space-y-1.5">
                <Label htmlFor={`mix-${stage}`}>{t(`project.funnel.${stage}`)}</Label>
                <Input
                  id={`mix-${stage}`}
                  type="number"
                  min={0}
                  max={100}
                  value={mix[stage]}
                  onChange={(e) => setMixField(stage, e.target.value)}
                />
                <p className="text-xs text-muted-foreground leading-snug">{t(`project.funnel.${stage}Hint`)}</p>
              </div>
            ))}
          </div>
          <p className="text-xs text-muted-foreground">{t("project.calendar.ideas.mixHint")}</p>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="ideas-count">{t("project.calendar.ideas.count")}</Label>
              <Input
                id="ideas-count"
                type="number"
                min={3}
                max={14}
                value={count}
                onChange={(e) => setCount(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label>{t("project.detail.assistant.provider")}</Label>
              <Select value={provider} onValueChange={(value) => setProvider(value as DesignProvider)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="openai">{t("project.detail.assistant.providerOpenAI")}</SelectItem>
                  <SelectItem value="gemini">{t("project.detail.assistant.providerGemini")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ideas-prompt">{t("project.calendar.ideas.prompt")}</Label>
            <Textarea
              id="ideas-prompt"
              rows={2}
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder={t("project.calendar.ideas.promptPlaceholder")}
            />
          </div>
          <label className="flex items-start gap-2 text-sm">
            <Checkbox
              checked={webSearch}
              onCheckedChange={(value) => setWebSearch(value === true)}
              className="mt-0.5"
            />
            <span>{t("project.detail.assistant.webSearch")}</span>
          </label>
          <Button
            type="button"
            onClick={() => generateMutation.mutate()}
            disabled={generateMutation.isPending || !selectedKeyConfigured}
          >
            {generateMutation.isPending ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                {t("project.calendar.ideas.generating")}
              </>
            ) : (
              <>
                <Sparkles className="size-4" />
                {t("project.calendar.ideas.generate")}
              </>
            )}
          </Button>
          {ideas.length > 0 ? (
            <ul className="space-y-3">
              {ideas.map((idea, index) => (
                <li key={`${idea.title}-${index}`} className="space-y-2 rounded-lg border p-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-medium">{idea.title}</p>
                    <span className="rounded-md border px-1.5 py-0.5 text-[11px]">
                      {t(`project.funnel.${idea.funnelStage}`)}
                    </span>
                    <span className="text-[11px] text-muted-foreground">
                      {t(`project.detail.formats.${idea.format}`)}
                    </span>
                  </div>
                  {idea.hook ? (
                    <p className="text-xs text-muted-foreground">
                      {t("project.detail.assistant.hook")}: {idea.hook}
                    </p>
                  ) : null}
                  {idea.why ? <p className="text-xs text-muted-foreground">{idea.why}</p> : null}
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    disabled={addingIndex !== null}
                    onClick={async () => {
                      setAddingIndex(index);
                      try {
                        await onAddIdea(idea, selectedBlock?.id ?? null);
                        setIdeas((prev) => prev.filter((_, itemIndex) => itemIndex !== index));
                        toast.success(t("project.calendar.ideas.added"));
                      } catch (err) {
                        toast.error(err instanceof Error ? err.message : t("common.error"));
                      } finally {
                        setAddingIndex(null);
                      }
                    }}
                  >
                    {addingIndex === index ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : null}
                    {t("project.calendar.ideas.add")}
                  </Button>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            {t("common.cancel")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
