import { useEffect, useMemo, useState, type DragEvent } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { format } from "date-fns";
import { ptBR, enUS, es } from "date-fns/locale";
import {
  CalendarDays,
  ChevronDown,
  ChevronUp,
  ClipboardList,
  Copy,
  ExternalLink,
  GripVertical,
  Plus,
  Trash2,
} from "lucide-react";
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
import { ApprovalsSummaryDialog } from "@/components/approvals-summary-dialog";
import { ContentStatusSelect } from "@/components/content-status-select";
import {
  contentFormatRowStyles,
  contentFormatStyles,
} from "@/components/content-format-styles";
import { InstagramFeedMockup } from "@/components/instagram-feed-mockup";
import type { ContentStatus } from "@/components/status-badge";
import {
  addProjectThemePreset,
  buildProjectReviewUrl,
  buildWhatsAppNotifyUrl,
  canManageClient,
  claimClientAccess,
  contentFormatsForProject,
  deleteContent,
  duplicateCalendarBlock,
  deleteCalendarBlock,
  duplicateContent,
  ensureCalendarBlocks,
  getClient,
  listContent,
  getProject,
  getLocalizedText,
  getLocalizedPresetList,
  normalizeAppLocale,
  parseRowI18n,
  projectCategoryConfig,
  reorderContentItems,
  updateCalendarBlockTitle,
  updateContentCalendar,
  updateContentI18n,
  type CalendarBlock,
  type ContentFormat,
  type ContentItem,
} from "@/lib/api";
import {
  buildLocalizedFieldFromSource,
  getCanonicalText,
  setLocalizedField,
  translateTextField,
  type RowI18n,
} from "@/lib/i18n-content";
import { backfillRowsForLocale } from "@/hooks/use-i18n-backfill";
import {
  readCollapsedCalendarBlockIds,
  writeCollapsedCalendarBlockIds,
} from "@/lib/calendar-block-collapsed";
import { isApprovedContentStatus } from "@/lib/publish-caption";
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
  i18n,
  disabled,
  onSave,
}: {
  title: string;
  i18n?: unknown;
  disabled: boolean;
  onSave: (title: string, rowI18n: RowI18n) => void;
}) {
  const { i18n: i18next } = useTranslation();
  const uiLocale = normalizeAppLocale(i18next.resolvedLanguage ?? i18next.language);
  const rowI18n = parseRowI18n(i18n);
  const displayTitle = getLocalizedText(rowI18n, "title", title, uiLocale);
  const [value, setValue] = useState(displayTitle);
  const [translating, setTranslating] = useState(false);

  useEffect(() => {
    setValue(displayTitle);
  }, [displayTitle]);

  async function commit() {
    const next = value.trim();
    if (!next || next === displayTitle) {
      setValue(displayTitle);
      return;
    }
    setTranslating(true);
    try {
      let block;
      try {
        block = await translateTextField({ text: next });
      } catch {
        block = buildLocalizedFieldFromSource(next, uiLocale);
      }
      const merged = setLocalizedField(rowI18n, "title", block);
      const canonical = getCanonicalText(merged, "title", next);
      const display = getLocalizedText(merged, "title", next, uiLocale);
      setValue(display);
      onSave(canonical, merged);
    } finally {
      setTranslating(false);
    }
  }

  return (
    <Input
      className="h-8 w-full min-w-0 font-medium md:min-w-[12rem]"
      value={value}
      disabled={disabled || translating}
      onChange={(e) => setValue(e.target.value)}
      onBlur={() => void commit()}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          e.currentTarget.blur();
        }
        if (e.key === "Escape") {
          setValue(displayTitle);
          e.currentTarget.blur();
        }
      }}
    />
  );
}

