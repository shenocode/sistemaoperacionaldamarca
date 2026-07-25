import { useTranslation } from "react-i18next";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { PROJECT_CATEGORIES, type ProjectCategory } from "@/lib/api";
import { cn } from "@/lib/utils";

export function ProjectCategoriesField({
  value,
  onChange,
  className,
  required = false,
}: {
  value: ProjectCategory | null;
  onChange: (next: ProjectCategory) => void;
  className?: string;
  required?: boolean;
}) {
  const { t } = useTranslation();

  return (
    <div className={cn("space-y-2", className)}>
      <div>
        <Label>
          {t("clients.projectCategories")}
          {required ? " *" : null}
        </Label>
        <p className="text-xs text-muted-foreground">{t("clients.projectCategoriesHint")}</p>
      </div>
      <RadioGroup
        value={value ?? undefined}
        onValueChange={(next) => onChange(next as ProjectCategory)}
        className="gap-2"
        required={required}
      >
        {PROJECT_CATEGORIES.map((category) => {
          const id = `project-category-${category}`;
          const checked = value === category;

          return (
            <label
              key={category}
              htmlFor={id}
              className={cn(
                "flex cursor-pointer gap-3 rounded-lg border p-3 transition-colors",
                checked ? "border-primary/40 bg-primary/5" : "hover:bg-muted/40",
              )}
            >
              <RadioGroupItem id={id} value={category} className="mt-0.5" />
              <span className="min-w-0 space-y-0.5">
                <span className="block text-sm font-medium leading-none">
                  {t(`clients.categories.${category}.label`)}
                </span>
                <span className="block text-xs text-muted-foreground">
                  {t(`clients.categories.${category}.formats`)}
                </span>
              </span>
            </label>
          );
        })}
      </RadioGroup>
    </div>
  );
}
