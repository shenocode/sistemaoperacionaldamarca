import { useEffect, useMemo, useState, type DragEvent } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { formatDistanceToNow } from "date-fns";
import { ptBR, enUS, es } from "date-fns/locale";
import { Copy, FileText, GripVertical, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/empty-state";
import { ContentStatusSelect } from "@/components/content-status-select";
import { contentFormatStyles } from "@/components/content-format-styles";
import type { ContentStatus } from "@/components/status-badge";
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
import { InstagramFeedMockup } from "@/components/instagram-feed-mockup";
import {
  CONTENT_FORMATS,
  canManageClient,
  createContent,
  deleteContent,
  duplicateContent,
  getClient,
  listContent,
  reorderContentItems,
  updateContentCalendar,
  type ContentFormat,
  type ContentItem,
} from "@/lib/api";
import { cn } from "@/lib/utils";
import type { LanguageCode } from "@/i18n";
import { validateContentSearch } from "./content";

const dateLocales = { "pt-BR": ptBR, "en-US": enUS, "es-ES": es };

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
  return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
}

export const Route = createFileRoute("/_authenticated/clients/$clientId/projects/$projectId/content/")({
  validateSearch: validateContentSearch,
  component: ContentListPage,
});

function ContentListPage() {
  const { clientId, projectId } = Route.useParams();
  const { filter } = Route.useSearch();
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; title: string } | null>(null);
  const [localRows, setLocalRows] = useState<ContentItem[] | null>(null);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [dropIndex, setDropIndex] = useState<number | null>(null);

  const contentQuery = useQuery({
    queryKey: ["content", projectId],
    queryFn: () => listContent(projectId),
  });

  const manageQuery = useQuery({
    queryKey: ["can-manage", clientId],
    queryFn: () => canManageClient(clientId),
  });

  const clientQuery = useQuery({
    queryKey: ["clients", clientId],
    queryFn: () => getClient(clientId),
  });

  const createMutation = useMutation({
    mutationFn: createContent,
    onSuccess: (row) => {
      queryClient.invalidateQueries({ queryKey: ["content", projectId] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      setOpen(false);
      setTitle("");
      toast.success(t("project.content.created"));
      navigate({
        to: "/clients/$clientId/projects/$projectId/content/$contentId",
        params: { clientId, projectId, contentId: row.id },
        search: {},
      });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const duplicateMutation = useMutation({
    mutationFn: (contentId: string) =>
      duplicateContent({ contentId, clientId, projectId, advanceDays: 0 }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["content", projectId] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      toast.success(t("project.content.duplicated"));
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const deleteMutation = useMutation({
    mutationFn: (contentId: string) => deleteContent({ contentId, projectId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["content", projectId] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      setDeleteTarget(null);
      toast.success(t("project.content.deleted"));
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

  const formatMutation = useMutation({
    mutationFn: updateContentCalendar,
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["content", projectId] });
      queryClient.invalidateQueries({ queryKey: ["content", "detail", variables.contentId] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const serverRows = useMemo(
    () => [...(contentQuery.data ?? [])].sort(sortByManualOrder),
    [contentQuery.data],
  );
  const allRows = localRows ?? serverRows;
  const rows = filter === "review" ? allRows.filter((r) => r.status === "review") : allRows;
  const locale = dateLocales[(i18n.language as LanguageCode) ?? "pt-BR"] ?? ptBR;
  const canManage = Boolean(manageQuery.data);
  const canReorder = canManage && filter !== "review" && rows.length > 1;
  const isBusy =
    duplicateMutation.isPending ||
    deleteMutation.isPending ||
    reorderMutation.isPending ||
    formatMutation.isPending;

  useEffect(() => {
    setLocalRows(null);
  }, [contentQuery.dataUpdatedAt]);

  const applyReorder = (next: ContentItem[]) => {
    if (next === rows) return;
    setLocalRows(next);
    reorderMutation.mutate(next.map((item, sort_order) => ({ id: item.id, sort_order })));
  };

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

  const onDrop = (index: number) => (event: DragEvent<HTMLTableRowElement>) => {
    event.preventDefault();
    if (!canReorder) return;
    const from = dragIndex ?? Number(event.dataTransfer.getData("text/plain"));
    setDragIndex(null);
    setDropIndex(null);
    if (!Number.isFinite(from)) return;
    applyReorder(moveItem(rows, from, index));
  };

  const onDragEnd = () => {
    setDragIndex(null);
    setDropIndex(null);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-end">
        {canManage ? (
          <Button onClick={() => setOpen(true)}>
            <Plus className="mr-2 h-4 w-4" aria-hidden="true" />
            {t("project.content.new")}
          </Button>
        ) : null}
      </div>

      {contentQuery.isLoading ? (
        <p className="text-sm text-muted-foreground">{t("common.loading")}</p>
      ) : contentQuery.isError ? (
        <p className="text-sm text-destructive">
          {contentQuery.error instanceof Error
            ? contentQuery.error.message
            : t("common.error")}
        </p>
      ) : rows.length === 0 ? (
        <div className="flex flex-col items-center gap-8 lg:flex-row lg:items-start lg:justify-between">
          <div className="w-full flex-1">
            <EmptyState
              icon={FileText}
              title={
                filter === "review" ? t("project.content.emptyReview") : t("project.content.empty")
              }
            />
          </div>
          <InstagramFeedMockup
            items={[]}
            clientId={clientId}
            projectId={projectId}
            username={clientQuery.data?.name}
            avatarUrl={clientQuery.data?.logo_url}
            className="mx-auto shrink-0 lg:sticky lg:top-6"
          />
        </div>
      ) : (
        <div className="flex flex-col gap-8 lg:flex-row lg:items-start">
          <Card className="min-w-0 flex-1 overflow-hidden rounded-xl">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1020px] text-sm">
                <thead className="bg-muted/50 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  <tr>
                    {canReorder ? (
                      <th className="w-8 px-2 py-3" aria-label={t("project.content.reorder")} />
                    ) : null}
                    <th className="px-4 py-3">{t("project.content.columns.thumbnail")}</th>
                    <th className="px-4 py-3">{t("project.content.columns.title")}</th>
                    <th className="px-4 py-3">{t("project.content.columns.format")}</th>
                    <th className="px-4 py-3">{t("project.content.columns.status")}</th>
                    <th className="px-4 py-3">{t("project.content.columns.version")}</th>
                    <th className="whitespace-nowrap px-4 py-3">
                      {t("project.content.columns.updated")}
                    </th>
                    <th className="px-4 py-3 text-right">{t("project.content.columns.actions")}</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {rows.map((r, index) => (
                    <tr
                      key={r.id}
                      onDragOver={canReorder ? onDragOver(index) : undefined}
                      onDrop={canReorder ? onDrop(index) : undefined}
                      className={cn(
                        "hover:bg-muted/30",
                        dragIndex === index && "opacity-50",
                        dropIndex === index &&
                          dragIndex !== null &&
                          dragIndex !== index &&
                          "bg-muted",
                      )}
                    >
                      {canReorder ? (
                        <td className="px-2 py-3">
                          <span
                            draggable
                            onDragStart={onDragStart(index)}
                            onDragEnd={onDragEnd}
                            className="inline-flex cursor-grab touch-none text-muted-foreground active:cursor-grabbing"
                            aria-label={t("project.content.dragHandle")}
                            title={t("project.content.dragHandle")}
                            role="button"
                            tabIndex={0}
                          >
                            <GripVertical className="h-4 w-4" aria-hidden="true" />
                          </span>
                        </td>
                      ) : null}
                      <td className="px-4 py-3">
                        {r.media_url ? (
                          <img
                            src={r.media_url}
                            alt=""
                            className="h-10 w-10 rounded-md object-cover"
                          />
                        ) : (
                          <div className="h-10 w-10 rounded-md bg-muted" />
                        )}
                      </td>
                      <td className="px-4 py-3 font-medium">
                        <Link
                          to="/clients/$clientId/projects/$projectId/content/$contentId"
                          params={{ clientId, projectId, contentId: r.id }}
                          search={{}}
                          className="hover:underline"
                        >
                          {r.title}
                        </Link>
                      </td>
                      <td className="px-4 py-3">
                        <Select
                          value={r.format ?? "static_feed"}
                          disabled={!canManage || isBusy}
                          onValueChange={(value) => {
                            formatMutation.mutate({
                              contentId: r.id,
                              format: value as ContentFormat,
                            });
                          }}
                        >
                          <SelectTrigger
                            className={cn(
                              "h-8 w-[9.5rem] border text-xs font-medium shadow-sm focus:ring-1",
                              contentFormatStyles[(r.format ?? "static_feed") as ContentFormat],
                            )}
                            aria-label={t("project.content.columns.format")}
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
                      <td className="px-4 py-3">
                        <ContentStatusSelect
                          status={r.status as ContentStatus}
                          contentId={r.id}
                          clientId={clientId}
                          projectId={projectId}
                          title={r.title}
                          disabled={!canManage || isBusy}
                        />
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">v{r.current_version}</td>
                      <td className="whitespace-nowrap px-4 py-3 text-muted-foreground">
                        {formatDistanceToNow(new Date(r.updated_at), { addSuffix: true, locale })}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex flex-nowrap items-center justify-end gap-1.5">
                          <Button asChild variant="ghost" size="sm">
                            <Link
                              to="/clients/$clientId/projects/$projectId/content/$contentId"
                              params={{ clientId, projectId, contentId: r.id }}
                              search={{}}
                            >
                              {t("project.content.open")}
                            </Link>
                          </Button>
                          {canManage ? (
                            <>
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                disabled={isBusy}
                                onClick={() => duplicateMutation.mutate(r.id)}
                              >
                                <Copy className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" />
                                {t("project.content.duplicate")}
                              </Button>
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                disabled={isBusy}
                                className="text-destructive hover:text-destructive"
                                onClick={() => setDeleteTarget({ id: r.id, title: r.title })}
                              >
                                <Trash2 className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" />
                                {t("project.content.delete")}
                              </Button>
                            </>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          <InstagramFeedMockup
            items={rows}
            clientId={clientId}
            projectId={projectId}
            username={clientQuery.data?.name}
            avatarUrl={clientQuery.data?.logo_url}
            canReorder={canReorder}
            onReorder={applyReorder}
            className="mx-auto shrink-0 lg:sticky lg:top-6"
          />
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("project.content.new")}</DialogTitle>
          </DialogHeader>
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              if (!title.trim()) return;
              createMutation.mutate({ projectId, clientId, title });
            }}
          >
            <div className="space-y-1.5">
              <Label htmlFor="content-title">{t("project.content.title")}</Label>
              <Input
                id="content-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
                autoFocus
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                {t("common.cancel")}
              </Button>
              <Button type="submit" disabled={createMutation.isPending || !title.trim()}>
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
            <AlertDialogTitle>{t("project.content.deleteConfirmTitle")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("project.content.deleteConfirmDescription", {
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
              {t("project.content.delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
