import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";

export type ContentStatus = "draft" | "review" | "approved" | "changes" | "published";

const styles: Record<ContentStatus, string> = {
  draft: "bg-muted text-muted-foreground",
  review: "bg-amber-100 text-amber-800",
  approved: "bg-emerald-100 text-emerald-800",
  changes: "bg-rose-100 text-rose-800",
  published: "bg-primary/10 text-primary",
};

export function StatusBadge({ status, className }: { status: ContentStatus; className?: string }) {
  const { t } = useTranslation();
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
        styles[status],
        className,
      )}
    >
      {t(`project.content.status.${status}`)}
    </span>
  );
}
