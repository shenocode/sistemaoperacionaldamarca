import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { format } from "date-fns";
import { ptBR, enUS, es } from "date-fns/locale";
import { CalendarDays, Copy, ExternalLink, Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/empty-state";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { StatusBadge, type ContentStatus } from "@/components/status-badge";
import {
  CONTENT_FORMATS,
  addProjectThemePreset,
  canManageClient,
  duplicateContent,
  listContent,
  getProject,
  updateContentCalendar,
  type ContentFormat,
  type ContentItem,
} from "@/lib/api";
import type { LanguageCode } from "@/i18n";

const dateLocales = { "pt-BR": ptBR, "en-US": enUS, "es-ES": es };
const NONE_VALUE = "__none__";
const NEW_THEME_VALUE = "__new_theme__";

function toDatetimeLocalValue(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function fromDatetimeLocalValue(value: string): string | null {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
}

function sortBySchedule(a: ContentItem, b: ContentItem) {
  if (!a.scheduled_at && !b.scheduled_at) {
    return a.title.localeCompare(b.title);
  }
  if (!a.scheduled_at) return 1;
  if (!b.scheduled_at) return -1;
  return new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime();
}

export const Route = createFileRoute("/_authenticated/clients/$clientId/projects/$projectId/calendar")({
  component: ProjectCalendarPage,
});

function ProjectCalendarPage() {
  const { clientId, projectId } = Route.useParams();
  const { t, i18n } = useTranslation();
  const queryClient = useQueryClient();
  const [themeDialogContentId, setThemeDialogContentId] = useState<string | null>(null);
  const [newTheme, setNewTheme] = useState("");

  const locale = dateLocales[(i18n.language as LanguageCode) ?? "pt-BR"] ?? ptBR;

  const contentQuery = useQuery({
    queryKey: ["content", projectId],
    queryFn: () => listContent(projectId),
  });

  const projectQuery = useQuery({
    queryKey: ["projects", "detail", projectId],
    queryFn: () => getProject(projectId),
  });

  const manageQuery = useQuery({
    queryKey: ["can-manage", clientId],
    queryFn: () => canManageClient(clientId),
  });

  const canEdit = Boolean(manageQuery.data);
  const themePresets = projectQuery.data?.theme_presets ?? [];

  const rows = useMemo(
    () => [...(contentQuery.data ?? [])].sort(sortBySchedule),
    [contentQuery.data],
  );

  const updateMutation = useMutation({
    mutationFn: updateContentCalendar,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["content", projectId] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const addThemeMutation = useMutation({
    mutationFn: async ({ contentId, theme }: { contentId: string; theme: string }) => {
      await addProjectThemePreset(projectId, theme);
      return updateContentCalendar({ contentId, theme });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["content", projectId] });
      queryClient.invalidateQueries({ queryKey: ["projects", "detail", projectId] });
      setThemeDialogContentId(null);
      setNewTheme("");
      toast.success(t("project.calendar.themeAdded"));
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const duplicateMutation = useMutation({
    mutationFn: (contentId: string) =>
      duplicateContent({ contentId, clientId, projectId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["content", projectId] });
      toast.success(t("project.calendar.duplicated"));
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const themeOptions = useMemo(() => {
    const fromRows = rows.map((r) => r.theme?.trim()).filter(Boolean) as string[];
    return Array.from(new Set([...themePresets, ...fromRows])).sort((a, b) =>
      a.localeCompare(b, i18n.language),
    );
  }, [themePresets, rows, i18n.language]);

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-sm font-medium">{t("project.calendar.title")}</h2>
        <p className="text-xs text-muted-foreground">{t("project.calendar.hint")}</p>
      </div>

      {contentQuery.isLoading || projectQuery.isLoading ? (
        <p className="text-sm text-muted-foreground">{t("common.loading")}</p>
      ) : rows.length === 0 ? (
        <EmptyState icon={CalendarDays} title={t("project.calendar.empty")} />
      ) : (
        <Card className="overflow-hidden rounded-xl">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[920px] text-sm">
              <thead className="bg-muted/50 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-3 py-3">#</th>
                  <th className="px-3 py-3">{t("project.calendar.columns.day")}</th>
                  <th className="px-3 py-3">{t("project.calendar.columns.datetime")}</th>
                  <th className="px-3 py-3">{t("project.calendar.columns.status")}</th>
                  <th className="px-3 py-3">{t("project.calendar.columns.theme")}</th>
                  <th className="px-3 py-3">{t("project.calendar.columns.format")}</th>
                  <th className="px-3 py-3">{t("project.calendar.columns.title")}</th>
                  <th className="px-3 py-3 text-right">{t("project.calendar.columns.access")}</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {rows.map((row, index) => {
                  const scheduled = row.scheduled_at ? new Date(row.scheduled_at) : null;
                  const dayLabel =
                    scheduled && !Number.isNaN(scheduled.getTime())
                      ? format(scheduled, "EEEE", { locale })
                      : "—";
                  const isBusy = updateMutation.isPending || duplicateMutation.isPending;

                  return (
                    <tr key={row.id} className="hover:bg-muted/30">
                      <td className="px-3 py-2.5 text-muted-foreground">{index + 1}</td>
                      <td className="px-3 py-2.5 capitalize text-muted-foreground">{dayLabel}</td>
                      <td className="px-3 py-2.5">
                        <Input
                          type="datetime-local"
                          className="h-8 w-[11.5rem]"
                          value={toDatetimeLocalValue(row.scheduled_at)}
                          disabled={!canEdit || isBusy}
                          onChange={(e) => {
                            updateMutation.mutate({
                              contentId: row.id,
                              scheduledAt: fromDatetimeLocalValue(e.target.value),
                            });
                          }}
                        />
                      </td>
                      <td className="px-3 py-2.5">
                        <StatusBadge status={row.status as ContentStatus} />
                      </td>
                      <td className="px-3 py-2.5">
                        <Select
                          value={row.theme?.trim() || NONE_VALUE}
                          disabled={!canEdit || isBusy}
                          onValueChange={(value) => {
                            if (value === NEW_THEME_VALUE) {
                              setThemeDialogContentId(row.id);
                              setNewTheme("");
                              return;
                            }
                            updateMutation.mutate({
                              contentId: row.id,
                              theme: value === NONE_VALUE ? null : value,
                            });
                          }}
                        >
                          <SelectTrigger className="h-8 w-[10.5rem]">
                            <SelectValue placeholder={t("project.calendar.selectTheme")} />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value={NONE_VALUE}>{t("project.calendar.noTheme")}</SelectItem>
                            {themeOptions.map((theme) => (
                              <SelectItem key={theme} value={theme}>
                                {theme}
                              </SelectItem>
                            ))}
                            {canEdit ? (
                              <SelectItem value={NEW_THEME_VALUE}>
                                {t("project.calendar.newTheme")}
                              </SelectItem>
                            ) : null}
                          </SelectContent>
                        </Select>
                      </td>
                      <td className="px-3 py-2.5">
                        <Select
                          value={row.format ?? "static_feed"}
                          disabled={!canEdit || isBusy}
                          onValueChange={(value) => {
                            updateMutation.mutate({
                              contentId: row.id,
                              format: value as ContentFormat,
                            });
                          }}
                        >
                          <SelectTrigger className="h-8 w-[9.5rem]">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {CONTENT_FORMATS.map((formatKey) => (
                              <SelectItem key={formatKey} value={formatKey}>
                                {t(`project.detail.formats.${formatKey}`)}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </td>
                      <td className="px-3 py-2.5 font-medium">{row.title}</td>
                      <td className="px-3 py-2.5">
                        <div className="flex items-center justify-end gap-1.5">
                          {canEdit ? (
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              disabled={isBusy}
                              title={t("project.calendar.duplicateHint")}
                              onClick={() => duplicateMutation.mutate(row.id)}
                            >
                              <Copy className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" />
                              {t("project.calendar.duplicate")}
                            </Button>
                          ) : null}
                          <Button asChild variant="outline" size="sm">
                            <Link
                              to="/clients/$clientId/projects/$projectId/content/$contentId"
                              params={{ clientId, projectId, contentId: row.id }}
                              search={{}}
                            >
                              <ExternalLink className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" />
                              {t("project.calendar.access")}
                            </Link>
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      <Dialog
        open={Boolean(themeDialogContentId)}
        onOpenChange={(open) => {
          if (!open) {
            setThemeDialogContentId(null);
            setNewTheme("");
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("project.calendar.newThemeTitle")}</DialogTitle>
          </DialogHeader>
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              if (!themeDialogContentId || !newTheme.trim()) return;
              addThemeMutation.mutate({
                contentId: themeDialogContentId,
                theme: newTheme.trim(),
              });
            }}
          >
            <div className="space-y-1.5">
              <Label htmlFor="calendar-new-theme">{t("project.calendar.columns.theme")}</Label>
              <Input
                id="calendar-new-theme"
                value={newTheme}
                onChange={(e) => setNewTheme(e.target.value)}
                placeholder={t("project.calendar.themePlaceholder")}
                autoFocus
                required
              />
              <p className="text-xs text-muted-foreground">{t("project.calendar.newThemeHint")}</p>
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setThemeDialogContentId(null);
                  setNewTheme("");
                }}
              >
                {t("common.cancel")}
              </Button>
              <Button type="submit" disabled={addThemeMutation.isPending || !newTheme.trim()}>
                <Plus className="mr-1.5 h-4 w-4" aria-hidden="true" />
                {t("common.save")}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
