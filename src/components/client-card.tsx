import { Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { format, formatDistanceToNow } from "date-fns";
import { ptBR, enUS, es } from "date-fns/locale";
import { Flag, Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ProjectCategoryIcon } from "@/components/project-category-icon";
import { useUnreadClientUpdates } from "@/hooks/use-unread-client-updates";
import { getPrimaryProjectCategory, type ClientWithProjects } from "@/lib/api";
import { markClientUpdatesSeen } from "@/lib/client-updates-seen";
import { getLocalizedText, normalizeAppLocale } from "@/lib/i18n-content";
import type { LanguageCode } from "@/i18n";
import { cn } from "@/lib/utils";

const dateLocales = { "pt-BR": ptBR, "en-US": enUS, "es-ES": es };

export function ClientCard({
  client,
  onOpenSettings,
}: {
  client: ClientWithProjects;
  onOpenSettings: (client: ClientWithProjects) => void;
}) {
  const { t, i18n } = useTranslation();
  const locale = dateLocales[(i18n.language as LanguageCode) ?? "pt-BR"] ?? ptBR;
  const uiLocale = normalizeAppLocale(i18n.resolvedLanguage ?? i18n.language);
  const clientName = getLocalizedText(client.i18n, "name", client.name, uiLocale);
  const lastActivityAt = client.last_update_at ?? client.created_at;
  const lastUpdateLabel = client.last_update_at
    ? format(new Date(client.last_update_at), "dd/MM/yyyy", { locale })
    : null;
  const hasClientUpdates = useUnreadClientUpdates(client.id, client.client_updates_at);

  function acknowledgeClientUpdates() {
    markClientUpdatesSeen(client.id);
  }

  return (
    <Card
      className={cn(
        "relative rounded-xl transition-colors hover:bg-muted/40",
        hasClientUpdates && "ring-1 ring-sky-500/40",
      )}
    >
      <CardContent className="space-y-4 p-5">
        <div className="flex items-start justify-between gap-3 pr-8">
          <div className="flex min-w-0 items-start gap-3">
            {client.logo_url ? (
              <img
                src={client.logo_url}
                alt=""
                className="mt-0.5 h-10 w-10 shrink-0 rounded-full object-cover"
              />
            ) : null}
            <div className="min-w-0 space-y-1.5">
              <Link
                to="/clients/$clientId"
                params={{ clientId: client.id }}
                onClick={acknowledgeClientUpdates}
                className="block font-medium tracking-tight hover:underline"
              >
                {clientName}
              </Link>
              <p className="text-xs text-muted-foreground">
                {t("clients.updatedAgo", {
                  defaultValue: "Atualizado {{time}}",
                  time: formatDistanceToNow(new Date(lastActivityAt), {
                    addSuffix: true,
                    locale,
                  }),
                })}
              </p>
              {hasClientUpdates ? (
                <span className="inline-flex items-center gap-1 rounded-full border border-sky-600 bg-sky-600 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white">
                  <Flag className="h-3 w-3" aria-hidden="true" />
                  {t("clients.clientUpdates")}
                </span>
              ) : null}
            </div>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="absolute right-3 top-3 h-8 w-8 text-muted-foreground"
            aria-label={t("clients.settings")}
            onClick={() => onOpenSettings(client)}
          >
            <Settings className="h-4 w-4" aria-hidden="true" />
          </Button>
        </div>

        <div className="space-y-2">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {t("clients.lastUpdates")}
            {lastUpdateLabel ? ` (${lastUpdateLabel})` : ""}
          </p>

          {client.projects.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("clients.noProjects")}</p>
          ) : (
            <ul className="space-y-2">
              {client.projects.map((project) => (
                <li
                  key={project.id}
                  className="flex items-center justify-between gap-2 rounded-lg border border-border/60 bg-background/60 px-3 py-2"
                >
                  <span className="flex min-w-0 items-center gap-2">
                    <ProjectCategoryIcon
                      category={getPrimaryProjectCategory(project.categories)}
                      size="sm"
                    />
                    <span className="truncate text-sm">
                      {getLocalizedText(project.i18n, "name", project.name, uiLocale)}
                    </span>
                  </span>
                  <Button asChild size="sm" variant="secondary" className="shrink-0">
                    <Link
                      to="/clients/$clientId/projects/$projectId/calendar"
                      params={{ clientId: client.id, projectId: project.id }}
                      onClick={acknowledgeClientUpdates}
                    >
                      {t("clients.access")}
                    </Link>
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
