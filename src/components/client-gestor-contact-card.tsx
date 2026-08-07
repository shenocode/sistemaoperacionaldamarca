import { useQuery } from "@tanstack/react-query";
import { ExternalLink } from "lucide-react";
import { useTranslation } from "react-i18next";
import { getMyGestorContact, websiteHref } from "@/lib/api";

function whatsappHref(whatsapp: string | null | undefined): string | null {
  if (!whatsapp?.trim()) return null;
  const digits = whatsapp.replace(/\D/g, "");
  if (digits.length < 8) return null;
  return `https://wa.me/${digits}`;
}

export function ClientGestorContactCard({ clientId }: { clientId: string }) {
  const { t } = useTranslation();

  const gestorQuery = useQuery({
    queryKey: ["client-gestor-contact", clientId],
    queryFn: () => getMyGestorContact(clientId),
    enabled: Boolean(clientId),
  });

  const gestor = gestorQuery.data;
  const whatsappUrl = whatsappHref(gestor?.whatsapp);
  const siteUrl = websiteHref(gestor?.website);
  const hasAnyContact = Boolean(
    gestor?.fullName || gestor?.email || gestor?.whatsapp || gestor?.website,
  );

  return (
    <section className="space-y-3 rounded-xl border px-4 py-4">
      <div className="space-y-1">
        <p className="text-sm font-medium">{t("clientSettings.gestorCardTitle")}</p>
        <p className="text-xs text-muted-foreground">{t("clientSettings.gestorCardSubtitle")}</p>
      </div>

      {gestorQuery.isLoading ? (
        <p className="text-sm text-muted-foreground">{t("common.loading")}</p>
      ) : gestorQuery.isError ? (
        <p className="text-sm text-destructive">
          {(gestorQuery.error as Error).message || t("clientSettings.gestorCardLoadError")}
        </p>
      ) : !gestor || !hasAnyContact ? (
        <p className="text-sm text-muted-foreground">{t("clientSettings.gestorCardEmpty")}</p>
      ) : (
        <dl className="space-y-3 text-sm">
          <div className="space-y-0.5">
            <dt className="text-xs text-muted-foreground">{t("clientSettings.gestorName")}</dt>
            <dd className="font-medium text-foreground">
              {gestor.fullName?.trim() || t("clientSettings.gestorMissingValue")}
            </dd>
          </div>

          <div className="space-y-0.5">
            <dt className="text-xs text-muted-foreground">{t("clientSettings.gestorEmail")}</dt>
            <dd>
              {gestor.email ? (
                <a
                  href={`mailto:${gestor.email}`}
                  className="font-medium text-foreground underline-offset-2 hover:underline"
                >
                  {gestor.email}
                </a>
              ) : (
                <span className="text-muted-foreground">{t("clientSettings.gestorMissingValue")}</span>
              )}
            </dd>
          </div>

          <div className="space-y-0.5">
            <dt className="text-xs text-muted-foreground">{t("clientSettings.gestorWhatsapp")}</dt>
            <dd>
              {whatsappUrl ? (
                <a
                  href={whatsappUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 font-medium text-foreground underline-offset-2 hover:underline"
                >
                  {gestor.whatsapp}
                  <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
                  <span className="sr-only">{t("clientSettings.gestorOpenWhatsapp")}</span>
                </a>
              ) : (
                <span className="text-muted-foreground">{t("clientSettings.gestorMissingValue")}</span>
              )}
            </dd>
          </div>

          <div className="space-y-0.5">
            <dt className="text-xs text-muted-foreground">{t("clientSettings.gestorWebsite")}</dt>
            <dd>
              {siteUrl ? (
                <a
                  href={siteUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 break-all font-medium text-foreground underline-offset-2 hover:underline"
                >
                  {gestor.website}
                  <ExternalLink className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                  <span className="sr-only">{t("clientSettings.gestorOpenWebsite")}</span>
                </a>
              ) : (
                <span className="text-muted-foreground">{t("clientSettings.gestorMissingValue")}</span>
              )}
            </dd>
          </div>
        </dl>
      )}
    </section>
  );
}
