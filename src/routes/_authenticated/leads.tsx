import { createFileRoute, redirect } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { isAdminMasterEmail } from "@/lib/admin-master";
import {
  isAdmin,
  listContactLeads,
  resolvePostLoginPath,
  type ContactLeadNiche,
} from "@/lib/api";
import { CONTACT_CALENDAR_URL, CONTACT_VIDEO_URL } from "@/lib/contact-links";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/empty-state";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/_authenticated/leads")({
  beforeLoad: async () => {
    if (!(await isAdmin())) {
      const dest = await resolvePostLoginPath();
      if (dest.to === "/clients/$clientId/projects/$projectId/feed") {
        throw redirect({ to: dest.to, params: dest.params, search: dest.search });
      }
      throw redirect({ to: dest.to });
    }

    const { data } = await supabase.auth.getUser();
    if (!isAdminMasterEmail(data.user?.email)) {
      throw redirect({ to: "/dashboard" });
    }
  },
  head: () => ({
    meta: [
      { title: "Leads — SOM" },
      { name: "description", content: "Leads do formulário de contato da landing." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: ContactLeadsPage,
});

function nicheLabelKey(niche: ContactLeadNiche) {
  if (niche === "agency") return "leads.nicheAgency";
  if (niche === "social_media") return "leads.nicheSocialMedia";
  return "leads.nicheBrandOwner";
}

function ContactLeadsPage() {
  const { t, i18n } = useTranslation();

  const leadsQuery = useQuery({
    queryKey: ["contact-leads"],
    queryFn: listContactLeads,
  });

  const formatDate = (iso: string) => {
    try {
      return new Intl.DateTimeFormat(i18n.language, {
        dateStyle: "short",
        timeStyle: "short",
      }).format(new Date(iso));
    } catch {
      return iso;
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader title={t("leads.title")} description={t("leads.subtitle")} />

      <section className="space-y-3 rounded-md border bg-card/40 p-4">
        <div>
          <h2 className="text-sm font-semibold tracking-tight">{t("leads.linksTitle")}</h2>
          <p className="mt-1 text-sm text-muted-foreground">{t("leads.linksSubtitle")}</p>
        </div>
        <dl className="space-y-3 text-sm">
          <div className="space-y-1">
            <dt className="font-medium text-muted-foreground">{t("leads.linksCalendar")}</dt>
            <dd>
              {CONTACT_CALENDAR_URL ? (
                <a
                  className="break-all underline-offset-2 hover:underline"
                  href={CONTACT_CALENDAR_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {CONTACT_CALENDAR_URL}
                </a>
              ) : (
                <span className="text-muted-foreground">{t("leads.linksMissing")}</span>
              )}
            </dd>
            <p className="text-xs text-muted-foreground">{t("leads.linksCalHint")}</p>
          </div>
          <div className="space-y-1">
            <dt className="font-medium text-muted-foreground">{t("leads.linksVideo")}</dt>
            <dd>
              {CONTACT_VIDEO_URL ? (
                <a
                  className="break-all underline-offset-2 hover:underline"
                  href={CONTACT_VIDEO_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {CONTACT_VIDEO_URL}
                </a>
              ) : (
                <span className="text-muted-foreground">{t("leads.linksMissing")}</span>
              )}
            </dd>
          </div>
        </dl>
      </section>

      {leadsQuery.isError ? (
        <p className="text-sm text-destructive">{t("leads.loadError")}</p>
      ) : null}

      {leadsQuery.isLoading ? (
        <p className="text-sm text-muted-foreground">{t("common.loading")}</p>
      ) : !leadsQuery.data?.length ? (
        <EmptyState title={t("leads.empty")} />
      ) : (
        <div className="overflow-x-auto rounded-md border">
          <table className="w-full min-w-[44rem] text-left text-sm">
            <thead className="border-b bg-muted/40 text-muted-foreground">
              <tr>
                <th className="px-3 py-2 font-medium">{t("leads.date")}</th>
                <th className="px-3 py-2 font-medium">{t("leads.name")}</th>
                <th className="px-3 py-2 font-medium">{t("leads.email")}</th>
                <th className="px-3 py-2 font-medium">{t("leads.whatsapp")}</th>
                <th className="px-3 py-2 font-medium">{t("leads.niche")}</th>
                <th className="px-3 py-2 font-medium">{t("leads.intent")}</th>
              </tr>
            </thead>
            <tbody>
              {leadsQuery.data.map((lead) => (
                <tr key={lead.id} className="border-b last:border-0">
                  <td className="whitespace-nowrap px-3 py-2 text-muted-foreground">
                    {formatDate(lead.createdAt)}
                  </td>
                  <td className="px-3 py-2 font-medium">{lead.name}</td>
                  <td className="px-3 py-2">
                    <a className="underline-offset-2 hover:underline" href={`mailto:${lead.email}`}>
                      {lead.email}
                    </a>
                  </td>
                  <td className="px-3 py-2">
                    <a
                      className="underline-offset-2 hover:underline"
                      href={`https://wa.me/${lead.whatsapp}`}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      {lead.whatsapp}
                    </a>
                  </td>
                  <td className="px-3 py-2">
                    <Badge variant="outline">{t(nicheLabelKey(lead.niche))}</Badge>
                  </td>
                  <td className="px-3 py-2">
                    <Badge variant="secondary">
                      {lead.intent === "trial"
                        ? t("leads.intentTrial")
                        : t("leads.intentHuman")}
                    </Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
