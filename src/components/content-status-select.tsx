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
import { setContentStatus } from "@/lib/api";
import { cn } from "@/lib/utils";

export const CONTENT_STATUSES: ContentStatus[] = [
  "draft",
  "waiting_material",
  "review",
  "approved",
  "changes",
  "published",
];

function ContentStatusLink({
  status,
  contentId,
  clientId,
  projectId,
  className,
}: {
  status: ContentStatus;
  contentId: string;
  clientId: string;
  projectId: string;
  className?: string;
}) {
  const { t } = useTranslation();

  return (
    <Link
      to="/clients/$clientId/projects/$projectId/content/$contentId"
      params={{ clientId, projectId, contentId }}
      search={{}}
      className={cn(
        "inline-flex max-w-full rounded-md outline-none transition-opacity hover:opacity-90 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1",
        className,
      )}
      title={t("project.calendar.openStatus")}
      aria-label={t("project.calendar.openStatus")}
    >
      <StatusBadge
        status={status}
        asButton
        className="pointer-events-none w-full max-w-full"
      />
    </Link>
  );
}

export function ContentStatusSelect({
  status,
  contentId,
  clientId,
  projectId,
  title,
  disabled = false,
  className,
}: {
  status: ContentStatus;
  contentId: string;
  clientId: string;
  projectId: string;
  title: string;
  disabled?: boolean;
  className?: string;
}) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  const statusMutation = useMutation({
    mutationFn: (next: ContentStatus) =>
      setContentStatus({
        contentId,
        clientId,
        projectId,
        status: next,
        title,
      }),
    onSuccess: (_row, next) => {
      queryClient.invalidateQueries({ queryKey: ["content", projectId] });
      queryClient.invalidateQueries({ queryKey: ["content", "detail", contentId] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      if (next === "approved") toast.success(t("project.detail.approvedToast"));
      else if (next === "changes") toast.success(t("project.detail.changesToast"));
      else if (next === "review") toast.success(t("project.detail.submittedToast"));
      else if (next === "published") toast.success(t("project.detail.publishedToast"));
      else toast.success(t("project.content.statusUpdated"));
    },
    onError: (err: Error) => toast.error(err.message),
  });

  if (disabled) {
    return (
      <ContentStatusLink
        status={status}
        contentId={contentId}
        clientId={clientId}
        projectId={projectId}
        className={className}
      />
    );
  }

  return (
    <div className={cn("flex min-w-0 max-w-full items-center gap-1", className)}>
      <ContentStatusLink
        status={status}
        contentId={contentId}
        clientId={clientId}
        projectId={projectId}
        className="min-w-0 flex-1"
      />
      <Select
        value={status}
        disabled={statusMutation.isPending}
        onValueChange={(value) => {
          const next = value as ContentStatus;
          if (next === status) return;
          statusMutation.mutate(next);
        }}
      >
        <SelectTrigger
          aria-label={t("project.content.columns.status")}
          className={cn(
            "h-8 w-8 shrink-0 justify-center border px-0 shadow-sm focus:ring-1 [&>span]:sr-only",
            contentStatusStyles[status],
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
        </SelectContent>
      </Select>
    </div>
  );
}
