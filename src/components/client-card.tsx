import { Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { format, formatDistanceToNow } from "date-fns";
import { ptBR, enUS, es } from "date-fns/locale";
import { Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import type { ClientWithProjects } from "@/lib/api";
import type { LanguageCode } from "@/i18n";

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
  const lastUpdateLabel = client.last_update_at
    ? format(new Date(client.last_update_at), "dd/MM/yyyy", { locale })
    : null;

  return (
    <Card className="relative rounded-xl transition-colors hover:bg-muted/40">
      <CardContent className="space-y-4 p-5">
        <div className="flex items-start justify-between gap-3 pr-8">
          <div className="flex min-w-0 items-start gap-3">
            {client.logo_url ? (
              <img
                src={client.logo_url}
                alt=""
                className="mt-0.5 h-10 w-10 shrink-0 rounded-lg border object-cover bg-muted"
              />
            ) : null}
            <div className="min-w-0 space-y-1">
              <Link
                to="/clients/$clientId"
                params={{ clientId: client.id }}
                className="block font-medium tracking-tight hover:underline"
              >
                {client.name}
              </Link>
              <p className="text-xs text-muted-foreground">
                {formatDistanceToNow(new Date(client.created_at), {
                  addSuffix: true,
                  locale,
                })}
              </p>
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
                  <span className="truncate text-sm">{project.name}</span>
                  <Button asChild size="sm" variant="secondary" className="shrink-0">
                    <Link
                      to="/clients/$clientId/projects/$projectId/calendar"
                      params={{ clientId: client.id, projectId: project.id }}
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
