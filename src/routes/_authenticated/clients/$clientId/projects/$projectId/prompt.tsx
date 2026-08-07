import { useEffect, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Copy, Loader2, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  canManageClient,
  ensureProjectSite,
  generateSitePrd,
  getPrimaryProjectCategory,
  getProject,
  projectDefaultRoute,
  updateSitePrdMarkdown,
} from "@/lib/api";

export const Route = createFileRoute(
  "/_authenticated/clients/$clientId/projects/$projectId/prompt",
)({
  head: () => ({
    meta: [{ title: "Prompt (PRD) — SOM" }, { name: "robots", content: "noindex" }],
  }),
  component: ProjectSitePromptPage,
});

function ProjectSitePromptPage() {
  const { clientId, projectId } = Route.useParams();
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState("");

  const projectQuery = useQuery({
    queryKey: ["projects", "detail", projectId],
    queryFn: () => getProject(projectId),
  });

  const siteQuery = useQuery({
    queryKey: ["project-site", projectId],
    queryFn: () => ensureProjectSite(projectId),
    enabled: getPrimaryProjectCategory(projectQuery.data?.categories) === "site",
  });

  const manageQuery = useQuery({
    queryKey: ["can-manage", clientId],
    queryFn: () => canManageClient(clientId),
  });

  const isSite = getPrimaryProjectCategory(projectQuery.data?.categories) === "site";
  const canManage = Boolean(manageQuery.data);

  useEffect(() => {
    if (!projectQuery.data || isSite) return;
    const { to } = projectDefaultRoute(projectQuery.data.categories);
    void navigate({
      to,
      params: { clientId, projectId },
      replace: true,
      ...(to === "/clients/$clientId/projects/$projectId/content" ? { search: {} } : {}),
    });
  }, [projectQuery.data, isSite, navigate, clientId, projectId]);

  useEffect(() => {
    if (siteQuery.data) {
      setDraft(siteQuery.data.prd_markdown ?? "");
    }
  }, [siteQuery.data?.prd_markdown, siteQuery.dataUpdatedAt]);

  const generateMutation = useMutation({
    mutationFn: () => generateSitePrd(projectId, i18n.resolvedLanguage ?? i18n.language),
    onSuccess: (data) => {
      queryClient.setQueryData(["project-site", projectId], data);
      setDraft(data.prd_markdown ?? "");
      toast.success(t("project.site.prompt.generated"));
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const saveMutation = useMutation({
    mutationFn: () => updateSitePrdMarkdown({ projectId, prdMarkdown: draft }),
    onSuccess: (data) => {
      queryClient.setQueryData(["project-site", projectId], data);
      toast.success(t("project.site.prompt.saved"));
    },
    onError: (err: Error) => toast.error(err.message),
  });

  function handleGenerate() {
    if ((siteQuery.data?.answeredCount ?? 0) === 0) {
      toast.error(t("project.site.prompt.needBriefing"));
      return;
    }
    if (siteQuery.data?.prd_markdown?.trim()) {
      const ok = window.confirm(t("project.site.prompt.regenerateConfirm"));
      if (!ok) return;
    }
    generateMutation.mutate();
  }

  async function handleCopy() {
    const text = draft.trim();
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      toast.success(t("project.site.prompt.copied"));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("common.error"));
    }
  }

  if (projectQuery.isLoading || (isSite && siteQuery.isLoading)) {
    return <p className="text-sm text-muted-foreground">{t("common.loading")}</p>;
  }

  if (!isSite) {
    return <p className="text-sm text-muted-foreground">{t("common.loading")}</p>;
  }

  if (siteQuery.isError || !siteQuery.data) {
    return (
      <p className="text-sm text-destructive">
        {siteQuery.error instanceof Error ? siteQuery.error.message : t("common.error")}
      </p>
    );
  }

  const generatedAt = siteQuery.data.prd_generated_at;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <h2 className="text-base font-medium">{t("project.site.prompt.title")}</h2>
          <p className="text-sm text-muted-foreground">{t("project.site.prompt.hint")}</p>
          {generatedAt ? (
            <p className="text-xs text-muted-foreground">
              {t("project.site.prompt.updatedAt", {
                date: new Date(generatedAt).toLocaleString(i18n.resolvedLanguage ?? i18n.language),
              })}
            </p>
          ) : null}
        </div>
        <div className="flex flex-wrap gap-2">
          {canManage ? (
            <Button
              type="button"
              onClick={handleGenerate}
              disabled={generateMutation.isPending}
            >
              {generateMutation.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
              ) : (
                <Sparkles className="mr-2 h-4 w-4" aria-hidden="true" />
              )}
              {siteQuery.data.prd_markdown
                ? t("project.site.prompt.regenerate")
                : t("project.site.prompt.generate")}
            </Button>
          ) : null}
          <Button type="button" variant="outline" onClick={() => void handleCopy()} disabled={!draft.trim()}>
            <Copy className="mr-2 h-4 w-4" aria-hidden="true" />
            {t("project.site.prompt.copy")}
          </Button>
          {canManage ? (
            <Button
              type="button"
              variant="outline"
              onClick={() => saveMutation.mutate()}
              disabled={saveMutation.isPending || draft === (siteQuery.data.prd_markdown ?? "")}
            >
              {saveMutation.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
              ) : null}
              {t("project.site.prompt.save")}
            </Button>
          ) : null}
        </div>
      </div>

      {!draft.trim() && !generateMutation.isPending ? (
        <p className="text-sm text-muted-foreground">{t("project.site.prompt.empty")}</p>
      ) : null}

      <Textarea
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        rows={22}
        readOnly={!canManage}
        className="min-h-[28rem] font-mono text-sm"
        placeholder={
          generateMutation.isPending
            ? t("project.site.prompt.generating")
            : t("project.site.prompt.empty")
        }
      />
    </div>
  );
}
