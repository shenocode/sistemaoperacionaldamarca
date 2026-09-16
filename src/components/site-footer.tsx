import { useTranslation } from "react-i18next";
import { Link } from "@tanstack/react-router";
import {
  COMPANY_NAME,
  COMPANY_URL,
  CONTACT_WHATSAPP,
  CONTACT_WHATSAPP_DISPLAY,
} from "@/lib/company";
import { SomLogo } from "@/components/som-logo";
import { cn } from "@/lib/utils";

type SiteFooterProps = {
  className?: string;
};

export function SiteFooter({ className }: SiteFooterProps) {
  const { t } = useTranslation();

  return (
    <footer
      className={cn("border-t border-neutral-900/10 bg-white px-4 py-12 sm:px-6", className)}
    >
      <div className="mx-auto flex max-w-6xl flex-col gap-8 sm:flex-row sm:items-start sm:justify-between">
        <SomLogo
          size="md"
          title={t("app.fullName")}
          className="h-28 sm:h-32"
          linkClassName="inline-block focus-visible:ring-neutral-900/30"
        />
        <div className="flex flex-col gap-1 text-sm text-neutral-500 sm:items-end sm:text-right">
          <a
            href={COMPANY_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="font-medium tracking-wide text-neutral-900 underline-offset-4 hover:underline"
          >
            {COMPANY_NAME}
          </a>
          <a
            href={`https://wa.me/${CONTACT_WHATSAPP}`}
            target="_blank"
            rel="noopener noreferrer"
            className="underline-offset-4 hover:underline"
          >
            {t("landing.footerWhatsapp", { number: CONTACT_WHATSAPP_DISPLAY })}
          </a>
          <Link
            to="/recursos"
            className="underline-offset-4 hover:underline"
          >
            {t("landing.footerResources")}
          </Link>
          <Link
            to="/termos"
            className="underline-offset-4 hover:underline"
          >
            {t("landing.footerTerms")}
          </Link>
          <Link
            to="/privacidade"
            className="underline-offset-4 hover:underline"
          >
            {t("landing.footerPrivacy")}
          </Link>
        </div>
      </div>
    </footer>
  );
}
