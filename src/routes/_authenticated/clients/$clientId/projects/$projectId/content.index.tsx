import { useEffect, useMemo, useState, type DragEvent } from "react";
import { createFileRoute, Link, redirect, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { formatDistanceToNow } from "date-fns";
import { ptBR, enUS, es } from "date-fns/locale";
import { Copy, FileText, GripVertical, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/empty-state";
import { ContentFormatSelect } from "@/components/content-format-select";
import { ContentStatusSelect } from "@/components/content-status-select";
import {
  isClientActionableStatus,
  type ContentStatus,
} from "@/components/status-badge";
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
import {
  MediaLightbox,
  type PreviewMediaItem,
} from "@/components/content-media-preview";
import {
  GraphicArtsMaterialFields,
  parseCmInput,
} from "@/components/graphic-arts-material-fields";
import { InstagramFeedMockup } from "@/components/instagram-feed-mockup";
import {
  canManageClient,
  contentFormatsForProject,
  createContent,
  deleteContent,
  duplicateContent,
  defaultContentFormatForProject,
  CONTENT_TAB_ENABLED,
  getClient,
  getGraphicArtsMaterialPreset,
  getPrimaryProjectCategory,
  getProject,
  isVideoUrl,
  listContent,
  projectCategoryConfig,
  reorderContentItems,
  resolveContentMediaUrls,
  updateContentCalendar,
  updateContentI18n,
  getLocalizedText,
  normalizeAppLocale,
  type ContentFormat,
  type ContentItem,
  type GraphicArtsMaterialType,
} from "@/lib/api";
import { cn } from "@/lib/utils";
import type { LanguageCode } from "@/i18n";
import { backfillRowsForLocale } from "@/hooks/use-i18n-backfill";
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
  beforeLoad: ({ params }) => {
    if (CONTENT_TAB_ENABLED) return;
    throw redirect({
      to: "/clients/$clientId/projects/$projectId/calendar",
      params,
      replace: true,
    });
  },
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
  const [newFormat, setNewFormat] = useState<ContentFormat>("static_feed");
  const posterPreset = getGraphicArtsMaterialPreset("poster");
  const [newMaterialType, setNewMaterialType] = useState<GraphicArtsMaterialType>("poster");
  const [newWidthCm, setNewWidthCm] = useState(String(posterPreset.widthCm));
  const [newHeightCm, setNewHeightCm] = useState(String(posterPreset.heightCm));
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; title: string } | null>(null);
  const [localRows, setLocalRows] = useState<ContentItem[] | null>(null);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [dropIndex, setDropIndex] = useState<number | null>(null);
  const [lightbox, setLightbox] = useState<{
    items: PreviewMediaItem[];
    title: string;
  } | null>(null);

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

  const clientQuery = useQuery({
    queryKey: ["clients", clientId],
    queryFn: () => getClient(clientId),
  });

  const allowedFormats = contentFormatsForProject(projectQuery.data?.categories);
  const isGraphicArts =
    getPrimaryProjectCategory(projectQuery.data?.categories) === "graphic_arts";
  const showInstagramMockup = projectCategoryConfig(projectQuery.data?.categories).tabs.includes(
    "feed",
  );

  const resetCreateForm = () => {
    const preset = getGraphicArtsMaterialPreset("poster");
    setTitle("");
    setNewFormat(
      allowedFormats[0] ?? defaultContentFormatForProject(projectQuery.data?.categories),
    );
    setNewMaterialType("poster");
    setNewWidthCm(String(preset.widthCm));
    setNewHeightCm(String(preset.heightCm));
  };

  const openCreateDialog = () => {
    resetCreateForm();
    setOpen(true);
  };

  const createMutation = useMutation({
    mutationFn: createContent,
    onSuccess: (row) => {
      queryClient.invalidateQueries({ queryKey: ["content", projectId] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      setOpen(false);
      resetCreateForm();
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
  const locale = dateLocales[(i18n.language as LanguageCode) ?? "pt-BR"] ?? ptBR;
  const uiLocale = normalizeAppLocale(i18n.resolvedLanguage ?? i18n.language);
  const localizedTitle = (item: ContentItem) =>
    getLocalizedText(item.i18n, "title", item.title, uiLocale);
  const canManage = Boolean(manageQuery.data);
  // Clients must not see "Em produção" (draft) content.
  const visibleRows = canManage ? allRows : allRows.filter((r) => r.status !== "draft");
  const rows =
    filter === "review"
      ? visibleRows.filter((r) => isClientActionableStatus(r.status))
      : visibleRows;
  const canReorder = canManage && filter !== "review" && rows.length > 1;
  const isBusy =
    duplicateMutation.isPending ||
    deleteMutation.isPending ||
    reorderMutation.isPending ||
    formatMutation.isPending;

  useEffect(() => {
    setLocalRows(null);
  }, [contentQuery.dataUpdatedAt]);

  useEffect(() => {
    if (!serverRows.length) return;
    let cancelled = false;
    void (async () => {
      const improved = await backfillRowsForLocale({
        rows: serverRows,
        locale: uiLocale,
        getKey: (r) => r.id,
        getI18n: (r) => r.i18n,
        getFields: (r) => ({
          title: r.title,
          caption: r.caption,
          theme: r.theme,
        }),
        persist: (r, nextI18n) => updateContentI18n(r.id, nextI18n).then(() => undefined),
        concurrency: 2,
      });
      if (!cancelled && improved > 0) {
        void queryClient.invalidateQueries({ queryKey: ["content", projectId] });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [projectId, queryClient, serverRows, uiLocale]);

  const openMediaLightbox = (item: ContentItem) => {
    const items: PreviewMediaItem[] = resolveContentMediaUrls(item).map((url) => ({
      url,
      kind: isVideoUrl(url) ? "video" : "image",
    }));
    if (items.length === 0) return;
    setLightbox({ items, title: localizedTitle(item) });
  };

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

  const onDragOver = (index: number) => (event: DragEvent<HTMLElement>) => {
    if (!canReorder) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
    if (dropIndex !== index) setDropIndex(index);
  };

  const onDrop = (index: number) => (event: DragEvent<HTMLElement>) => {
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
      <div className="flex flex-wrap items-center justify-end gap-2">
        {canManage ? (
          <Button onClick={openCreateDialog} className="w-full sm:w-auto">
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
          <div className="w-full min-w-0 flex-1">
            <EmptyState
              icon={FileText}
              title={
                filter === "review" ? t("project.content.emptyReview") : t("project.content.empty")
              }
            />
          </div>
          {showInstagramMockup ? (
            <InstagramFeedMockup
              items={[]}
              clientId={clientId}
              projectId={projectId}
              username={clientQuery.data?.name}
              avatarUrl={clientQuery.data?.logo_url}
              className="mx-auto hidden w-full shrink-0 lg:sticky lg:top-6 lg:block"
            />
          ) : null}
        </div>
      ) : (
        <div className="flex flex-col gap-8 lg:flex-row lg:items-start">
          <Card className="min-w-0 flex-1 overflow-hidden rounded-xl">
            <div className="space-y-3 p-3 md:hidden">
              {rows.map((r, index) => (
                <div
                  key={r.id}
                  onDragOver={canReorder ? onDragOver(index) : undefined}
                  onDrop={canReorder ? onDrop(index) : undefined}
                  className={cn(
                    "space-y-3 rounded-lg border p-3",
                    dragIndex === index && "opacity-50",
                    dropIndex === index &&
                      dragIndex !== null &&
                      dragIndex !== index &&
                      "bg-muted",
                  )}
                >
                  <div className="flex items-start gap-3">
                    {canReorder ? (
                      <span
                        draggable
                        onDragStart={onDragStart(index)}
                        onDragEnd={onDragEnd}
                        className="mt-1 inline-flex shrink-0 cursor-grab touch-none text-muted-foreground active:cursor-grabbing"
                        aria-label={t("project.content.dragHandle")}
                        title={t("project.content.dragHandle")}
                        role="button"
                        tabIndex={0}
                      >
                        <GripVertical className="h-4 w-4" aria-hidden="true" />
                      </span>
                    ) : null}
                    {r.media_url ? (
                      <button
                        type="button"
                        onClick={() => openMediaLightbox(r)}
                        aria-label={t("project.detail.expandMedia")}
                        className="shrink-0 cursor-zoom-in rounded-md outline-none ring-offset-background focus-visible:ring-2 focus-visible:ring-ring"
                      >
                        <img
                          src={r.media_url}
                          alt=""
                          className="h-12 w-12 rounded-md object-cover"
                        />
                      </button>
                    ) : (
                      <div className="h-12 w-12 shrink-0 rounded-md bg-muted" />
                    )}
                    <div className="min-w-0 flex-1 space-y-1">
                      <Link
                        to="/clients/$clientId/projects/$projectId/content/$contentId"
                        params={{ clientId, projectId, contentId: r.id }}
                        search={{}}
                        className="block truncate font-medium hover:underline"
                      >
                        {localizedTitle(r)}
                      </Link>
                      <p className="text-xs text-muted-foreground">
                        v{r.current_version}
                        {" · "}
                        {formatDistanceToNow(new Date(r.updated_at), {
                          addSuffix: true,
                          locale,
                        })}
                      </p>
                    </div>
                  </div>

                  <div className="grid gap-3">
                    <div className="min-w-0 space-y-1.5">
                      <Label className="text-xs text-muted-foreground">
                        {t("project.content.columns.format")}
                      </Label>
                      <ContentFormatSelect
                        format={(r.format ?? allowedFormats[0] ?? "static_feed") as ContentFormat}
                        formats={allowedFormats}
                        disabled={!canManage || isBusy}
                        className="w-full"
                        onValueChange={(value) => {
                          formatMutation.mutate({
                            contentId: r.id,
                            format: value,
                          });
                        }}
                      />
                    </div>
                    <div className="min-w-0 space-y-1.5">
                      <Label className="text-xs text-muted-foreground">
                        {t("project.content.columns.status")}
                      </Label>
                      <ContentStatusSelect
                        status={r.status as ContentStatus}
                        contentId={r.id}
                        clientId={clientId}
                        projectId={projectId}
                        title={localizedTitle(r)}
                        disabled={!canManage || isBusy}
                        className="w-full max-w-none"
                      />
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-1.5">
                    <Button asChild variant="outline" size="sm">
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
                          variant="outline"
                          size="sm"
                          disabled={isBusy}
                          onClick={() => duplicateMutation.mutate(r.id)}
                        >
                          <Copy className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" />
                          {t("project.content.duplicate")}
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          disabled={isBusy}
                          className="text-destructive hover:text-destructive"
                          onClick={() => setDeleteTarget({ id: r.id, title: localizedTitle(r) })}
                        >
                          <Trash2 className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" />
                          {t("project.content.delete")}
                        </Button>
                      </>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>

            <div className="hidden overflow-x-auto overscroll-x-contain md:block">
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
                          <button
                            type="button"
                            onClick={() => openMediaLightbox(r)}
                            aria-label={t("project.detail.expandMedia")}
                            className="cursor-zoom-in rounded-md outline-none ring-offset-background focus-visible:ring-2 focus-visible:ring-ring"
                          >
                            <img
                              src={r.media_url}
                              alt=""
                              className="h-10 w-10 rounded-md object-cover"
                            />
                          </button>
                        ) : (
                          <div className="h-10 w-10 rounded-md bg-muted" />
                        )}
                      </td>
                      <td className="max-w-[14rem] px-4 py-3 font-medium">
                        <Link
                          to="/clients/$clientId/projects/$projectId/content/$contentId"
                          params={{ clientId, projectId, contentId: r.id }}
                          search={{}}
                          className="block truncate hover:underline"
                        >
                          {localizedTitle(r)}
                        </Link>
                      </td>
                      <td className="px-4 py-3">
                        <ContentFormatSelect
                          format={(r.format ?? allowedFormats[0] ?? "static_feed") as ContentFormat}
                          formats={allowedFormats}
                          disabled={!canManage || isBusy}
                          className="w-[9.5rem]"
                          onValueChange={(value) => {
                            formatMutation.mutate({
                              contentId: r.id,
                              format: value,
                            });
                          }}
                        />
                      </td>
                      <td className="px-4 py-3">
                        <ContentStatusSelect
                          status={r.status as ContentStatus}
                          contentId={r.id}
                          clientId={clientId}
                          projectId={projectId}
                          title={localizedTitle(r)}
                          disabled={!canManage || isBusy}
                          className="w-[13.5rem] max-w-[13.5rem]"
                        />
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">v{r.current_version}</td>
                      <td className="whitespace-nowrap px-4 py-3 text-muted-foreground">
                        {formatDistanceToNow(new Date(r.updated_at), { addSuffix: true, locale })}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex flex-wrap items-center justify-end gap-1.5">
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
                                onClick={() => setDeleteTarget({ id: r.id, title: localizedTitle(r) })}
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

          {showInstagramMockup ? (
            <InstagramFeedMockup
              items={rows}
              clientId={clientId}
              projectId={projectId}
              username={clientQuery.data?.name}
              avatarUrl={clientQuery.data?.logo_url}
              canReorder={canReorder}
              onReorder={applyReorder}
              className="mx-auto hidden w-full shrink-0 lg:sticky lg:top-6 lg:block"
            />
          ) : null}
        </div>
      )}

      <Dialog
        open={open}
        onOpenChange={(next) => {
          setOpen(next);
          if (!next) resetCreateForm();
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {isGraphicArts ? t("project.graphicArts.newPiece") : t("project.content.new")}
            </DialogTitle>
          </DialogHeader>
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              if (!title.trim()) return;
              if (isGraphicArts) {
                const width = parseCmInput(newWidthCm);
                const height = parseCmInput(newHeightCm);
                if (width == null || height == null) {
                  toast.error(t("project.graphicArts.invalidDimensions"));
                  return;
                }
                createMutation.mutate({
                  projectId,
                  clientId,
                  title: title.trim(),
                  format: "print_material",
                  materialType: newMaterialType,
                  widthCm: width,
                  heightCm: height,
                });
                return;
              }
              createMutation.mutate({
                projectId,
                clientId,
                title: title.trim(),
                format: newFormat,
              });
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
            {!isGraphicArts && allowedFormats.length > 0 ? (
              <div className="space-y-1.5">
                <Label>{t("project.detail.format")}</Label>
                <ContentFormatSelect
                  format={
                    allowedFormats.includes(newFormat) ? newFormat : allowedFormats[0]
                  }
                  formats={allowedFormats}
                  onValueChange={setNewFormat}
                />
              </div>
            ) : null}
            {isGraphicArts ? (
              <GraphicArtsMaterialFields
                idPrefix="content-create"
                materialType={newMaterialType}
                widthCm={newWidthCm}
                heightCm={newHeightCm}
                onMaterialTypeChange={setNewMaterialType}
                onWidthCmChange={setNewWidthCm}
                onHeightCmChange={setNewHeightCm}
              />
            ) : null}
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

      <MediaLightbox
        open={Boolean(lightbox)}
        onOpenChange={(nextOpen) => {
          if (!nextOpen) setLightbox(null);
        }}
        items={lightbox?.items ?? []}
        title={lightbox?.title ?? ""}
      />

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
