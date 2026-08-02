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
  formats = CONTENT_FORMATS,
  disabled = false,
  className,
  onValueChange,
}: {
  format: ContentFormat;
  formats?: ContentFormat[];
  disabled?: boolean;
  className?: string;
  onValueChange: (value: ContentFormat) => void;
}) {
  const { t } = useTranslation();
  const options = formats.length > 0 ? formats : CONTENT_FORMATS;
  const label = t(`project.detail.formats.${format}`);

  if (disabled) {
    return (
      <span
        className={cn(
          "inline-flex h-8 w-full min-w-0 max-w-full items-center overflow-hidden truncate rounded-md border px-3 text-xs font-medium shadow-sm",
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
          "h-8 w-full min-w-0 border text-xs font-medium shadow-sm focus:ring-1 disabled:opacity-100 [&>span]:min-w-0 [&>span]:truncate [&>svg]:shrink-0",
          contentFormatStyles[format],
          className,
        )}
      >
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {options.map((formatKey) => (
          <SelectItem key={formatKey} value={formatKey}>
            <span
              className={cn(
                "inline-flex items-center rounded-md border px-2 py-0.5 text-[11px] font-medium",
                contentFormatStyles[formatKey],
              )}
            >
              {t(`project.detail.formats.${formatKey}`)}
            </span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
