import { useTranslation } from "react-i18next";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { contentFormatStyles } from "@/components/content-format-styles";
import { CONTENT_FORMATS, type ContentFormat } from "@/lib/api";
import { cn } from "@/lib/utils";

export function ContentFormatSelect({
  format,
  disabled = false,
  className,
  onValueChange,
}: {
  format: ContentFormat;
  disabled?: boolean;
  className?: string;
  onValueChange: (value: ContentFormat) => void;
}) {
  const { t } = useTranslation();
  const label = t(`project.detail.formats.${format}`);

  if (disabled) {
    return (
      <span
        className={cn(
          "inline-flex h-8 w-[9.5rem] items-center rounded-md border px-3 text-xs font-medium shadow-sm",
          contentFormatStyles[format],
          className,
        )}
      >
        {label}
      </span>
    );
  }

  return (
    <Select
      value={format}
      onValueChange={(value) => {
        onValueChange(value as ContentFormat);
      }}
    >
      <SelectTrigger
        aria-label={t("project.calendar.columns.format")}
        className={cn(
          "h-8 w-[9.5rem] border text-xs font-medium shadow-sm focus:ring-1 disabled:opacity-100",
          contentFormatStyles[format],
          className,
        )}
      >
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {CONTENT_FORMATS.map((formatKey) => (
          <SelectItem key={formatKey} value={formatKey}>
            <span className="inline-flex items-center gap-2">
              <span
                className={cn(
                  "h-2.5 w-2.5 shrink-0 rounded-full border",
                  contentFormatStyles[formatKey],
                )}
                aria-hidden="true"
              />
              {t(`project.detail.formats.${formatKey}`)}
            </span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
