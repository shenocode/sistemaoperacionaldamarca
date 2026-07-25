import { useEffect, useMemo, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { InstagramFeedMockup } from "@/components/instagram-feed-mockup";
import {
  canManageClient,
  claimClientAccess,
  getClient,
  getProject,
  listContent,
  projectCategoryConfig,
  projectDefaultRoute,
  reorderContentItems,
  type ContentItem,
} from "@/lib/api";

export type FeedSearch = {
  access?: string;
};

export function validateFeedSearch(search: Record<string, unknown>): FeedSearch {
  const result: FeedSearch = {};
  if (typeof search.access === "string" && search.access.length > 0) {
    result.access = search.access;
  }
  return result;
}

function sortByManualOrder(a: ContentItem, b: ContentItem) {
  const aOrder = a.sort_order ?? 0;
  const bOrder = b.sort_order ?? 0;
  if (aOrder !== bOrder) return aOrder - bOrder;
  return a.title.localeCompare(b.title);
}

export const Route = createFileRoute("/_authenticated/clients/$clientId/projects/$projectId/feed")({
  validateSearch: validateFeedSearch,
  beforeLoad: async ({ search }) => {
    if (!search.access) return;
    try {
      await claimClientAccess(search.access);
    } catch {
      // Already a member, admin, or stale token — page/RLS decide access.
    }
  },
  component: ProjectFeedPage,
});

function ProjectFeedPage() {
  const { clientId, projectId } = Route.useParams();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [localRows, setLocalRows] = useState<ContentItem[] | null>(null);

  const projectQuery = useQuery({
    queryKey: ["projects", "detail", projectId],
    queryFn: () => getProject(projectId),
  });

  const contentQuery = useQuery({
    queryKey: ["content", projectId],
    queryFn: () => listContent(projectId),
  });

  const clientQuery = useQuery({
    queryKey: ["clients", clientId],
    queryFn: () => getClient(clientId),
  });

  const manageQuery = useQuery({
    queryKey: ["can-manage", clientId],
    queryFn: () => canManageClient(clientId),
  });

  const categoryConfig = projectCategoryConfig(projectQuery.data?.categories);
  const feedAvailable = categoryConfig.tabs.includes("feed");

  useEffect(() => {
    if (!projectQuery.data || feedAvailable) return;
    const { to } = projectDefaultRoute(projectQuery.data.categories);
    void navigate({
      to,
      params: { clientId, projectId },
      replace: true,
      ...(to === "/clients/$clientId/projects/$projectId/content" ? { search: {} } : {}),
    });
  }, [projectQuery.data, feedAvailable, navigate, clientId, projectId]);

  const canEdit = Boolean(manageQuery.data);
  const serverRows = useMemo(
    () => [...(contentQuery.data ?? [])].sort(sortByManualOrder),
    [contentQuery.data],
  );
  const rows = localRows ?? serverRows;
  const canReorder = canEdit && rows.length > 1;

  useEffect(() => {
    setLocalRows(null);
  }, [contentQuery.dataUpdatedAt]);

  const reorderMutation = useMutation({
    mutationFn: reorderContentItems,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["content", projectId] });
    },
    onError: (err: Error) => {
      setLocalRows(null);
      toast.error(err.message);
    },
  });

  const applyReorder = (next: ContentItem[]) => {
    setLocalRows(next);
    reorderMutation.mutate(next.map((item, sort_order) => ({ id: item.id, sort_order })));
  };

  if (projectQuery.isLoading || contentQuery.isLoading) {
    return <p className="text-sm text-muted-foreground">{t("common.loading")}</p>;
  }

  if (!feedAvailable) {
    return <p className="text-sm text-muted-foreground">{t("common.loading")}</p>;
  }

  if (contentQuery.isError) {
    return (
      <p className="text-sm text-destructive">
        {contentQuery.error instanceof Error ? contentQuery.error.message : t("common.error")}
      </p>
    );
  }

  return (
    <div className="flex min-w-0 justify-center overflow-x-clip py-2">
      <InstagramFeedMockup
        items={rows}
        clientId={clientId}
        projectId={projectId}
        username={clientQuery.data?.name}
        avatarUrl={clientQuery.data?.logo_url}
        canReorder={canReorder}
        onReorder={applyReorder}
        showLabel={false}
      />
    </div>
  );
}
