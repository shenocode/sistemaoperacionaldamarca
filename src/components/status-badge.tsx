import { useTranslation } from "react-i18next";
import type { SitePrototypeStatus } from "@/lib/api";
import { cn } from "@/lib/utils";

export type ContentStatus =
  | "draft"
  | "waiting_material"
  | "review"
  | "approved"
  | "changes"
  | "changes_done"
  | "published";

export type { SitePrototypeStatus };

/** Statuses where the client can approve or request new adjustments. */
export function isClientActionableStatus(
  status: string | null | undefined,
): boolean {
  return status === "review" || status === "changes_done";
}

/**
 * Visual styles for content workflow status.
 * Color gradient (red → green): waiting_material → draft → review → changes →
 * changes_done → approved → published.
 * Darker fills use white text for contrast; mid yellow/lime keep dark text.
 */
export const contentStatusStyles: Record<ContentStatus, string> = {
  waiting_material:
    "border-red-600 bg-red-600 text-white hover:bg-red-600/90",
  draft:
    "border-orange-500 bg-orange-500 text-white hover:bg-orange-500/90",
  review:
    "border-amber-400 bg-amber-400 text-amber-950 hover:bg-amber-400/90",
  changes:
    "border-lime-500 bg-lime-500 text-lime-950 hover:bg-lime-500/90",
  changes_done:
    "border-sky-500 bg-sky-500 text-white hover:bg-sky-500/90",
  approved:
    "border-emerald-500 bg-emerald-500 text-white hover:bg-emerald-500/90",
  published:
    "border-green-600 bg-green-600 text-white hover:bg-green-600/90",
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
          ? "h-8 max-w-full truncate rounded-md px-3 text-xs shadow-sm"
          : "max-w-full truncate rounded-full px-2.5 py-0.5 text-xs",
        contentStatusStyles[status],
        className,
      )}
    >
      {t(`project.content.status.${status}`)}
    </span>
  );
}

export const prototypeStatusStyles: Record<SitePrototypeStatus, string> = {
  review: contentStatusStyles.review,
  changes: contentStatusStyles.changes,
  changes_done: contentStatusStyles.changes_done,
  approved: contentStatusStyles.approved,
};

export function PrototypeStatusBadge({
  status,
  className,
  asButton = false,
}: {
  status: SitePrototypeStatus;
  className?: string;
  asButton?: boolean;
}) {
  const { t } = useTranslation();
  return (
    <span
      className={cn(
        "inline-flex items-center justify-center border font-medium",
        asButton
          ? "h-8 max-w-full truncate rounded-md px-3 text-xs shadow-sm"
          : "max-w-full truncate rounded-full px-2.5 py-0.5 text-xs",
        prototypeStatusStyles[status],
        className,
      )}
    >
      {t(`project.site.prototype.status.${status}`)}
    </span>
  );
}
