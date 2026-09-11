import { useEffect, useMemo, useRef, useState, type PointerEvent, type ReactNode } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { format, isSameMonth, isToday } from "date-fns";
import { ptBR, enUS, es } from "date-fns/locale";
import {
  CalendarDays,
  ChevronDown,
  ChevronUp,
  ClipboardList,
  Copy,
  ExternalLink,
  GripVertical,
  List,
  Play,
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
import {
  MediaLightbox,
  type PreviewMediaItem,
} from "@/components/content-media-preview";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { ContentStatusSelect } from "@/components/content-status-select";
import { ContentFormatSelect } from "@/components/content-format-select";
import { StatusBadge, type ContentStatus } from "@/components/status-badge";
import {
  contentFormatRowStyles,
  contentFormatStyles,
} from "@/components/content-format-styles";
import {
  GraphicArtsMaterialFields,
  parseCmInput,
} from "@/components/graphic-arts-material-fields";
import { InstagramFeedMockup } from "@/components/instagram-feed-mockup";
import { YouTubeChannelMockup } from "@/components/youtube-notebook-mockup";
import {
  addProjectThemePreset,
  buildProjectReviewUrl,
  buildWhatsAppNotifyUrl,
  canManageClient,
  claimClientAccess,
  contentFormatsForProject,
  createContent,
  deleteContent,
  duplicateCalendarBlock,
  deleteCalendarBlock,
  duplicateContent,
  defaultContentFormatForProject,
  ensureCalendarBlocks,
  getClient,
  getGraphicArtsMaterialPreset,
  getPrimaryProjectCategory,
  listContent,
  getProject,
  getLocalizedText,
  getLocalizedPresetList,
  isPlayableVideoUrl,
  isVideoUrl,
  normalizeAppLocale,
  parseRowI18n,
  projectCategoryConfig,
  reorderContentItems,
  resolveContentMediaUrls,
  resolveContentThumbnail,
  updateCalendarBlockTitle,
  updateContentCalendar,
  type CalendarBlock,
  type ContentFormat,
  type ContentItem,
  type GraphicArtsMaterialType,
} from "@/lib/api";
import {
  buildLocalizedFieldFromSource,
  getCanonicalText,
  setLocalizedField,
  translateTextField,
  type RowI18n,
} from "@/lib/i18n-content";
import {
  readCollapsedCalendarBlockIds,
  writeCollapsedCalendarBlockIds,
} from "@/lib/calendar-block-collapsed";
import {
  buildCalendarMonthModel,
  localDayKey,
} from "@/lib/calendar-month-grid";
import {
  readCalendarViewMode,
  writeCalendarViewMode,
  type CalendarViewMode,
} from "@/lib/calendar-view-mode";
import {
  rescheduleItemsToWeekdayPattern,
  scheduledAtChanged,
  parseScheduledDate,
} from "@/lib/calendar-weekday-pattern";
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

function lastScheduledDate(items: ContentItem[]): Date | null {
  let latest: Date | null = null;
  for (const item of items) {
    const date = parseScheduledDate(item.scheduled_at);
    if (!date) continue;
    if (!latest || date > latest) latest = date;
  }
  return latest;
}

function calendarBlockIdForKey(blockKey: string): string | null {
  if (blockKey === "__unassigned__" || blockKey === "__all__") return null;
  return blockKey;
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
  className,
}: {
  title: string;
  i18n?: unknown;
  disabled: boolean;
  onSave: (title: string, rowI18n: RowI18n) => void;
  className?: string;
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
      className={cn("h-8 w-full min-w-0 font-medium md:min-w-[12rem]", className)}
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

function previewItemsForContent(item: ContentItem): PreviewMediaItem[] {
  const urls = resolveContentMediaUrls(item);
  if (urls.length > 0) {
    return urls.map((url) => ({
      url,
      kind: isPlayableVideoUrl(url) ? "video" : "image",
    }));
  }
  const thumb = item.thumbnail_url?.trim();
  if (!thumb) return [];
  return [{ url: thumb, kind: isPlayableVideoUrl(thumb) ? "video" : "image" }];
}

function CalendarLayoutThumb({
  item,
  sizeClass,
  expandLabel,
  onOpen,
}: {
  item: ContentItem;
  sizeClass: string;
  expandLabel: string;
  onOpen: (item: ContentItem) => void;
}) {
  const thumb = resolveContentThumbnail(item);
  const canOpen = previewItemsForContent(item).length > 0;
  const video = Boolean(thumb && isVideoUrl(thumb));
  const frame = cn(sizeClass, "overflow-hidden rounded-md bg-muted");

  const media = thumb ? (
    video ? (
      <video
        src={thumb}
        muted
        playsInline
        preload="metadata"
        className="h-full w-full object-cover"
      />
    ) : (
      <img src={thumb} alt="" className="h-full w-full object-cover" />
    )
  ) : null;

  if (!canOpen) {
    return <div className={cn(frame, "shrink-0")} />;
  }

  return (
    <button
      type="button"
      onClick={() => onOpen(item)}
      aria-label={expandLabel}
      className={cn(
        frame,
        "relative shrink-0 cursor-zoom-in outline-none ring-offset-background focus-visible:ring-2 focus-visible:ring-ring",
      )}
    >
      {media}
      {video ? (
        <span className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/25">
          <Play className="h-3 w-3 text-white" aria-hidden="true" />
        </span>
      ) : null}
    </button>
  );
}

function MonthItemCell({
  row,
  index,
  blockKey,
  canReorder,
  isDragging,
  isDropTarget,
  canEdit,
  isBusy,
  clientId,
  projectId,
  localizedTitle,
  onOpen,
  onHandlePointerDown,
  onSaveTitle,
  renderDatetimeField,
  renderFormatField,
  renderThemeField,
  renderRowActions,
}: {
  row: ContentItem;
  index: number;
  blockKey: string;
  canReorder: boolean;
  isDragging: boolean;
  isDropTarget: boolean;
  canEdit: boolean;
  isBusy: boolean;
  clientId: string;
  projectId: string;
  localizedTitle: string;
  onOpen: (item: ContentItem) => void;
  onHandlePointerDown: (blockKey: string, index: number) => (event: PointerEvent<HTMLElement>) => void;
  onSaveTitle: (title: string, rowI18n: RowI18n) => void;
  renderDatetimeField: (row: ContentItem, className?: string) => ReactNode;
  renderFormatField: (row: ContentItem, rowFormat: ContentFormat, className?: string) => ReactNode;
  renderThemeField: (row: ContentItem, className?: string) => ReactNode;
  renderRowActions: (row: ContentItem, compact?: boolean) => ReactNode;
}) {
  const { t, i18n } = useTranslation();
  const locale = dateLocales[(i18n.language as LanguageCode) ?? "pt-BR"] ?? ptBR;
  const [detailsOpen, setDetailsOpen] = useState(false);
  const scheduled = parseScheduledDate(row.scheduled_at);
  const rowFormat = (row.format ?? "static_feed") as ContentFormat;
  const dateLabel = scheduled ? format(scheduled, "dd/MM", { locale }) : "—";
  const timeLabel = scheduled ? format(scheduled, "HH:mm", { locale }) : null;

  return (
    <div
      data-calendar-drop=""
      data-calendar-block={blockKey}
      data-calendar-index={index}
      className={cn(
        contentFormatRowStyles[rowFormat],
        "space-y-1.5 rounded-md border p-1.5",
        isDragging && "opacity-50",
        isDropTarget && "bg-muted",
      )}
    >
      <div className="flex items-center gap-1">
        {canReorder ? (
          <span
            onPointerDown={onHandlePointerDown(blockKey, index)}
            className="inline-flex shrink-0 cursor-grab touch-none select-none p-0.5 text-foreground/55 hover:text-foreground active:cursor-grabbing [&_svg]:pointer-events-none"
            aria-label={t("project.calendar.dragHandle")}
            title={t("project.calendar.dragHandle")}
            role="button"
            tabIndex={0}
          >
            <GripVertical className="h-3.5 w-3.5" aria-hidden="true" />
          </span>
        ) : null}
        <p className="flex min-w-0 flex-1 items-baseline justify-between gap-1 text-[11px] font-semibold tabular-nums">
          <span>{dateLabel}</span>
          {timeLabel ? (
            <span className="font-medium text-muted-foreground">{timeLabel}</span>
          ) : null}
        </p>
      </div>
      <CalendarLayoutThumb
        item={row}
        sizeClass="aspect-square w-full"
        expandLabel={t("project.detail.expandMedia")}
        onOpen={onOpen}
      />
      <div className="flex flex-col gap-1">
        <StatusBadge
          status={row.status as ContentStatus}
          className="w-full justify-center rounded-md px-1.5 py-0.5 text-[10px] leading-tight"
        />
        <span
          className={cn(
            "inline-flex w-full items-center justify-center truncate rounded-md border px-1.5 py-0.5 text-[10px] font-medium leading-tight",
            contentFormatStyles[rowFormat],
          )}
        >
          {t(`project.detail.formats.${rowFormat}`)}
        </span>
      </div>
      <Collapsible open={detailsOpen} onOpenChange={setDetailsOpen}>
        <CollapsibleTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 w-full px-1 text-muted-foreground"
            title={
              detailsOpen
                ? t("project.calendar.itemDetailsHide")
                : t("project.calendar.itemDetails")
            }
            aria-label={
              detailsOpen
                ? t("project.calendar.itemDetailsHide")
                : t("project.calendar.itemDetails")
            }
          >
            <ChevronDown
              className={cn("h-4 w-4 transition-transform", detailsOpen && "rotate-180")}
              aria-hidden="true"
            />
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent className="space-y-2 pt-1">
          <span className="text-xs text-muted-foreground">{index + 1}</span>
          <CalendarTitleCell
            title={localizedTitle}
            i18n={row.i18n}
            disabled={!canEdit || isBusy}
            className="md:min-w-0"
            onSave={onSaveTitle}
          />
          {renderDatetimeField(row, "w-full")}
          <ContentStatusSelect
            status={row.status as ContentStatus}
            contentId={row.id}
            clientId={clientId}
            projectId={projectId}
            title={localizedTitle}
            disabled={!canEdit || isBusy}
            className="w-full max-w-none"
          />
          {renderFormatField(row, rowFormat, "w-full")}
          {renderThemeField(row, "w-full")}
          {renderRowActions(row, true)}
        </CollapsibleContent>
      </Collapsible>
    </div>
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
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newFormat, setNewFormat] = useState<ContentFormat>("static_feed");
  const posterPreset = getGraphicArtsMaterialPreset("poster");
  const [newMaterialType, setNewMaterialType] = useState<GraphicArtsMaterialType>("poster");
  const [newWidthCm, setNewWidthCm] = useState(String(posterPreset.widthCm));
  const [newHeightCm, setNewHeightCm] = useState(String(posterPreset.heightCm));
  const [newScheduledLocal, setNewScheduledLocal] = useState("");
  const [newBlockId, setNewBlockId] = useState("");
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
  const [monthExpandedBlockIds, setMonthExpandedBlockIds] = useState<Set<string>>(
    () => new Set(),
  );
  const [viewMode, setViewMode] = useState<CalendarViewMode>(() =>
    readCalendarViewMode(projectId),
  );
  const [approvalsSummaryBlockId, setApprovalsSummaryBlockId] = useState<string | null>(null);
  const [lightbox, setLightbox] = useState<{
    items: PreviewMediaItem[];
    title: string;
  } | null>(null);

  useEffect(() => {
    setCollapsedBlockIds(readCollapsedCalendarBlockIds(projectId));
    setViewMode(readCalendarViewMode(projectId));
    setMonthExpandedBlockIds(new Set());
  }, [projectId]);

  const changeViewMode = (mode: CalendarViewMode) => {
    setViewMode(mode);
    writeCalendarViewMode(projectId, mode);
  };

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
  const openMediaLightbox = (item: ContentItem) => {
    const items = previewItemsForContent(item);
    if (items.length === 0) return;
    setLightbox({ items, title: localizedTitle(item) });
  };
  const allowedFormats = contentFormatsForProject(projectQuery.data?.categories);
  const isGraphicArts =
    getPrimaryProjectCategory(projectQuery.data?.categories) === "graphic_arts";
  const isVideos = getPrimaryProjectCategory(projectQuery.data?.categories) === "videos";
  const showFeedMockup = projectCategoryConfig(projectQuery.data?.categories).tabs.includes("feed");
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

  const openCreateDialog = () => {
    const preset = getGraphicArtsMaterialPreset("poster");
    setNewTitle("");
    setNewFormat(
      allowedFormats[0] ?? defaultContentFormatForProject(projectQuery.data?.categories),
    );
    setNewMaterialType("poster");
    setNewWidthCm(String(preset.widthCm));
    setNewHeightCm(String(preset.heightCm));
    setNewScheduledLocal("");
    setNewBlockId(blocks.at(-1)?.id ?? "");
    setCreateOpen(true);
  };

  const resetCreateForm = () => {
    const preset = getGraphicArtsMaterialPreset("poster");
    setNewTitle("");
    setNewFormat(
      allowedFormats[0] ?? defaultContentFormatForProject(projectQuery.data?.categories),
    );
    setNewMaterialType("poster");
    setNewWidthCm(String(preset.widthCm));
    setNewHeightCm(String(preset.heightCm));
    setNewScheduledLocal("");
    setNewBlockId(blocks.at(-1)?.id ?? "");
  };

  const createMutation = useMutation({
    mutationFn: createContent,
    onSuccess: (row) => {
      queryClient.invalidateQueries({ queryKey: ["content", projectId] });
      queryClient.invalidateQueries({ queryKey: ["calendar-blocks", projectId] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      setCreateOpen(false);
      resetCreateForm();
      toast.success(t("project.content.created"));
      void navigate({
        to: "/clients/$clientId/projects/$projectId/content/$contentId",
        params: { clientId, projectId, contentId: row.id },
        search: {},
      });
    },
    onError: (err: Error) => toast.error(err.message),
  });

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
    const previousById = new Map(rows.map((item) => [item.id, item]));
    reorderMutation.mutate(
      next.map((item, sort_order) => {
        const payload: {
          id: string;
          sort_order: number;
          scheduled_at?: string | null;
          calendar_block_id?: string | null;
        } = {
          id: item.id,
          sort_order,
        };
        const previous = previousById.get(item.id);
        if (previous && previous.scheduled_at !== item.scheduled_at) {
          payload.scheduled_at = item.scheduled_at;
        }
        if (previous && previous.calendar_block_id !== item.calendar_block_id) {
          payload.calendar_block_id = item.calendar_block_id;
        }
        return payload;
      }),
    );
  };

  const itemsForKey = (blockKey: string) => {
    if (blockKey === "__unassigned__") return itemsByBlock.unassigned;
    if (blockKey === "__all__") return rows;
    return itemsByBlock.map.get(blockKey) ?? [];
  };

  const applyBlockUpdates = (updates: Record<string, ContentItem[]>) => {
    if (blocks.length === 0) {
      applyReorder(updates.__all__ ?? Object.values(updates)[0] ?? rows);
      return;
    }
    const nextFull: ContentItem[] = [];
    for (const block of blocks) {
      nextFull.push(...(updates[block.id] ?? itemsByBlock.map.get(block.id) ?? []));
    }
    nextFull.push(...(updates.__unassigned__ ?? itemsByBlock.unassigned));
    applyReorder(nextFull);
  };

  const commitReorder = (fromBlock: string, fromIndex: number, toBlock: string, toIndex: number) => {
    const sourceItems = itemsForKey(fromBlock);
    const destItems = itemsForKey(toBlock);
    if (fromIndex < 0 || fromIndex >= sourceItems.length) return;

    const historyIso = rows.map((row) => row.scheduled_at);

    if (fromBlock === toBlock) {
      if (sourceItems.length < 2) return;
      const targetIndex = Math.min(Math.max(toIndex, 0), sourceItems.length - 1);
      const next = moveItem(sourceItems, fromIndex, targetIndex);
      if (next === sourceItems) return;
      const rescheduled = rescheduleItemsToWeekdayPattern(next, historyIso);
      applyBlockUpdates({ [toBlock]: rescheduled });
      if (scheduledAtChanged(next, rescheduled)) {
        toast.success(t("project.calendar.datesUpdatedFromPattern"));
      }
      return;
    }

    const moved = sourceItems[fromIndex];
    const nextSource = sourceItems.filter((_, itemIndex) => itemIndex !== fromIndex);
    const insertAt = Math.min(Math.max(toIndex, 0), destItems.length);
    const nextDest = [...destItems];
    nextDest.splice(insertAt, 0, {
      ...moved,
      calendar_block_id: calendarBlockIdForKey(toBlock),
    });

    const orderedKeys =
      blocks.length > 0 ? [...blocks.map((block) => block.id), "__unassigned__"] : ["__all__"];
    const destPos = orderedKeys.indexOf(toBlock);
    let fallbackAnchor = lastScheduledDate(destItems);
    if (!fallbackAnchor && destPos > 0) {
      for (let i = destPos - 1; i >= 0; i--) {
        fallbackAnchor = lastScheduledDate(itemsForKey(orderedKeys[i]));
        if (fallbackAnchor) break;
      }
    }

    const rescheduledDest = rescheduleItemsToWeekdayPattern(nextDest, historyIso, {
      excludeIndexes: [insertAt],
      fallbackAnchor,
    });
    applyBlockUpdates({
      [fromBlock]: nextSource,
      [toBlock]: rescheduledDest,
    });
    toast.success(t("project.calendar.movedToBlock"));
  };

  const dragRef = useRef<{ blockKey: string; index: number } | null>(null);
  const dropRef = useRef<{ blockKey: string; index: number } | null>(null);
  const commitRef = useRef(commitReorder);
  commitRef.current = commitReorder;
  dragRef.current = dragState;
  dropRef.current = dropState;

  const readDropTarget = (clientX: number, clientY: number) => {
    const el = document.elementFromPoint(clientX, clientY);
    const target = el?.closest("[data-calendar-drop]") as HTMLElement | null;
    if (!target) return null;
    const blockKey = target.dataset.calendarBlock;
    const index = Number(target.dataset.calendarIndex);
    if (!blockKey || !Number.isFinite(index)) return null;
    return { blockKey, index };
  };

  const onHandlePointerDown = (blockKey: string, index: number) => (event: PointerEvent<HTMLElement>) => {
    if (event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();
    const next = { blockKey, index };
    dragRef.current = next;
    dropRef.current = next;
    setDragState(next);
    setDropState(next);

    const previousCursor = document.body.style.cursor;
    const previousUserSelect = document.body.style.userSelect;
    document.body.style.cursor = "grabbing";
    document.body.style.userSelect = "none";

    const onMove = (moveEvent: globalThis.PointerEvent) => {
      const target = readDropTarget(moveEvent.clientX, moveEvent.clientY);
      if (!target) return;
      const current = dropRef.current;
      if (current?.blockKey === target.blockKey && current.index === target.index) return;
      dropRef.current = target;
      setDropState(target);
    };

    const onUp = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
      document.body.style.cursor = previousCursor;
      document.body.style.userSelect = previousUserSelect;
      const from = dragRef.current;
      const to = dropRef.current;
      dragRef.current = null;
      dropRef.current = null;
      setDragState(null);
      setDropState(null);
      if (!from || !to) return;
      if (from.blockKey === to.blockKey && from.index === to.index) return;
      commitRef.current(from.blockKey, from.index, to.blockKey, to.index);
    };

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
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

  const renderRowActions = (row: ContentItem, compact = false) => (
    <div className={cn("flex flex-wrap items-center gap-1.5", !compact && "md:justify-end")}>
      <Button
        asChild
        variant="outline"
        size={compact ? "icon" : "sm"}
        className={compact ? "h-8 w-8" : undefined}
        title={t("project.calendar.access")}
      >
        <Link
          to="/clients/$clientId/projects/$projectId/content/$contentId"
          params={{ clientId, projectId, contentId: row.id }}
          search={{}}
        >
          <ExternalLink className={cn("h-3.5 w-3.5", !compact && "mr-1.5")} aria-hidden="true" />
          {compact ? <span className="sr-only">{t("project.calendar.access")}</span> : t("project.calendar.access")}
        </Link>
      </Button>
      {canEdit ? (
        <>
          <Button
            type="button"
            variant="outline"
            size={compact ? "icon" : "sm"}
            className={compact ? "h-8 w-8" : undefined}
            disabled={isBusy}
            title={t("project.calendar.duplicateHint")}
            onClick={() => duplicateMutation.mutate(row.id)}
          >
            <Copy className={cn("h-3.5 w-3.5", !compact && "mr-1.5")} aria-hidden="true" />
            {compact ? (
              <span className="sr-only">{t("project.calendar.duplicate")}</span>
            ) : (
              t("project.calendar.duplicate")
            )}
          </Button>
          <Button
            type="button"
            variant="outline"
            size={compact ? "icon" : "sm"}
            disabled={isBusy}
            className={cn("text-destructive hover:text-destructive", compact && "h-8 w-8")}
            title={t("project.calendar.deleteHint")}
            onClick={() => setDeleteTarget({ id: row.id, title: localizedTitle(row) })}
          >
            <Trash2 className={cn("h-3.5 w-3.5", !compact && "mr-1.5")} aria-hidden="true" />
            {compact ? (
              <span className="sr-only">{t("project.calendar.delete")}</span>
            ) : (
              t("project.calendar.delete")
            )}
          </Button>
        </>
      ) : null}
    </div>
  );

  const renderBlockTable = (blockKey: string, blockRows: ContentItem[]) => {
    const canReorder = canEdit && rows.length > 1;
    const isDroppingAtEnd =
      dropState?.blockKey === blockKey && dropState.index === blockRows.length && dragState !== null;

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
                data-calendar-drop=""
                data-calendar-block={blockKey}
                data-calendar-index={index}
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
                        onPointerDown={onHandlePointerDown(blockKey, index)}
                        className="inline-flex cursor-grab touch-none select-none p-1 text-foreground/55 hover:text-foreground active:cursor-grabbing [&_svg]:pointer-events-none"
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
                  <CalendarLayoutThumb
                    item={row}
                    sizeClass="h-12 w-12"
                    expandLabel={t("project.detail.expandMedia")}
                    onOpen={openMediaLightbox}
                  />
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
          {canReorder ? (
            <div
              data-calendar-drop=""
              data-calendar-block={blockKey}
              data-calendar-index={blockRows.length}
              className={cn(
                "rounded-lg border border-dashed px-3 py-4 text-center text-xs text-muted-foreground",
                !dragState && "hidden",
                isDroppingAtEnd && "border-foreground/30 bg-muted text-foreground",
              )}
            >
              {t("project.calendar.dropAtEnd")}
            </div>
          ) : null}
        </div>

        <div className="hidden md:block">
          <table className="w-full min-w-[1040px] text-sm">
            <thead className="bg-muted/50 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-3 py-3">#</th>
                <th className="px-3 py-3">{t("project.calendar.columns.day")}</th>
                <th className="px-3 py-3">{t("project.calendar.columns.datetime")}</th>
                <th className="px-3 py-3">{t("project.calendar.columns.status")}</th>
                <th className="px-3 py-3">{t("project.calendar.columns.format")}</th>
                <th className="px-3 py-3">{t("project.calendar.columns.layout")}</th>
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
                    data-calendar-drop=""
                    data-calendar-block={blockKey}
                    data-calendar-index={index}
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
                            onPointerDown={onHandlePointerDown(blockKey, index)}
                            className="inline-flex shrink-0 cursor-grab touch-none select-none p-1 text-foreground/55 hover:text-foreground active:cursor-grabbing [&_svg]:pointer-events-none"
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
                    <td className="px-3 py-2.5">
                      <CalendarLayoutThumb
                        item={row}
                        sizeClass="h-10 w-10"
                        expandLabel={t("project.detail.expandMedia")}
                        onOpen={openMediaLightbox}
                      />
                    </td>
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
              {canReorder ? (
                <tr
                  data-calendar-drop=""
                  data-calendar-block={blockKey}
                  data-calendar-index={blockRows.length}
                  className={cn(!dragState && "hidden", isDroppingAtEnd && "bg-muted")}
                >
                  <td
                    colSpan={9}
                    className="px-3 py-3 text-center text-xs text-muted-foreground"
                  >
                    {t("project.calendar.dropAtEnd")}
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </>
    );
  };

  const renderMonthItemCell = (blockKey: string, entry: { item: ContentItem; index: number }) => (
    <MonthItemCell
      key={entry.item.id}
      row={entry.item}
      index={entry.index}
      blockKey={blockKey}
      canReorder={canEdit && rows.length > 1}
      isDragging={dragState?.blockKey === blockKey && dragState.index === entry.index}
      isDropTarget={
        dropState?.blockKey === blockKey &&
        dropState.index === entry.index &&
        dragState !== null &&
        !(dragState.blockKey === blockKey && dragState.index === entry.index)
      }
      canEdit={canEdit}
      isBusy={isBusy}
      clientId={clientId}
      projectId={projectId}
      localizedTitle={localizedTitle(entry.item)}
      onOpen={openMediaLightbox}
      onHandlePointerDown={onHandlePointerDown}
      onSaveTitle={(nextTitle, nextI18n) => {
        updateMutation.mutate({
          contentId: entry.item.id,
          title: nextTitle,
          i18n: nextI18n,
        });
      }}
      renderDatetimeField={renderDatetimeField}
      renderFormatField={renderFormatField}
      renderThemeField={renderThemeField}
      renderRowActions={renderRowActions}
    />
  );

  const renderBlockMonthGrid = (blockKey: string, blockRows: ContentItem[]) => {
    const canReorder = canEdit && rows.length > 1;
    const isDroppingAtEnd =
      dropState?.blockKey === blockKey && dropState.index === blockRows.length && dragState !== null;
    const model = buildCalendarMonthModel(blockRows, locale);

    return (
      <div className="space-y-4 p-3">
        {model.unscheduled.length > 0 ? (
          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground">
              {t("project.calendar.unscheduled")}
            </p>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-7">
              {model.unscheduled.map((entry) => renderMonthItemCell(blockKey, entry))}
            </div>
          </div>
        ) : null}

        {model.months.map(({ month, weeks }) => (
          <div key={localDayKey(month)} className="min-w-0 space-y-2">
            <h3 className="text-sm font-semibold capitalize">
              {format(month, "LLLL yyyy", { locale })}
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] table-fixed border-collapse text-sm">
                <thead>
                  <tr>
                    {model.weekdays.map((weekday) => (
                      <th
                        key={weekday.toISOString()}
                        className="border-b px-1 py-2 text-center text-[11px] font-medium uppercase tracking-wide text-muted-foreground"
                      >
                        {format(weekday, "EEE", { locale })}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {weeks.map((week) => (
                    <tr key={localDayKey(week[0])}>
                      {week.map((day) => {
                        const inMonth = isSameMonth(day, month);
                        const posts = inMonth ? (model.byDay.get(localDayKey(day)) ?? []) : [];
                        return (
                          <td
                            key={localDayKey(day)}
                            className={cn(
                              "align-top border border-border/70 p-0",
                              "min-w-[6.5rem]",
                              !inMonth && "bg-muted/40",
                              inMonth && isToday(day) && "bg-primary/5",
                            )}
                          >
                            <div className="min-h-[7rem] p-1">
                              <div
                                className={cn(
                                  "mb-1 text-right text-[11px] tabular-nums",
                                  inMonth && isToday(day)
                                    ? "font-semibold text-foreground"
                                    : "text-muted-foreground",
                                  !inMonth && "text-muted-foreground/50",
                                )}
                              >
                                {format(day, "d")}
                              </div>
                              <div className="space-y-1.5">
                                {posts.map((entry) => renderMonthItemCell(blockKey, entry))}
                              </div>
                            </div>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ))}

        {canReorder ? (
          <div
            data-calendar-drop=""
            data-calendar-block={blockKey}
            data-calendar-index={blockRows.length}
            className={cn(
              "rounded-lg border border-dashed px-3 py-4 text-center text-xs text-muted-foreground",
              !dragState && "hidden",
              isDroppingAtEnd && "border-foreground/30 bg-muted text-foreground",
            )}
          >
            {t("project.calendar.dropAtEnd")}
          </div>
        ) : null}
      </div>
    );
  };

  const renderBlockItems = (blockKey: string, blockRows: ContentItem[]) =>
    viewMode === "month"
      ? renderBlockMonthGrid(blockKey, blockRows)
      : renderBlockTable(blockKey, blockRows);

  const toggleBlockCollapsed = (blockId: string) => {
    if (viewMode === "month") {
      setMonthExpandedBlockIds((prev) => {
        const next = new Set(prev);
        if (next.has(blockId)) next.delete(blockId);
        else next.add(blockId);
        return next;
      });
      return;
    }
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
    const isCollapsed =
      viewMode === "month"
        ? !monthExpandedBlockIds.has(block.id)
        : collapsedBlockIds.has(block.id);
    const canMoveItems = canEdit && rows.length > 1;
    const isDropTarget =
      dropState?.blockKey === block.id &&
      dragState !== null &&
      dragState.blockKey !== block.id;
    return (
      <Card
        key={block.id}
        className={cn(
          "rounded-xl",
          isCollapsed && isDropTarget && "ring-2 ring-foreground/20",
        )}
      >
        <div
          className={cn(
            "flex flex-wrap items-center justify-between gap-3 px-4 py-3",
            !isCollapsed && "border-b",
          )}
          {...(canMoveItems && isCollapsed
            ? {
                "data-calendar-drop": "",
                "data-calendar-block": block.id,
                "data-calendar-index": String(blockRows.length),
              }
            : {})}
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
          <div className="flex flex-wrap items-center justify-end gap-1.5">
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
          <p
            {...(canMoveItems
              ? {
                  "data-calendar-drop": "",
                  "data-calendar-block": block.id,
                  "data-calendar-index": "0",
                }
              : {})}
            className={cn(
              "px-4 py-6 text-sm text-muted-foreground",
              isDropTarget && dropState?.index === 0 && "bg-muted",
            )}
          >
            {dragState && dragState.blockKey !== block.id
              ? t("project.calendar.dropInBlock")
              : t("project.calendar.empty")}
          </p>
        ) : (
          renderBlockItems(block.id, blockRows)
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
        <div className="flex flex-wrap items-center justify-end gap-2">
          {canEdit ? (
            <>
              <Button type="button" size="sm" onClick={openCreateDialog}>
                <Plus className="mr-1.5 h-4 w-4" aria-hidden="true" />
                {t("project.content.new")}
              </Button>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                disabled={clientQuery.isLoading || projectQuery.isLoading}
                onClick={handleSendUpdates}
              >
                {t("project.calendar.sendUpdates")}
              </Button>
            </>
          ) : null}
          <div
            className="inline-flex rounded-md border bg-background p-0.5"
            role="group"
            aria-label={t("project.calendar.viewMode")}
          >
            <Button
              type="button"
              variant={viewMode === "list" ? "secondary" : "ghost"}
              size="sm"
              className="h-8"
              aria-pressed={viewMode === "list"}
              title={t("project.calendar.viewListHint")}
              onClick={() => changeViewMode("list")}
            >
              <List className="mr-1.5 h-4 w-4" aria-hidden="true" />
              {t("project.calendar.viewList")}
            </Button>
            <Button
              type="button"
              variant={viewMode === "month" ? "secondary" : "ghost"}
              size="sm"
              className="h-8"
              aria-pressed={viewMode === "month"}
              title={t("project.calendar.viewMonthHint")}
              onClick={() => changeViewMode("month")}
            >
              <CalendarDays className="mr-1.5 h-4 w-4" aria-hidden="true" />
              {t("project.calendar.viewMonth")}
            </Button>
          </div>
        </div>
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
        <EmptyState
          icon={CalendarDays}
          title={t("project.calendar.empty")}
          description={canEdit ? t("project.calendar.emptyCreateHint") : undefined}
          onClick={canEdit ? openCreateDialog : undefined}
        />
      ) : blocks.length > 0 ? (
        <div className="min-w-0 space-y-4">
          {blocks.map((block) => renderBlockCard(block))}
          {itemsByBlock.unassigned.length > 0 ? (
            <Card className="rounded-xl">
              {renderBlockItems("__unassigned__", itemsByBlock.unassigned)}
            </Card>
          ) : null}
        </div>
      ) : (
        <Card className="rounded-xl">
          {renderBlockItems("__all__", rows)}
        </Card>
      )}

      {!loading && !contentQuery.isError && showFeedMockup ? (
        <div className="flex min-w-0 justify-center overflow-x-clip pt-4">
          {isVideos ? (
            <YouTubeChannelMockup
              items={rows}
              clientId={clientId}
              projectId={projectId}
              username={clientQuery.data?.name}
              avatarUrl={clientQuery.data?.logo_url}
            />
          ) : (
            <InstagramFeedMockup
              items={rows}
              clientId={clientId}
              projectId={projectId}
              username={clientQuery.data?.name}
              avatarUrl={clientQuery.data?.logo_url}
              canReorder={canEdit && rows.length > 1}
              onReorder={applyReorder}
            />
          )}
        </div>
      ) : null}

      <Dialog
        open={createOpen}
        onOpenChange={(open) => {
          if (!open && createMutation.isPending) return;
          setCreateOpen(open);
          if (!open) resetCreateForm();
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
              if (!newTitle.trim()) return;
              const scheduledAt = fromDatetimeLocalValue(newScheduledLocal);
              const calendarBlockId = newBlockId || undefined;
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
                  title: newTitle.trim(),
                  format: "print_material",
                  materialType: newMaterialType,
                  widthCm: width,
                  heightCm: height,
                  scheduledAt,
                  calendarBlockId,
                });
                return;
              }
              createMutation.mutate({
                projectId,
                clientId,
                title: newTitle.trim(),
                format: newFormat,
                scheduledAt,
                calendarBlockId,
              });
            }}
          >
            <div className="space-y-1.5">
              <Label htmlFor="calendar-content-title">{t("project.content.title")}</Label>
              <Input
                id="calendar-content-title"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
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
                idPrefix="calendar-create"
                materialType={newMaterialType}
                widthCm={newWidthCm}
                heightCm={newHeightCm}
                onMaterialTypeChange={setNewMaterialType}
                onWidthCmChange={setNewWidthCm}
                onHeightCmChange={setNewHeightCm}
              />
            ) : null}
            <div className="space-y-1.5">
              <Label htmlFor="calendar-content-datetime">
                {t("project.calendar.columns.datetime")}
              </Label>
              <Input
                id="calendar-content-datetime"
                type="datetime-local"
                value={newScheduledLocal}
                onChange={(e) => setNewScheduledLocal(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                {t("project.calendar.datetimeHint")}
              </p>
            </div>
            {blocks.length > 1 ? (
              <div className="space-y-1.5">
                <Label>{t("project.calendar.selectPeriod")}</Label>
                <Select value={newBlockId || undefined} onValueChange={setNewBlockId}>
                  <SelectTrigger>
                    <SelectValue placeholder={t("project.calendar.selectPeriod")} />
                  </SelectTrigger>
                  <SelectContent>
                    {blocks.map((block) => {
                      const label =
                        getLocalizedText(
                          parseRowI18n(block.i18n),
                          "title",
                          block.title,
                          uiLocale,
                        ).trim() || t("project.calendar.untitledPeriod");
                      return (
                        <SelectItem key={block.id} value={block.id}>
                          {label}
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              </div>
            ) : null}
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setCreateOpen(false)}
                disabled={createMutation.isPending}
              >
                {t("common.cancel")}
              </Button>
              <Button
                type="submit"
                loading={createMutation.isPending}
                loadingLabel={t("common.saving")}
                disabled={!newTitle.trim()}
              >
                {t("common.save")}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

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

      <MediaLightbox
        open={Boolean(lightbox)}
        onOpenChange={(nextOpen) => {
          if (!nextOpen) setLightbox(null);
        }}
        items={lightbox?.items ?? []}
        title={lightbox?.title ?? ""}
      />

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
