import { useEffect, useMemo, useState, type DragEvent } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { format } from "date-fns";
import { ptBR, enUS, es } from "date-fns/locale";
import { CalendarDays, Copy, ExternalLink, GripVertical, Plus, Trash2 } from "lucide-react";
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
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ContentStatusSelect } from "@/components/content-status-select";
import {
  contentFormatRowStyles,
  contentFormatStyles,
} from "@/components/content-format-styles";
import { InstagramFeedMockup } from "@/components/instagram-feed-mockup";
import type { ContentStatus } from "@/components/status-badge";
import {
  CONTENT_FORMATS,
  addProjectThemePreset,
  buildProjectReviewUrl,
  buildWhatsAppNotifyUrl,
  canManageClient,
  claimClientAccess,
  deleteContent,
  duplicateContent,
  getClient,
  listContent,
  getProject,
  reorderContentItems,
  updateContentCalendar,
  type ContentFormat,
  type ContentItem,
} from "@/lib/api";
import { cn } from "@/lib/utils";
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

function moveItem<T>(items: T[], from: number, to: number): T[] {
  if (from === to || from < 0 || to < 0 || from >= items.length || to >= items.length) {
    return items;
  }
  const next = [...items];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}

function sortByManualOrder(a: ContentItem, b: ContentItem) {
  const aOrder = a.sort_order ?? 0;
  const bOrder = b.sort_order ?? 0;
  if (aOrder !== bOrder) return aOrder - bOrder;
  return a.title.localeCompare(b.title);
}

function CalendarTitleCell({
  title,
  disabled,
  onSave,
}: {
  title: string;
  disabled: boolean;
  onSave: (title: string) => void;
}) {
  const [value, setValue] = useState(title);

  useEffect(() => {
    setValue(title);
  }, [title]);

  function commit() {
    const next = value.trim();
    if (!next || next === title) {
      setValue(title);
      return;
    }
    onSave(next);
  }

  return (
    <Input
      className="h-8 min-w-[12rem] font-medium"
      value={value}
      disabled={disabled}
      onChange={(e) => setValue(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          e.currentTarget.blur();
        }
        if (e.key === "Escape") {
          setValue(title);
          e.currentTarget.blur();
        }
      }}
    />
  );
}

export type CalendarSearch = {
  access?: string;
};

export function validateCalendarSearch(search: Record<string, unknown>): CalendarSearch {
  const result: CalendarSearch = {};
  if (typeof search.access === "string" && search.access.length > 0) {
    result.access = search.access;
  }
  return result;
}

export const Route = createFileRoute("/_authenticated/clients/$clientId/projects/$projectId/calendar")({
  validateSearch: validateCalendarSearch,
  beforeLoad: async ({ search }) => {
    if (!search.access) return;
    try {
      await claimClientAccess(search.access);
    } catch {
      // Already a member, admin, or stale token — page/RLS decide access.
    }
  },
  component: ProjectCalendarPage,
});

