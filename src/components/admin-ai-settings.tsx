import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ExternalLink, KeyRound } from "lucide-react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { PageHeader } from "@/components/page-header";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { getAdminAiKeysStatus, saveAdminAiKeys } from "@/lib/api";

type ClearTarget = "openai" | "gemini" | "claude";

export function AdminAiSettingsPage() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [openaiKey, setOpenaiKey] = useState("");
  const [geminiKey, setGeminiKey] = useState("");
  const [claudeKey, setClaudeKey] = useState("");

  const statusQuery = useQuery({
    queryKey: ["admin-ai-keys"],
    queryFn: getAdminAiKeysStatus,
  });

  const status = statusQuery.data;

  const saveMutation = useMutation({
    mutationFn: () =>
      saveAdminAiKeys({
        openaiKey: openaiKey.trim() || undefined,
        geminiKey: geminiKey.trim() || undefined,
        claudeKey: claudeKey.trim() || undefined,
      }),
    onSuccess: () => {
      setOpenaiKey("");
      setGeminiKey("");
      setClaudeKey("");
      queryClient.invalidateQueries({ queryKey: ["admin-ai-keys"] });
      toast.success(t("adminAiSettings.saved"));
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const clearMutation = useMutation({
    mutationFn: (target: ClearTarget) =>
      saveAdminAiKeys(
        target === "openai"
          ? { clearOpenAI: true }
          : target === "gemini"
            ? { clearGemini: true }
            : { clearClaude: true },
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-ai-keys"] });
      toast.success(t("adminAiSettings.cleared"));
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const canSave = Boolean(openaiKey.trim() || geminiKey.trim() || claudeKey.trim());

  return (
    <div className="mx-auto max-w-lg space-y-6 px-4 py-6 sm:px-6 sm:py-8 md:p-8">
      <PageHeader title={t("adminAiSettings.title")} description={t("adminAiSettings.subtitle")} />

      <Alert>
        <KeyRound className="h-4 w-4" />
        <AlertTitle>{t("adminAiSettings.billingTitle")}</AlertTitle>
        <AlertDescription>{t("adminAiSettings.billingBody")}</AlertDescription>
      </Alert>

      {statusQuery.isLoading ? (
        <p className="text-sm text-muted-foreground">{t("common.loading")}</p>
      ) : null}

      {statusQuery.isError ? (
        <p className="text-sm text-destructive">
          {(statusQuery.error as Error).message || t("adminAiSettings.loadError")}
        </p>
      ) : null}

      {!statusQuery.isLoading ? (
        <form
          className="space-y-6"
          onSubmit={(e) => {
            e.preventDefault();
            if (!canSave) return;
            saveMutation.mutate();
          }}
        >
          <div className="space-y-3">
            <div className="flex items-start justify-between gap-3">
              <div className="space-y-1">
                <Label htmlFor="admin-openai-key">{t("adminAiSettings.openaiLabel")}</Label>
                <p className="text-xs text-muted-foreground">
                  {status?.openaiConfigured
                    ? t("adminAiSettings.configured", { last4: status.openaiLast4 })
                    : t("adminAiSettings.notConfigured")}
                </p>
              </div>
              <a
                href={status?.openaiHelpUrl || "https://platform.openai.com/api-keys"}
                target="_blank"
                rel="noreferrer"
                className="inline-flex shrink-0 items-center gap-1 text-xs text-primary hover:underline"
              >
                {t("adminAiSettings.howToGet")}
                <ExternalLink className="h-3 w-3" />
              </a>
            </div>
            <Input
              id="admin-openai-key"
              type="password"
              autoComplete="off"
              placeholder={
                status?.openaiConfigured
                  ? t("adminAiSettings.replacePlaceholder")
                  : "sk-..."
              }
              value={openaiKey}
              onChange={(e) => setOpenaiKey(e.target.value)}
            />
            {status?.openaiConfigured ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-8 px-0 text-destructive hover:text-destructive"
                disabled={clearMutation.isPending}
                onClick={() => clearMutation.mutate("openai")}
              >
                {t("adminAiSettings.clear")}
              </Button>
            ) : null}
          </div>

          <Separator />

          <div className="space-y-3">
            <div className="flex items-start justify-between gap-3">
              <div className="space-y-1">
                <Label htmlFor="admin-gemini-key">{t("adminAiSettings.geminiLabel")}</Label>
                <p className="text-xs text-muted-foreground">
                  {status?.geminiConfigured
                    ? t("adminAiSettings.configured", { last4: status.geminiLast4 })
                    : t("adminAiSettings.notConfigured")}
                </p>
              </div>
              <a
                href={status?.geminiHelpUrl || "https://aistudio.google.com/apikey"}
                target="_blank"
                rel="noreferrer"
                className="inline-flex shrink-0 items-center gap-1 text-xs text-primary hover:underline"
              >
                {t("adminAiSettings.howToGet")}
                <ExternalLink className="h-3 w-3" />
              </a>
            </div>
            <Input
              id="admin-gemini-key"
              type="password"
              autoComplete="off"
              placeholder={
                status?.geminiConfigured
                  ? t("adminAiSettings.replacePlaceholder")
                  : "AIza..."
              }
              value={geminiKey}
              onChange={(e) => setGeminiKey(e.target.value)}
            />
            {status?.geminiConfigured ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-8 px-0 text-destructive hover:text-destructive"
                disabled={clearMutation.isPending}
                onClick={() => clearMutation.mutate("gemini")}
              >
                {t("adminAiSettings.clear")}
              </Button>
            ) : null}
          </div>

          <Separator />

          <div className="space-y-3">
            <div className="flex items-start justify-between gap-3">
              <div className="space-y-1">
                <Label htmlFor="admin-claude-key">{t("adminAiSettings.claudeLabel")}</Label>
                <p className="text-xs text-muted-foreground">
                  {status?.claudeConfigured
                    ? t("adminAiSettings.configured", { last4: status.claudeLast4 })
                    : t("adminAiSettings.notConfigured")}
                </p>
              </div>
              <a
                href={status?.claudeHelpUrl || "https://console.anthropic.com/settings/keys"}
                target="_blank"
                rel="noreferrer"
                className="inline-flex shrink-0 items-center gap-1 text-xs text-primary hover:underline"
              >
                {t("adminAiSettings.howToGet")}
                <ExternalLink className="h-3 w-3" />
              </a>
            </div>
            <Input
              id="admin-claude-key"
              type="password"
              autoComplete="off"
              placeholder={
                status?.claudeConfigured
                  ? t("adminAiSettings.replacePlaceholder")
                  : "sk-ant-..."
              }
              value={claudeKey}
              onChange={(e) => setClaudeKey(e.target.value)}
            />
            {status?.claudeConfigured ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-8 px-0 text-destructive hover:text-destructive"
                disabled={clearMutation.isPending}
                onClick={() => clearMutation.mutate("claude")}
              >
                {t("adminAiSettings.clear")}
              </Button>
            ) : null}
          </div>

          <Button type="submit" disabled={saveMutation.isPending || !canSave}>
            {saveMutation.isPending ? t("common.saving") : t("common.save")}
          </Button>
        </form>
      ) : null}
    </div>
  );
}
