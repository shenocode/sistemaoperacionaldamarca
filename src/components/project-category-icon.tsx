import { Clapperboard, Globe, Instagram, Palette, type LucideIcon } from "lucide-react";
import type { ProjectCategory } from "@/lib/api";
import { cn } from "@/lib/utils";

export const PROJECT_CATEGORY_ICONS: Record<ProjectCategory, LucideIcon> = {
  instagram: Instagram,
  graphic_arts: Palette,
  videos: Clapperboard,
  site: Globe,
};

const PROJECT_CATEGORY_TONES: Record<ProjectCategory, string> = {
  instagram: "bg-pink-500/10 text-pink-600 dark:text-pink-400",
  graphic_arts: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  videos: "bg-violet-500/10 text-violet-600 dark:text-violet-400",
  site: "bg-sky-500/10 text-sky-600 dark:text-sky-400",
};

const SIZES = {
  sm: { wrap: "h-8 w-8 rounded-md", icon: "h-4 w-4" },
  md: { wrap: "h-10 w-10 rounded-lg", icon: "h-5 w-5" },
} as const;

export function ProjectCategoryIcon({
  category,
  className,
  size = "md",
}: {
  category: ProjectCategory;
  className?: string;
  size?: keyof typeof SIZES;
}) {
  const Icon = PROJECT_CATEGORY_ICONS[category];
  const dims = SIZES[size];

  return (
    <div
      className={cn(
        "flex shrink-0 items-center justify-center",
        dims.wrap,
        PROJECT_CATEGORY_TONES[category],
        className,
      )}
    >
      <Icon className={dims.icon} aria-hidden="true" />
    </div>
  );
}