function ProjectCalendarPage() {
  const { clientId, projectId } = Route.useParams();
  const { t, i18n } = useTranslation();
  const queryClient = useQueryClient();
  const [themeDialogContentId, setThemeDialogContentId] = useState<string | null>(null);
  const [newTheme, setNewTheme] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; title: string } | null>(null);
  const [localRows, setLocalRows] = useState<ContentItem[] | null>(null);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [dropIndex, setDropIndex] = useState<number | null>(null);

  const locale = dateLocales[(i18n.language as LanguageCode) ?? "pt-BR"] ?? ptBR;

  const contentQuery = useQuery({
    queryKey: ["content", projectId],
    queryFn: () => listContent(projectId),
  });

  const projectQuery = useQuery({
    queryKey: ["projects", "detail", projectId],
    queryFn: () => getProject(projectId),
  });

  const clientQuery = useQuery({
    queryKey: ["clients", clientId],
    queryFn: () => getClient(clientId),
  });

  const manageQuery = useQuery({
    queryKey: ["can-manage", clientId],
    queryFn: () => canManageClient(clientId),
  });

  const canEdit = Boolean(manageQuery.data);
  const themePresets = projectQuery.data?.theme_presets ?? [];
  const serverRows = useMemo(
    () => [...(contentQuery.data ?? [])].sort(sortByManualOrder),
    [contentQuery.data],
  );
  const rows = localRows ?? serverRows;
  const canReorder = canEdit && rows.length > 1;

  useEffect(() => {
    setLocalRows(null);
  }, [contentQuery.dataUpdatedAt]);

  function handleSendUpdates() {
    const client = clientQuery.data;
    const project = projectQuery.data;
    if (!client || !project) return;

    if (!client.access_token) {
      toast.error(t("clients.accessTokenMissing"));
      return;
    }

    const link = buildProjectReviewUrl(client.id, project.id, client.access_token);
    const message = t("clients.whatsappMessage", {
      client: client.name,
      project: project.name,
      link,
    });
    const url = buildWhatsAppNotifyUrl(client.whatsapp, message);
    if (!url) {
      toast.error(t("clients.whatsappMissing"));
      return;
    }

    window.open(url, "_blank", "noopener,noreferrer");
    toast.success(t("clients.whatsappOpened"));
  }

  const updateMutation = useMutation({
    mutationFn: updateContentCalendar,
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["content", projectId] });
      queryClient.invalidateQueries({ queryKey: ["content", "detail", variables.contentId] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const reorderMutation = useMutation({
    mutationFn: reorderContentItems,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["content", projectId] });
    },
    onError: (err: Error) => {
      setLocalRows(null);
      toast.error(err.message);
    },
  });

  const onDragStart = (index: number) => (event: DragEvent<HTMLSpanElement>) => {
    setDragIndex(index);
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", String(index));
  };

  const onDragOver = (index: number) => (event: DragEvent<HTMLTableRowElement>) => {
    if (!canReorder) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
    if (dropIndex !== index) setDropIndex(index);
  };

  const applyReorder = (next: ContentItem[]) => {
    setLocalRows(next);
    reorderMutation.mutate(next.map((item, sort_order) => ({ id: item.id, sort_order })));
  };

  const onDrop = (index: number) => (event: DragEvent<HTMLTableRowElement>) => {
    event.preventDefault();
    if (!canReorder) return;
    const from = dragIndex ?? Number(event.dataTransfer.getData("text/plain"));
    if (!Number.isFinite(from)) {
      setDragIndex(null);
      setDropIndex(null);
      return;
    }
    const next = moveItem(rows, from, index);
    setDragIndex(null);
    setDropIndex(null);
    if (next !== rows) {
      applyReorder(next);
    }
  };

  const onDragEnd = () => {
    setDragIndex(null);
    setDropIndex(null);
  };

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

  const deleteMutation = useMutation({
    mutationFn: (contentId: string) => deleteContent({ contentId, projectId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["content", projectId] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      setDeleteTarget(null);
      toast.success(t("project.calendar.deleted"));
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
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-2">
          <div>
            <h2 className="text-sm font-medium">{t("project.calendar.title")}</h2>
            <p className="text-xs text-muted-foreground">{t("project.calendar.hint")}</p>
          </div>
          <ul className="flex flex-wrap gap-1.5" aria-label={t("project.calendar.columns.format")}>
            {CONTENT_FORMATS.map((formatKey) => (
              <li
                key={formatKey}
                className={cn(
                  "inline-flex items-center rounded-md border px-2 py-0.5 text-[11px] font-medium",
                  contentFormatStyles[formatKey],
                )}
              >
                {t(`project.detail.formats.${formatKey}`)}
              </li>
            ))}
          </ul>
        </div>
        {canEdit ? (
          <Button
            type="button"
            variant="secondary"
            size="sm"
            disabled={clientQuery.isLoading || projectQuery.isLoading}
            onClick={handleSendUpdates}
          >
            {t("project.calendar.sendUpdates")}
          </Button>
        ) : null}
      </div>

      {contentQuery.isLoading || projectQuery.isLoading ? (
        <p className="text-sm text-muted-foreground">{t("common.loading")}</p>
      ) : contentQuery.isError ? (
        <p className="text-sm text-destructive">
          {contentQuery.error instanceof Error
            ? contentQuery.error.message
            : t("common.error")}
        </p>
      ) : rows.length === 0 ? (
        <EmptyState icon={CalendarDays} title={t("project.calendar.empty")} />
      ) : (
        <Card className="overflow-hidden rounded-xl">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[920px] text-sm">
              <thead className="bg-muted/50 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">
                <tr>
                  {canReorder ? <th className="w-8 px-2 py-3" aria-label={t("project.calendar.reorder")} /> : null}
                  <th className="px-3 py-3">#</th>
                  <th className="px-3 py-3">{t("project.calendar.columns.day")}</th>
                  <th className="px-3 py-3">{t("project.calendar.columns.datetime")}</th>
                  <th className="px-3 py-3">{t("project.calendar.columns.status")}</th>
                  <th className="px-3 py-3">{t("project.calendar.columns.format")}</th>
                  <th className="px-3 py-3">{t("project.calendar.columns.theme")}</th>
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
                  const rowFormat = (row.format ?? "static_feed") as ContentFormat;
                  const isBusy =
                    updateMutation.isPending ||
                    duplicateMutation.isPending ||
                    deleteMutation.isPending ||
                    reorderMutation.isPending;

                  return (
                    <tr
                      key={row.id}
                      onDragOver={canReorder ? onDragOver(index) : undefined}
                      onDrop={canReorder ? onDrop(index) : undefined}
                      className={cn(
                        contentFormatRowStyles[rowFormat],
                        "hover:brightness-[0.98]",
                        dragIndex === index && "opacity-50",
                        dropIndex === index &&
                          dragIndex !== null &&
                          dragIndex !== index &&
                          "bg-muted",
                      )}
                    >
                      {canReorder ? (
                        <td className="px-2 py-2.5">
                          <span
                            draggable
                            onDragStart={onDragStart(index)}
                            onDragEnd={onDragEnd}
                            className="inline-flex cursor-grab touch-none text-muted-foreground active:cursor-grabbing"
                            aria-label={t("project.calendar.dragHandle")}
                            title={t("project.calendar.dragHandle")}
                            role="button"
                            tabIndex={0}
                          >
                            <GripVertical className="h-4 w-4" aria-hidden="true" />
                          </span>
                        </td>
                      ) : null}
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
                        <ContentStatusSelect
                          status={row.status as ContentStatus}
                          contentId={row.id}
                          clientId={clientId}
                          projectId={projectId}
                          title={row.title}
                          disabled={!canEdit || isBusy}
                        />
                      </td>
                      <td className="px-3 py-2.5">
                        <Select
                          value={rowFormat}
                          disabled={!canEdit || isBusy}
                          onValueChange={(value) => {
                            updateMutation.mutate({
                              contentId: row.id,
                              format: value as ContentFormat,
                            });
                          }}
                        >
                          <SelectTrigger
                            className={cn(
                              "h-8 w-[9.5rem] border text-xs font-medium shadow-sm focus:ring-1",
                              contentFormatStyles[rowFormat],
                            )}
                          >
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {CONTENT_FORMATS.map((formatKey) => (
                              <SelectItem key={formatKey} value={formatKey}>
                                <span className="inline-flex items-center gap-2">
                                  <span
                                    className={cn(
                                      "h-2.5 w-2.5 shrink-0 rounded-full border",
                                      contentFormatStyles[formatKey],
                                    )}
                                    aria-hidden="true"
                                  />
                                  {t(`project.detail.formats.${formatKey}`)}
                                </span>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
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
                        <CalendarTitleCell
                          title={row.title}
                          disabled={!canEdit || isBusy}
                          onSave={(nextTitle) => {
                            updateMutation.mutate({
                              contentId: row.id,
                              title: nextTitle,
                            });
                          }}
                        />
                      </td>
                      <td className="px-3 py-2.5">
                        <div className="flex items-center justify-end gap-1.5">
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
                          {canEdit ? (
                            <>
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
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                disabled={isBusy}
                                className="text-destructive hover:text-destructive"
                                title={t("project.calendar.deleteHint")}
                                onClick={() => setDeleteTarget({ id: row.id, title: row.title })}
                              >
                                <Trash2 className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" />
                                {t("project.calendar.delete")}
                              </Button>
                            </>
                          ) : null}
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

      {!contentQuery.isLoading && !projectQuery.isLoading && !contentQuery.isError ? (
        <div className="flex justify-center pt-4">
          <InstagramFeedMockup
            items={rows}
            username={clientQuery.data?.name}
            avatarUrl={clientQuery.data?.logo_url}
            canReorder={canReorder}
            onReorder={applyReorder}
          />
        </div>
      ) : null}

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

      <AlertDialog
        open={Boolean(deleteTarget)}
        onOpenChange={(nextOpen) => {
          if (!nextOpen && !deleteMutation.isPending) setDeleteTarget(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("project.calendar.deleteConfirmTitle")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("project.calendar.deleteConfirmDescription", {
                title: deleteTarget?.title ?? "",
              })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteMutation.isPending}>
              {t("common.cancel")}
            </AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={deleteMutation.isPending || !deleteTarget}
              onClick={(e) => {
                e.preventDefault();
                if (!deleteTarget) return;
                deleteMutation.mutate(deleteTarget.id);
              }}
            >
              {t("project.calendar.delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
