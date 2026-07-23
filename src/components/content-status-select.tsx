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
    return <StatusBadge status={status} asButton className={className} />;
  }

  return (
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
          "h-8 w-auto min-w-[10.5rem] gap-1.5 border px-3 text-xs font-medium shadow-sm focus:ring-1",
          contentStatusStyles[status],
          className,
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
  );
}
