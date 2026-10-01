import { useEffect } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { SiteBriefingForm } from "@/components/site-briefing-form";
import {
  buildSiteBriefingUrl,
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
} from "@/lib/api";

export type BriefingSearch = {
  access?: string;
};

export function validateBriefingSearch(search: Record<string, unknown>): BriefingSearch {
  const result: BriefingSearch = {};
  if (typeof search.access === "string" && search.access.length > 0) {
    result.access = search.access;
  }
  return result;
}

export const Route = createFileRoute(
  "/_authenticated/clients/$clientId/projects/$projectId/briefing 3",
)({
  validateSearch: validateBriefingSearch,
  beforeLoad: async ({ search }) => {
    if (!search.access) return;
    try {
      await claimClientAccess(search.access);
    } catch {
      // Already a member, admin, or stale token — page/RLS decide access.
    }
  },
  head: () => ({
    meta: [{ title: "Briefing — SOM" }, { name: "robots", content: "noindex" }],
  }),
  component: ProjectSiteBriefingPage,
});

function ProjectSiteBriefingPage() {
  const { clientId, projectId } = Route.useParams();
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const uiLocale = normalizeAppLocale(i18n.resolvedLanguage ?? i18n.language);

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

  function handleShare() {
    const client = clientQuery.data;
    const project = projectQuery.data;
    if (!client || !project) return;
    if (!client.access_token) {
      toast.error(t("clients.accessTokenMissing"));
      return;
    }
    const link = buildSiteBriefingUrl(client.id, project.id, client.access_token);
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
    const message = t("project.site.briefing.shareWhatsapp", {
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
    toast.success(t("project.site.briefing.shareOpened"));
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

  return (
    <SiteBriefingForm
      projectId={projectId}
      site={siteQuery.data}
      canManage={Boolean(manageQuery.data)}
      onShare={handleShare}
    />
  );
}
