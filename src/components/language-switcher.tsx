import { useTranslation } from "react-i18next";
import { SUPPORTED_LANGUAGES } from "@/i18n";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

const SHORT_LABEL: Record<string, string> = {
  "pt-BR": "PT",
  "en-US": "EN",
  "es-ES": "ES",
};

export function LanguageSwitcher({ className }: { className?: string }) {
  const { i18n, t } = useTranslation();
  const resolved = i18n.resolvedLanguage ?? i18n.language;
  const short = SHORT_LABEL[resolved] ?? resolved.slice(0, 2).toUpperCase();
  const full = SUPPORTED_LANGUAGES.find((lang) => lang.code === resolved)?.label ?? short;

  return (
    <Select value={resolved} onValueChange={(v) => i18n.changeLanguage(v)}>
      <SelectTrigger
        className={cn("h-9 w-[4.75rem] max-w-full px-2 sm:w-[160px] sm:px-3", className)}
        aria-label={t("common.language")}
      >
        <span className="truncate">
          <span className="sm:hidden">{short}</span>
          <span className="hidden sm:inline">{full}</span>
        </span>
      </SelectTrigger>
      <SelectContent>
        {SUPPORTED_LANGUAGES.map((lang) => (
          <SelectItem key={lang.code} value={lang.code}>
            {lang.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
