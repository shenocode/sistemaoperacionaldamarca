import { useEffect, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { ExternalLink, Loader2, RefreshCw, Share2 } from "lucide-react";
import { toast } from "sonner";
import { SitePrototypeMockup } from "@/components/site-prototype-mockup";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  buildSitePrototypeUrl,
  buildWhatsAppNotifyUrl,
  canManageClient,
  claimClientAccess,
  ensureProjectSite,
  getClient,
  getLocalizedText,
  getPrimaryProjectCategory,
  getProject,
  normalizeAppLocale,
  parseRowI18n,
  projectDefaultRoute,
  updateProjectSitePrototypeUrl,
  updateSitePrototypeFeedback,
} from "@/lib/api";

export type PrototypeSearch = {
  access?: string;
};

export function validatePrototypeSearch(search: Record<string, unknown>): PrototypeSearch {
  const result: PrototypeSearch = {};
  if (typeof search.access === "string" && search.access.length > 0) {
    result.access = search.access;
  }
  return result;
}

export const Route = createFileRoute(
  "/_authenticated/clients/$clientId/projects/$projectId/prototype",
)({
  validateSearch: validatePrototypeSearch,
  beforeLoad: async ({ search }) => {
    if (!search.access) return;
    try {
      await claimClientAccess(search.access);
    } catch {
      // Already a member, admin, or stale token — page/RLS decide access.
    }
  },
  head: () => ({
    meta: [{ title: "Protótipo — SOM" }, { name: "robots", content: "noindex" }],
  }),
  component: ProjectPrototypePage,
});

