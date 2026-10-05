import { Link } from "@tanstack/react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  StatusBadge,
  contentStatusStyles,
  type ContentStatus,
} from "@/components/status-badge";
import { archiveContent, restoreContent, setContentStatus } from "@/lib/api";
import { cn } from "@/lib/utils";

/** Workflow statuses persisted in content_items.status (not archived). */
export type WorkflowContentStatus = Exclude<ContentStatus, "archived">;

export const CONTENT_STATUSES: WorkflowContentStatus[] = [
  "draft",
  "waiting_material",
  "review",
  "changes",
  "changes_done",
  "approved",
  "published",
];

export function ContentStatusLink({
  status,
  contentId,
  clientId,
  projectId,
  className,
  asButton = true,
  badgeClassName,
}: {
  status: ContentStatus;
  contentId: string;
  clientId: string;
  projectId: string;
  className?: string;
  asButton?: boolean;
  badgeClassName?: string;
}) {
  const { t } = useTranslation();

  return (
    <Link
      to="/clients/$clientId/projects/$projectId/content/$contentId"
      params={{ clientId, projectId, contentId }}
      search={{}}
      className={cn(
        "inline-flex max-w-full cursor-pointer rounded-md outline-none transition-opacity hover:opacity-90 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1",
        className,
      )}
      title={t("project.calendar.openStatus")}
      aria-label={t("project.calendar.openStatus")}
    >
      <StatusBadge
        status={status}
        asButton={asButton}
        className={cn("pointer-events-none w-full max-w-full", badgeClassName)}
      />
    </Link>
  );
}

export function ContentStatusSelect({
  status,
  archived = false,
  contentId,
  clientId,
  projectId,
  title,
  disabled = false,
  className,
}: {
  status: WorkflowContentStatus;
  /** When true, shows "Arquivado" and moves item out of active calendar blocks. */
  archived?: boolean;
  contentId: string;
  clientId: string;
  projectId: string;
  title: string;
  disabled?: boolean;
  className?: string;
}) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const displayStatus: ContentStatus = archived ? "archived" : status;

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: ["content", projectId] });
    queryClient.invalidateQueries({ queryKey: ["content", "detail", contentId] });
    queryClient.invalidateQueries({ queryKey: ["dashboard"] });
  }

  const statusMutation = useMutation({
    mutationFn: async (next: ContentStatus) => {
      if (next === "archived") {
        if (archived) return;
        await archiveContent({ contentId, projectId });
        return "archived" as const;
      }
      if (archived) {
        await restoreContent({ contentId, projectId });
      }
      if (next !== status) {
        await setContentStatus({
          contentId,
          clientId,
          projectId,
          status: next,
          title,
        });
      }
      return next;
    },
    onSuccess: (next) => {
      invalidate();
      if (next === "archived") {
        toast.success(t("project.calendar.archived"));
        return;
      }
      if (archived && next === status) {
        toast.success(t("project.calendar.restored"));
        return;
      }
      if (next === "approved") toast.success(t("project.detail.approvedToast"));
      else if (next === "changes") toast.success(t("project.detail.changesToast"));
      else if (next === "changes_done")
        toast.success(t("project.detail.changesDoneToast"));
      else if (next === "review") toast.success(t("project.detail.submittedToast"));
      else if (next === "published") toast.success(t("project.detail.publishedToast"));
      else toast.success(t("project.content.statusUpdated"));
    },
    onError: (err: Error) => toast.error(err.message),
  });

  if (disabled) {
    return (
      <ContentStatusLink
        status={displayStatus}
        contentId={contentId}
        clientId={clientId}
        projectId={projectId}
        className={className}
      />
    );
  }

  return (
    <div className={cn("flex min-w-0 max-w-full items-stretch gap-1", className)}>
      <ContentStatusLink
        status={displayStatus}
        contentId={contentId}
        clientId={clientId}
        projectId={projectId}
        className="min-w-0 flex-1"
      />
      <Select
        value={displayStatus}
        disabled={statusMutation.isPending}
        onValueChange={(value) => {
          const next = value as ContentStatus;
          if (next === displayStatus) return;
          statusMutation.mutate(next);
        }}
      >
        <SelectTrigger
          aria-label={t("project.content.columns.status")}
          className={cn(
            "min-h-8 h-auto w-8 shrink-0 justify-center self-stretch border px-0 shadow-sm focus:ring-1 [&>span]:sr-only",
            contentStatusStyles[displayStatus],
          )}
        >
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {CONTENT_STATUSES.map((value) => (
            <SelectItem key={value} value={value}>
              {t(`project.content.status.${value}`)}
            </SelectItem>
          ))}
          <SelectItem value="archived">
            {archived
              ? t("project.content.status.archived")
              : t("project.calendar.archive")}
          </SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
}
