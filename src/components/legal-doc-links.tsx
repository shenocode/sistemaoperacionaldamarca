import { Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";

type LegalDocLinksProps = {
  className?: string;
};

export function LegalDocLinks({ className }: LegalDocLinksProps) {
  const { t } = useTranslation();
  return (
    <p className={cn("text-sm text-muted-foreground", className)}>
      <Link
        to="/termos"
        className="font-medium text-foreground underline-offset-2 hover:underline"
      >
        {t("landing.footerTerms")}
      </Link>
      <span aria-hidden="true"> · </span>
      <Link
        to="/privacidade"
        className="font-medium text-foreground underline-offset-2 hover:underline"
      >
        {t("landing.footerPrivacy")}
      </Link>
    </p>
  );
}