function BlockPeriodTitle({
  title,
  i18n,
  disabled,
  placeholder,
  ariaLabel,
  onSave,
}: {
  title: string;
  i18n?: unknown;
  disabled: boolean;
  placeholder: string;
  ariaLabel: string;
  onSave: (title: string, rowI18n: RowI18n) => void;
}) {
  const { i18n: i18next } = useTranslation();
  const uiLocale = normalizeAppLocale(i18next.resolvedLanguage ?? i18next.language);
  const rowI18n = parseRowI18n(i18n);
  const displayTitle = getLocalizedText(rowI18n, "title", title, uiLocale);
  const [value, setValue] = useState(displayTitle);
  const [translating, setTranslating] = useState(false);

  useEffect(() => {
    setValue(displayTitle);
  }, [displayTitle]);

  async function commit() {
    const next = value.trim();
    if (!next || next === displayTitle) {
      setValue(displayTitle);
      return;
    }
    setTranslating(true);
    try {
      let block;
      try {
        block = await translateTextField({ text: next });
      } catch {
        block = buildLocalizedFieldFromSource(next, uiLocale);
      }
      const merged = setLocalizedField(rowI18n, "title", block);
      const canonical = getCanonicalText(merged, "title", next);
      const display = getLocalizedText(merged, "title", next, uiLocale);
      setValue(display);
      onSave(canonical, merged);
    } finally {
      setTranslating(false);
    }
  }

  return (
    <div className="relative min-w-0 flex-1">
      <Input
        className="h-10 max-w-xl border-0 bg-transparent px-0 text-base font-semibold shadow-none focus-visible:ring-0 md:text-lg"
        value={value}
        disabled={disabled || translating}
        placeholder={placeholder}
        aria-label={ariaLabel}
        onChange={(e) => setValue(e.target.value)}
        onBlur={() => void commit()}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            e.currentTarget.blur();
          }
          if (e.key === "Escape") {
            setValue(displayTitle);
            e.currentTarget.blur();
          }
        }}
      />
    </div>
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
  const [deleteBlockTarget, setDeleteBlockTarget] = useState<{
    id: string;
    title: string;
    itemCount: number;
  } | null>(null);
  const [localRows, setLocalRows] = useState<ContentItem[] | null>(null);
  const [dragState, setDragState] = useState<{ blockKey: string; index: number } | null>(null);
  const [dropState, setDropState] = useState<{ blockKey: string; index: number } | null>(null);
  const [collapsedBlockIds, setCollapsedBlockIds] = useState<Set<string>>(() =>
    readCollapsedCalendarBlockIds(projectId),
  );
  const [approvalsSummaryBlockId, setApprovalsSummaryBlockId] = useState<string | null>(null);

  useEffect(() => {
    setCollapsedBlockIds(readCollapsedCalendarBlockIds(projectId));
  }, [projectId]);

  const locale = dateLocales[(i18n.language as LanguageCode) ?? "pt-BR"] ?? ptBR;

  const contentQuery = useQuery({
    queryKey: ["content", projectId],
    queryFn: () => listContent(projectId),
  });

  const blocksQuery = useQuery({
    queryKey: ["calendar-blocks", projectId],
    queryFn: () => ensureCalendarBlocks(projectId),
    enabled: Boolean(contentQuery.data),
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
  const uiLocale = normalizeAppLocale(i18n.resolvedLanguage ?? i18n.language);
  const projectI18n = parseRowI18n(projectQuery.data?.i18n);
  const themePresets = getLocalizedPresetList(
    projectI18n,
    "theme_presets",
    projectQuery.data?.theme_presets ?? [],
    uiLocale,
  );
  const localizedTitle = (item: ContentItem) =>
    getLocalizedText(item.i18n, "title", item.title, uiLocale);
  const allowedFormats = contentFormatsForProject(projectQuery.data?.categories);
  const showInstagramMockup = projectCategoryConfig(projectQuery.data?.categories).tabs.includes(
    "feed",
  );
  const serverRows = useMemo(
    () => [...(contentQuery.data ?? [])].sort(sortByManualOrder),
    [contentQuery.data],
  );
  // Clients must not see "Em produção" (draft) content.
  const rows = useMemo(() => {
    const base = localRows ?? serverRows;
    return canEdit ? base : base.filter((r) => r.status !== "draft");
  }, [canEdit, localRows, serverRows]);
  const blocks = blocksQuery.data ?? [];

  const itemsByBlock = useMemo(() => {
    const map = new Map<string, ContentItem[]>();
    for (const block of blocks) {
      map.set(block.id, []);
    }
    const unassigned: ContentItem[] = [];
    for (const row of rows) {
      const blockId = row.calendar_block_id;
      if (blockId && map.has(blockId)) {
        map.get(blockId)!.push(row);
      } else {
        unassigned.push(row);
      }
    }
    return { map, unassigned };
  }, [blocks, rows]);

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
        getFields: (r) => ({ title: r.title, theme: r.theme }),
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

  useEffect(() => {
    if (!blocks.length) return;
    let cancelled = false;
    void (async () => {
      const improved = await backfillRowsForLocale({
        rows: blocks,
        locale: uiLocale,
        getKey: (b) => b.id,
        getI18n: (b) => b.i18n,
        getFields: (b) => ({ title: b.title }),
        persist: async (b, nextI18n) => {
          await updateCalendarBlockTitle(
            b.id,
            getCanonicalText(nextI18n, "title", b.title),
            nextI18n,
          );
        },
        concurrency: 2,
      });
      if (!cancelled && improved > 0) {
        void queryClient.invalidateQueries({ queryKey: ["calendar-blocks", projectId] });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [blocks, projectId, queryClient, uiLocale]);

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
      client: getLocalizedText(client.i18n, "name", client.name, uiLocale),
      project: getLocalizedText(project.i18n, "name", project.name, uiLocale),
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

  const updateBlockTitleMutation = useMutation({
    mutationFn: ({
      blockId,
      title,
      i18n,
    }: {
      blockId: string;
      title: string;
      i18n?: RowI18n;
    }) => updateCalendarBlockTitle(blockId, title, i18n),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["calendar-blocks", projectId] });
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

  const applyReorder = (next: ContentItem[]) => {
    setLocalRows(next);
    reorderMutation.mutate(next.map((item, sort_order) => ({ id: item.id, sort_order })));
  };

  const applyReorderInBlock = (blockKey: string, nextBlockItems: ContentItem[]) => {
    const nextFull: ContentItem[] = [];
    if (blocks.length === 0) {
      applyReorder(nextBlockItems);
      return;
    }
    for (const block of blocks) {
      if (block.id === blockKey) {
        nextFull.push(...nextBlockItems);
      } else {
        nextFull.push(...(itemsByBlock.map.get(block.id) ?? []));
      }
    }
    if (blockKey === "__unassigned__") {
      nextFull.push(...nextBlockItems);
    } else {
      nextFull.push(...itemsByBlock.unassigned);
    }
    applyReorder(nextFull);
  };

  const onDragStart = (blockKey: string, index: number) => (event: DragEvent<HTMLSpanElement>) => {
    setDragState({ blockKey, index });
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", `${blockKey}:${index}`);
  };

  const onDragOver = (blockKey: string, index: number) => (event: DragEvent<HTMLElement>) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
    if (dropState?.blockKey !== blockKey || dropState.index !== index) {
      setDropState({ blockKey, index });
    }
  };

  const onDrop = (blockKey: string, index: number) => (event: DragEvent<HTMLElement>) => {
    event.preventDefault();
    const raw = event.dataTransfer.getData("text/plain");
    const [fromBlock, fromIndexRaw] = raw.includes(":")
      ? raw.split(":")
      : [dragState?.blockKey, dragState ? String(dragState.index) : ""];
    const fromIndex = Number(fromIndexRaw);
    setDragState(null);
    setDropState(null);
    if (!fromBlock || fromBlock !== blockKey || !Number.isFinite(fromIndex)) return;

    const current =
      blockKey === "__unassigned__"
        ? itemsByBlock.unassigned
        : (itemsByBlock.map.get(blockKey) ?? []);
    if (current.length < 2) return;
    const next = moveItem(current, fromIndex, index);
    if (next !== current) {
      applyReorderInBlock(blockKey, next);
    }
  };

  const onDragEnd = () => {
    setDragState(null);
    setDropState(null);
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
      queryClient.invalidateQueries({ queryKey: ["calendar-blocks", projectId] });
      toast.success(t("project.calendar.duplicated"));
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const duplicateBlockMutation = useMutation({
    mutationFn: (blockId: string) =>
      duplicateCalendarBlock({
        blockId,
        clientId,
        projectId,
        locale: i18n.language,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["content", projectId] });
      queryClient.invalidateQueries({ queryKey: ["calendar-blocks", projectId] });
      toast.success(t("project.calendar.blockDuplicated"));
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const deleteMutation = useMutation({
    mutationFn: (contentId: string) => deleteContent({ contentId, projectId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["content", projectId] });
      queryClient.invalidateQueries({ queryKey: ["calendar-blocks", projectId] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      setDeleteTarget(null);
      toast.success(t("project.calendar.deleted"));
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const deleteBlockMutation = useMutation({
    mutationFn: (blockId: string) => deleteCalendarBlock({ blockId, projectId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["content", projectId] });
      queryClient.invalidateQueries({ queryKey: ["calendar-blocks", projectId] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      setDeleteBlockTarget(null);
      toast.success(t("project.calendar.blockDeleted"));
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const themeOptions = useMemo(() => {
    const fromRows = rows
      .map((r) => getLocalizedText(r.i18n, "theme", r.theme ?? "", uiLocale).trim())
      .filter(Boolean);
    return Array.from(new Set([...themePresets, ...fromRows])).sort((a, b) =>
      a.localeCompare(b, i18n.language),
    );
  }, [themePresets, rows, i18n.language, uiLocale]);

  const isBusy =
    updateMutation.isPending ||
    duplicateMutation.isPending ||
    duplicateBlockMutation.isPending ||
    deleteMutation.isPending ||
    deleteBlockMutation.isPending ||
    reorderMutation.isPending ||
    updateBlockTitleMutation.isPending;

  const renderDatetimeField = (row: ContentItem, className?: string) => (
    <Input
      type="datetime-local"
      className={cn("h-8 min-w-0", className)}
      value={toDatetimeLocalValue(row.scheduled_at)}
      disabled={!canEdit || isBusy}
      onChange={(e) => {
        updateMutation.mutate({
          contentId: row.id,
          scheduledAt: fromDatetimeLocalValue(e.target.value),
        });
      }}
    />
  );

  const renderFormatField = (row: ContentItem, rowFormat: ContentFormat, className?: string) => (
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
          "h-8 border text-xs font-medium shadow-sm focus:ring-1 [&>span]:min-w-0 [&>span]:truncate [&>svg]:shrink-0",
          contentFormatStyles[rowFormat],
          className,
        )}
      >
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {allowedFormats.map((formatKey) => (
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
  );

  const renderThemeField = (row: ContentItem, className?: string) => (
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
      <SelectTrigger className={cn("h-8 [&>span]:min-w-0 [&>span]:truncate [&>svg]:shrink-0", className)}>
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
          <SelectItem value={NEW_THEME_VALUE}>{t("project.calendar.newTheme")}</SelectItem>
        ) : null}
      </SelectContent>
    </Select>
  );

  const renderRowActions = (row: ContentItem) => (
    <div className="flex flex-wrap items-center gap-1.5 md:justify-end">
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
            onClick={() => setDeleteTarget({ id: row.id, title: localizedTitle(row) })}
          >
            <Trash2 className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" />
            {t("project.calendar.delete")}
          </Button>
        </>
      ) : null}
    </div>
  );

  const renderBlockTable = (blockKey: string, blockRows: ContentItem[]) => {
    const canReorder = canEdit && blockRows.length > 1;

    return (
      <>
        <div className="space-y-3 p-3 md:hidden">
          {blockRows.map((row, index) => {
            const scheduled = row.scheduled_at ? new Date(row.scheduled_at) : null;
            const dayLabel =
              scheduled && !Number.isNaN(scheduled.getTime())
                ? format(scheduled, "EEEE", { locale })
                : "—";
            const rowFormat = (row.format ?? "static_feed") as ContentFormat;

            return (
              <div
                key={row.id}
                onDragOver={canReorder ? onDragOver(blockKey, index) : undefined}
                onDrop={canReorder ? onDrop(blockKey, index) : undefined}
                className={cn(
                  contentFormatRowStyles[rowFormat],
                  "space-y-3 rounded-lg border p-3",
                  dragState?.blockKey === blockKey && dragState.index === index && "opacity-50",
                  dropState?.blockKey === blockKey &&
                    dropState.index === index &&
                    dragState !== null &&
                    !(dragState.blockKey === blockKey && dragState.index === index) &&
                    "bg-muted",
                )}
              >
                <div className="flex items-start gap-2">
                  <div className="flex shrink-0 items-center gap-1.5 pt-1">
                    {canReorder ? (
                      <span
                        draggable
                        onDragStart={onDragStart(blockKey, index)}
                        onDragEnd={onDragEnd}
                        className="inline-flex cursor-grab touch-none text-foreground/55 hover:text-foreground active:cursor-grabbing"
                        aria-label={t("project.calendar.dragHandle")}
                        title={t("project.calendar.dragHandle")}
                        role="button"
                        tabIndex={0}
                      >
                        <GripVertical className="h-4 w-4" aria-hidden="true" />
                      </span>
                    ) : null}
                    <span className="text-xs text-muted-foreground">{index + 1}</span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <CalendarTitleCell
                      title={localizedTitle(row)}
                      i18n={row.i18n}
                      disabled={!canEdit || isBusy}
                      onSave={(nextTitle, nextI18n) => {
                        updateMutation.mutate({
                          contentId: row.id,
                          title: nextTitle,
                          i18n: nextI18n,
                        });
                      }}
                    />
                    <p className="mt-1 text-xs capitalize text-muted-foreground">{dayLabel}</p>
                  </div>
                </div>

                <div className="grid gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">
                      {t("project.calendar.columns.datetime")}
                    </Label>
                    {renderDatetimeField(row, "w-full")}
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">
                      {t("project.calendar.columns.status")}
                    </Label>
                    <ContentStatusSelect
                      status={row.status as ContentStatus}
                      contentId={row.id}
                      clientId={clientId}
                      projectId={projectId}
                      title={localizedTitle(row)}
                      disabled={!canEdit || isBusy}
                      className="w-full max-w-none"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="min-w-0 space-y-1.5">
                      <Label className="text-xs text-muted-foreground">
                        {t("project.calendar.columns.format")}
                      </Label>
                      {renderFormatField(row, rowFormat, "w-full")}
                    </div>
                    <div className="min-w-0 space-y-1.5">
                      <Label className="text-xs text-muted-foreground">
                        {t("project.calendar.columns.theme")}
                      </Label>
                      {renderThemeField(row, "w-full")}
                    </div>
                  </div>
                </div>

                {renderRowActions(row)}
              </div>
            );
          })}
        </div>

        <div className="hidden overflow-x-auto overscroll-x-contain md:block">
          <table className="w-full min-w-[980px] text-sm">
            <thead className="bg-muted/50 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">
              <tr>
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
              {blockRows.map((row, index) => {
                const scheduled = row.scheduled_at ? new Date(row.scheduled_at) : null;
                const dayLabel =
                  scheduled && !Number.isNaN(scheduled.getTime())
                    ? format(scheduled, "EEEE", { locale })
                    : "—";
                const rowFormat = (row.format ?? "static_feed") as ContentFormat;

                return (
                  <tr
                    key={row.id}
                    onDragOver={canReorder ? onDragOver(blockKey, index) : undefined}
                    onDrop={canReorder ? onDrop(blockKey, index) : undefined}
                    className={cn(
                      contentFormatRowStyles[rowFormat],
                      "hover:brightness-[0.98]",
                      dragState?.blockKey === blockKey && dragState.index === index && "opacity-50",
                      dropState?.blockKey === blockKey &&
                        dropState.index === index &&
                        dragState !== null &&
                        !(dragState.blockKey === blockKey && dragState.index === index) &&
                        "bg-muted",
                    )}
                  >
                    <td className="px-3 py-2.5">
                      <div className="flex items-center gap-1.5">
                        {canReorder ? (
                          <span
                            draggable
                            onDragStart={onDragStart(blockKey, index)}
                            onDragEnd={onDragEnd}
                            className="inline-flex shrink-0 cursor-grab touch-none text-foreground/55 hover:text-foreground active:cursor-grabbing"
                            aria-label={t("project.calendar.dragHandle")}
                            title={t("project.calendar.dragHandle")}
                            role="button"
                            tabIndex={0}
                          >
                            <GripVertical className="h-4 w-4" aria-hidden="true" />
                          </span>
                        ) : null}
                        <span className="text-muted-foreground">{index + 1}</span>
                      </div>
                    </td>
                    <td className="px-3 py-2.5 capitalize text-muted-foreground">{dayLabel}</td>
                    <td className="px-3 py-2.5">{renderDatetimeField(row, "w-[14rem]")}</td>
                    <td className="px-3 py-2.5">
                      <ContentStatusSelect
                        status={row.status as ContentStatus}
                        contentId={row.id}
                        clientId={clientId}
                        projectId={projectId}
                        title={localizedTitle(row)}
                        disabled={!canEdit || isBusy}
                        className="w-[13.5rem] max-w-[13.5rem]"
                      />
                    </td>
                    <td className="px-3 py-2.5">{renderFormatField(row, rowFormat, "w-[9.5rem]")}</td>
                    <td className="px-3 py-2.5">{renderThemeField(row, "w-[10.5rem]")}</td>
                    <td className="px-3 py-2.5">
                      <CalendarTitleCell
                        title={localizedTitle(row)}
                        i18n={row.i18n}
                        disabled={!canEdit || isBusy}
                        onSave={(nextTitle, nextI18n) => {
                          updateMutation.mutate({
                            contentId: row.id,
                            title: nextTitle,
                            i18n: nextI18n,
                          });
                        }}
                      />
                    </td>
                    <td className="px-3 py-2.5">{renderRowActions(row)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </>
    );
  };

  const toggleBlockCollapsed = (blockId: string) => {
    setCollapsedBlockIds((prev) => {
      const next = new Set(prev);
      if (next.has(blockId)) next.delete(blockId);
      else next.add(blockId);
      writeCollapsedCalendarBlockIds(projectId, next);
      return next;
    });
  };

  const renderBlockCard = (block: CalendarBlock) => {
    const blockRows = itemsByBlock.map.get(block.id) ?? [];
    const approvedRows = blockRows.filter((row) => isApprovedContentStatus(row.status));
    const isCollapsed = collapsedBlockIds.has(block.id);
    return (
      <Card key={block.id} className="overflow-hidden rounded-xl">
        <div
          className={cn(
            "flex flex-wrap items-center justify-between gap-3 px-4 py-3",
            !isCollapsed && "border-b",
          )}
        >
          <BlockPeriodTitle
            title={block.title}
            i18n={block.i18n}
            disabled={!canEdit || isBusy}
            placeholder={t("project.calendar.blockTitlePlaceholder")}
            ariaLabel={t("project.calendar.blockTitleLabel")}
            onSave={(title, nextI18n) =>
              updateBlockTitleMutation.mutate({ blockId: block.id, title, i18n: nextI18n })
            }
          />
          <div className="flex items-center gap-1.5">
            <Button
              type="button"
              variant="outline"
              size="sm"
              title={
                isCollapsed
                  ? t("project.calendar.expandBlockHint")
                  : t("project.calendar.collapseBlockHint")
              }
              aria-expanded={!isCollapsed}
              onClick={() => toggleBlockCollapsed(block.id)}
            >
              {isCollapsed ? (
                <ChevronDown className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" />
              ) : (
                <ChevronUp className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" />
              )}
              {isCollapsed
                ? t("project.calendar.expandBlock")
                : t("project.calendar.collapseBlock")}
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={approvedRows.length === 0}
              title={
                approvedRows.length === 0
                  ? t("project.calendar.approvalsSummary.emptyHint")
                  : t("project.calendar.approvalsSummary.hint")
              }
              onClick={() => setApprovalsSummaryBlockId(block.id)}
            >
              <ClipboardList className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" />
              {t("project.calendar.approvalsSummary.button")}
              {approvedRows.length > 0 ? (
                <span className="ml-1.5 rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-medium tabular-nums text-muted-foreground">
                  {approvedRows.length}
                </span>
              ) : null}
            </Button>
            {canEdit ? (
              <>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={isBusy || blockRows.length === 0}
                  title={t("project.calendar.duplicateBlockHint")}
                  onClick={() => duplicateBlockMutation.mutate(block.id)}
                >
                  <Copy className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" />
                  {t("project.calendar.duplicateBlock")}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={isBusy}
                  className="text-destructive hover:text-destructive"
                  title={t("project.calendar.deleteBlockHint")}
                  aria-label={t("project.calendar.deleteBlock")}
                  onClick={() =>
                    setDeleteBlockTarget({
                      id: block.id,
                      title: block.title,
                      itemCount: blockRows.length,
                    })
                  }
                >
                  <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                </Button>
              </>
            ) : null}
          </div>
        </div>
        {isCollapsed ? null : blockRows.length === 0 ? (
          <p className="px-4 py-6 text-sm text-muted-foreground">{t("project.calendar.empty")}</p>
        ) : (
          renderBlockTable(block.id, blockRows)
        )}
      </Card>
    );
  };

  const approvalsSummaryBlock = approvalsSummaryBlockId
    ? blocks.find((block) => block.id === approvalsSummaryBlockId) ?? null
    : null;
  const approvalsSummaryItems = approvalsSummaryBlockId
    ? (itemsByBlock.map.get(approvalsSummaryBlockId) ?? []).filter((row) =>
        isApprovedContentStatus(row.status),
      )
    : [];
  const approvalsSummaryTitle = approvalsSummaryBlock
    ? getLocalizedText(
        parseRowI18n(approvalsSummaryBlock.i18n),
        "title",
        approvalsSummaryBlock.title,
        normalizeAppLocale(i18n.resolvedLanguage ?? i18n.language),
      )
    : "";

  const loading =
    contentQuery.isLoading || projectQuery.isLoading || (Boolean(contentQuery.data) && blocksQuery.isLoading);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-2">
          <div>
            <h2 className="text-sm font-medium">{t("project.calendar.title")}</h2>
            <p className="text-xs text-muted-foreground">
              {t("project.calendar.hint")}
              {canEdit && rows.length > 1
                ? ` ${t("project.calendar.hintReorder")}`
                : null}
            </p>
          </div>
          <ul className="flex flex-wrap gap-1.5" aria-label={t("project.calendar.columns.format")}>
            {allowedFormats.map((formatKey) => (
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

      {loading ? (
        <p className="text-sm text-muted-foreground">{t("common.loading")}</p>
      ) : contentQuery.isError ? (
        <p className="text-sm text-destructive">
          {contentQuery.error instanceof Error
            ? contentQuery.error.message
            : t("common.error")}
        </p>
      ) : rows.length === 0 ? (
        <EmptyState icon={CalendarDays} title={t("project.calendar.empty")} />
      ) : blocks.length > 0 ? (
        <div className="space-y-4">
          {blocks.map((block) => renderBlockCard(block))}
          {itemsByBlock.unassigned.length > 0 ? (
            <Card className="overflow-hidden rounded-xl">
              {renderBlockTable("__unassigned__", itemsByBlock.unassigned)}
            </Card>
          ) : null}
        </div>
      ) : (
        <Card className="overflow-hidden rounded-xl">
          {renderBlockTable("__all__", rows)}
        </Card>
      )}

      {!loading && !contentQuery.isError && showInstagramMockup ? (
        <div className="flex min-w-0 justify-center overflow-x-clip pt-4">
          <InstagramFeedMockup
            items={rows}
            clientId={clientId}
            projectId={projectId}
            username={clientQuery.data?.name}
            avatarUrl={clientQuery.data?.logo_url}
            canReorder={canEdit && rows.length > 1}
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

      <AlertDialog
        open={Boolean(deleteBlockTarget)}
        onOpenChange={(nextOpen) => {
          if (!nextOpen && !deleteBlockMutation.isPending) setDeleteBlockTarget(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("project.calendar.deleteBlockConfirmTitle")}</AlertDialogTitle>
            <AlertDialogDescription>
              {(deleteBlockTarget?.itemCount ?? 0) > 0
                ? t("project.calendar.deleteBlockConfirmDescription", {
                    title: deleteBlockTarget?.title || t("project.calendar.blockTitlePlaceholder"),
                    count: deleteBlockTarget?.itemCount ?? 0,
                  })
                : t("project.calendar.deleteBlockConfirmEmpty", {
                    title: deleteBlockTarget?.title || t("project.calendar.blockTitlePlaceholder"),
                  })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteBlockMutation.isPending}>
              {t("common.cancel")}
            </AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={deleteBlockMutation.isPending || !deleteBlockTarget}
              onClick={(e) => {
                e.preventDefault();
                if (!deleteBlockTarget) return;
                deleteBlockMutation.mutate(deleteBlockTarget.id);
              }}
            >
              {t("project.calendar.deleteBlock")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <ApprovalsSummaryDialog
        open={Boolean(approvalsSummaryBlockId)}
        onOpenChange={(open) => {
          if (!open) setApprovalsSummaryBlockId(null);
        }}
        blockTitle={approvalsSummaryTitle}
        items={approvalsSummaryItems}
      />
    </div>
  );
}
