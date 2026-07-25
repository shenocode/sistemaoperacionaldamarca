import { useTranslation } from "react-i18next";
import {
  COMPANY_NAME,
  COMPANY_URL,
  CONTACT_WHATSAPP,
  CONTACT_WHATSAPP_DISPLAY,
} from "@/lib/company";
import { cn } from "@/lib/utils";

type SiteFooterProps = {
  variant?: "landing" | "app";
  className?: string;
};

export function SiteFooter({ variant = "landing", className }: SiteFooterProps) {
  const { t } = useTranslation();
  const isApp = variant === "app";

  return (
    <footer
      className={cn(
        "border-t",
        isApp
          ? "mt-auto border-border bg-background px-4 py-4 md:px-6"
          : "border-neutral-900/8 bg-white/60 px-6 py-8",
        className,
      )}
    >
      <div
        className={cn(
          "flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between",
          !isApp && "mx-auto max-w-6xl gap-4",
        )}
      >
        {isApp ? (
          <a
            href={COMPANY_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm font-medium text-foreground underline-offset-4 hover:underline"
          >
            {COMPANY_NAME}
          </a>
        ) : (
          <div>
            <p className="font-display text-lg font-semibold">{t("app.name")}</p>
            <p className="text-sm text-neutral-600">{t("landing.footerTag")}</p>
          </div>
        )}
        <div
          className={cn(
            "flex flex-col gap-1 sm:items-end sm:text-right",
            isApp ? "text-xs text-muted-foreground" : "text-sm text-neutral-600",
          )}
        >
          {!isApp ? (
            <a
              href={COMPANY_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium text-neutral-800 underline-offset-4 hover:underline"
            >
              {COMPANY_NAME}
            </a>
          ) : null}
          <a
            href={`https://wa.me/${CONTACT_WHATSAPP}`}
            target="_blank"
            rel="noopener noreferrer"
            className="underline-offset-4 hover:underline"
          >
            {t("landing.footerWhatsapp", { number: CONTACT_WHATSAPP_DISPLAY })}
          </a>
        </div>
      </div>
    </footer>
  );
}
