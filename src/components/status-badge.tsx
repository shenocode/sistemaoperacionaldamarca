import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";

export type ContentStatus =
  | "draft"
  | "waiting_material"
  | "review"
  | "approved"
  | "changes"
  | "published";

/** Visual styles for content workflow status (production → review → approved). */
export const contentStatusStyles: Record<ContentStatus, string> = {
  draft: "border-slate-200 bg-slate-100 text-slate-700 hover:bg-slate-100/90",
  waiting_material: "border-orange-200 bg-orange-100 text-orange-900 hover:bg-orange-100/90",
  review: "border-amber-200 bg-amber-100 text-amber-900 hover:bg-amber-100/90",
  approved: "border-emerald-200 bg-emerald-100 text-emerald-900 hover:bg-emerald-100/90",
  changes: "border-rose-200 bg-rose-100 text-rose-900 hover:bg-rose-100/90",
  published: "border-primary/20 bg-primary/10 text-primary hover:bg-primary/15",
};

export function StatusBadge({
  status,
  className,
  asButton = false,
}: {
  status: ContentStatus;
  className?: string;
  /** Renders as a compact button chip (for tables / cards). */
  asButton?: boolean;
}) {
  const { t } = useTranslation();
  return (
    <span
      className={cn(
        "inline-flex items-center justify-center border font-medium",
        asButton
          ? "h-8 rounded-md px-3 text-xs shadow-sm"
          : "rounded-full px-2.5 py-0.5 text-xs",
        contentStatusStyles[status],
        className,
      )}
    >
      {t(`project.content.status.${status}`)}
    </span>
  );
}