function ProjectPrototypePage() {
  const { clientId, projectId } = Route.useParams();
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const uiLocale = normalizeAppLocale(i18n.resolvedLanguage ?? i18n.language);
  const [urlDraft, setUrlDraft] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);
  const [notesDraft, setNotesDraft] = useState("");
  const [requestsDraft, setRequestsDraft] = useState("");

  const projectQuery = useQuery({
    queryKey: ["projects", "detail", projectId],
    queryFn: () => getProject(projectId),
  });

  const clientQuery = useQuery({
    queryKey: ["clients", clientId],
    queryFn: () => getClient(clientId),
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
    if (!siteQuery.data) return;
    setUrlDraft(siteQuery.data.prototype_url ?? "");
    setNotesDraft(siteQuery.data.prototype_notes ?? "");
    setRequestsDraft(siteQuery.data.prototype_change_requests ?? "");
  }, [
    siteQuery.data?.prototype_url,
    siteQuery.data?.prototype_notes,
    siteQuery.data?.prototype_change_requests,
    siteQuery.dataUpdatedAt,
  ]);

  const saveMutation = useMutation({
    mutationFn: () =>
      updateProjectSitePrototypeUrl({
        projectId,
        prototypeUrl: urlDraft.trim() || null,
      }),
    onSuccess: (data) => {
      queryClient.setQueryData(["project-site", projectId], data);
      toast.success(t("project.site.prototype.saved"));
      setRefreshKey((key) => key + 1);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const feedbackMutation = useMutation({
    mutationFn: (input: { prototypeNotes?: string; prototypeChangeRequests?: string }) =>
      updateSitePrototypeFeedback({ projectId, ...input }),
    onSuccess: (data, variables) => {
      queryClient.setQueryData(["project-site", projectId], data);
      if (variables.prototypeNotes !== undefined) {
        toast.success(t("project.site.prototype.notesSaved"));
      }
      if (variables.prototypeChangeRequests !== undefined) {
        toast.success(t("project.site.prototype.changeRequestsSaved"));
      }
    },
    onError: (err: Error) => toast.error(err.message),
  });

  function handleShare() {
    const client = clientQuery.data;
    const project = projectQuery.data;
    if (!client || !project) return;
    if (!client.access_token) {
      toast.error(t("clients.accessTokenMissing"));
      return;
    }
    const link = buildSitePrototypeUrl(client.id, project.id, client.access_token);
    const projectName = getLocalizedText(
      parseRowI18n(project.i18n),
      "name",
      project.name,
      uiLocale,
    );
    const clientName = getLocalizedText(
      parseRowI18n(client.i18n),
      "name",
      client.name,
      uiLocale,
    );
    const message = t("project.site.prototype.shareWhatsapp", {
      project: projectName,
      client: clientName,
      link,
    });
    const url = buildWhatsAppNotifyUrl(client.whatsapp, message);
    if (!url) {
      toast.error(t("clients.whatsappMissing"));
      return;
    }
    window.open(url, "_blank", "noopener,noreferrer");
    toast.success(t("project.site.prototype.shareOpened"));
  }

  const prototypeUrl = siteQuery.data?.prototype_url ?? null;

  if (projectQuery.isLoading || (isSite && siteQuery.isLoading)) {
    return <p className="text-sm text-muted-foreground">{t("common.loading")}</p>;
  }

  if (!isSite) {
    return <p className="text-sm text-muted-foreground">{t("common.loading")}</p>;
  }

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h2 className="text-base font-medium">{t("project.site.prototype.title")}</h2>
        <p className="text-sm text-muted-foreground">{t("project.site.prototype.hint")}</p>
      </div>

      {canManage ? (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="min-w-0 flex-1 space-y-2">
            <Label htmlFor="prototype-url">{t("project.site.prototype.urlLabel")}</Label>
            <Input
              id="prototype-url"
              type="url"
              value={urlDraft}
              onChange={(e) => setUrlDraft(e.target.value)}
              placeholder={t("project.site.prototype.urlPlaceholder")}
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              onClick={() => saveMutation.mutate()}
              disabled={saveMutation.isPending}
            >
              {saveMutation.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
              ) : null}
              {t("project.site.prototype.save")}
            </Button>
            <Button type="button" variant="outline" onClick={handleShare}>
              <Share2 className="mr-2 h-4 w-4" aria-hidden="true" />
              {t("project.site.prototype.share")}
            </Button>
            {prototypeUrl ? (
              <>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setRefreshKey((key) => key + 1)}
                >
                  <RefreshCw className="mr-2 h-4 w-4" aria-hidden="true" />
                  {t("project.site.prototype.refresh")}
                </Button>
                <Button type="button" variant="outline" asChild>
                  <a href={prototypeUrl} target="_blank" rel="noreferrer">
                    <ExternalLink className="mr-2 h-4 w-4" aria-hidden="true" />
                    {t("project.site.prototype.openExternal")}
                  </a>
                </Button>
              </>
            ) : null}
          </div>
        </div>
      ) : prototypeUrl ? (
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" onClick={() => setRefreshKey((key) => key + 1)}>
            <RefreshCw className="mr-2 h-4 w-4" aria-hidden="true" />
            {t("project.site.prototype.refresh")}
          </Button>
          <Button type="button" variant="outline" asChild>
            <a href={prototypeUrl} target="_blank" rel="noreferrer">
              <ExternalLink className="mr-2 h-4 w-4" aria-hidden="true" />
              {t("project.site.prototype.openExternal")}
            </a>
          </Button>
        </div>
      ) : null}

      <SitePrototypeMockup
        url={prototypeUrl}
        refreshKey={refreshKey}
        emptyLabel={t("project.site.prototype.empty")}
        iframeTitle={t("project.site.prototype.iframeTitle")}
      />

      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2 rounded-lg border p-4">
          <Label htmlFor="prototype-notes">{t("project.site.prototype.notes")}</Label>
          <p className="text-xs text-muted-foreground">{t("project.site.prototype.notesHint")}</p>
          {canManage ? (
            <Textarea
              id="prototype-notes"
              value={notesDraft}
              rows={5}
              placeholder={t("project.site.prototype.notesPlaceholder")}
              onChange={(e) => setNotesDraft(e.target.value)}
              onBlur={() => {
                if ((siteQuery.data?.prototype_notes ?? "") !== notesDraft) {
                  feedbackMutation.mutate({ prototypeNotes: notesDraft });
                }
              }}
            />
          ) : (
            <p className="whitespace-pre-wrap text-sm text-foreground">
              {notesDraft.trim() || t("project.site.schedule.emptyCell")}
            </p>
          )}
        </div>

        <div className="space-y-2 rounded-lg border p-4">
          <Label htmlFor="prototype-requests">{t("project.site.prototype.changeRequests")}</Label>
          <p className="text-xs text-muted-foreground">
            {t("project.site.prototype.changeRequestsHint")}
          </p>
          <Textarea
            id="prototype-requests"
            value={requestsDraft}
            rows={5}
            placeholder={t("project.site.prototype.changeRequestsPlaceholder")}
            onChange={(e) => setRequestsDraft(e.target.value)}
            onBlur={() => {
              if ((siteQuery.data?.prototype_change_requests ?? "") !== requestsDraft) {
                feedbackMutation.mutate({ prototypeChangeRequests: requestsDraft });
              }
            }}
          />
        </div>
      </div>

      {feedbackMutation.isPending ? (
        <p className="inline-flex items-center gap-1 text-xs text-muted-foreground">
          <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" />
          {t("project.site.prototype.feedbackSaving")}
        </p>
      ) : null}
    </div>
  );
}
