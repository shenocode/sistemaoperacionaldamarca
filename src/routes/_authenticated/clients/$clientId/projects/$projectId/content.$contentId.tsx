import { useEffect, useMemo, useRef, useState, type DragEvent } from "react";
import { createFileRoute, Link, Navigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { format, formatDistanceToNow } from "date-fns";
import { ptBR, enUS, es } from "date-fns/locale";
import {
  ChevronLeft,
  Eye,
  GripVertical,
  Plus,
  Save,
  History,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  StatusBadge,
  contentStatusStyles,
  type ContentStatus,
} from "@/components/status-badge";
import { CONTENT_STATUSES } from "@/components/content-status-select";
import { ContentFormatSelect } from "@/components/content-format-select";
import {
  GraphicArtsMaterialFields,
  parseCmInput,
} from "@/components/graphic-arts-material-fields";
import {
  ContentMediaPreview,
  guessMediaKind,
  type PreviewMediaItem,
} from "@/components/content-media-preview";
import { ContentAiAssistant } from "@/components/content-ai-assistant";
import { ContentDesignAssistant } from "@/components/content-design-assistant";
import { ContentMediaLibraryPicker } from "@/components/content-media-library-picker";
import { InstagramFeedMockup } from "@/components/instagram-feed-mockup";
import { YouTubeChannelMockup } from "@/components/youtube-notebook-mockup";
import { CommentComposer, CommentThreadItem } from "@/components/comment-composer";
import { PresetField } from "@/components/preset-field";
import { UnsavedChangesGuard } from "@/components/unsaved-changes-guard";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
  CONTENT_MEDIA_ACCEPT,
  CLIENT_LOGO_ACCEPT,
  CONTENT_TAB_ENABLED,
  addComment,
  addProjectTextPreset,
  addProjectThemePreset,
  canManageClient,
  contentFormatsForProject,
  defaultContentFormatForProject,
  deleteComment,
  getClient,
  getContent,
  getGraphicArtsMaterialPreset,
  getPrimaryProjectCategory,
  getProject,
  listContent,
  projectCategoryConfig,
  GRAPHIC_ARTS_MATERIAL_TYPES,
  contentUsesDedicatedThumbnail,
  isPrintMaterialFormat,
  isReelsFormat,
  listComments,
  listVersions,
  resolveContentMediaUrls,
  restoreVersion,
  saveClientContentVersion,
  saveContentAsNewVersion,
  setContentStatus,
  updateContentFields,
  updateContentI18n,
  updateComment,
  uploadCommentAudio,
  uploadContentMedia,
  uploadContentMediaFiles,
  getLocalizedText,
  getCanonicalText,
  getLocalizedPresetList,
  parseRowI18n,
  normalizeAppLocale,
  setLocalizedField,
  mergeRowI18n,
  translateTextField,
  translateManyFields,
  buildLocalizedFieldFromSource,
  buildVerbatimLocalizedField,
  isLocalizedField,
  type ContentFormat,
  type ContentItem,
  type ContentVersion,
  type CommentWithAuthor,
  type GraphicArtsMaterialType,
  type LibraryAsset,
  type LocalizedField,
  type RowI18n,
  brandKitFromClient,
} from "@/lib/api";
import { FUNNEL_STAGES, parseFunnelStage, type FunnelStage } from "@/lib/content-strategy";
import { Switch } from "@/components/ui/switch";
import type { Json } from "@/integrations/supabase/types";
import {
  flattenOverlayToFile,
  formatInstagramHandle,
  parseMediaOverlays,
  resolveBrandTagline,
  serializeMediaOverlays,
  type MediaTextOverlay,
} from "@/lib/media-text-overlay";
import type { LanguageCode } from "@/i18n";
import { useAppRole } from "@/hooks/use-app-role";
import { useEntitlements } from "@/hooks/use-entitlements";
import { useAuth } from "@/hooks/use-auth";
import { useI18nBackfill } from "@/hooks/use-i18n-backfill";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { LocalizedTextInput, LocalizedTextarea } from "@/components/localized-text-field";
import { LocucaoTeleprompterDialog } from "@/components/locucao-teleprompter-dialog";
import { cn } from "@/lib/utils";
import { validateContentSearch } from "./content";

const CLIENT_REVIEW_STATUSES: ContentStatus[] = ["approved", "changes"];
/** Overlay text editor on media preview / generated art lightbox. */
const ART_TEXT_EDITOR_ENABLED = true;

const dateLocales = { "pt-BR": ptBR, "en-US": enUS, "es-ES": es };
const NONE_THEME_VALUE = "__none__";
const NEW_THEME_VALUE = "__new_theme__";
type SourceMode = "file" | "url" | "library";

type MediaEntry =
  | { id: string; kind: "url"; url: string; overlay?: MediaTextOverlay | null }
  | { id: string; kind: "file"; file: File; overlay?: MediaTextOverlay | null };

function createMediaId() {
  return crypto.randomUUID();
}

function fileNameFromStoredMediaUrl(url: string) {
  const raw = url.trim();
  if (!raw) return "";
  let last = raw;
  try {
    last = decodeURIComponent(new URL(raw).pathname.split("/").filter(Boolean).pop() ?? raw);
  } catch {
    last = decodeURIComponent(raw.split("/").filter(Boolean).pop() ?? raw);
  }
  return (
    last.replace(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}-/i, "") || last
  );
}

function mediaEntriesFromUrls(
  urls: string[],
  overlays: Array<MediaTextOverlay | null> = [],
): MediaEntry[] {
  return urls.filter(Boolean).map((url, index) => ({
    id: createMediaId(),
    kind: "url" as const,
    url,
    overlay: overlays[index] ?? null,
  }));
}

function serializeMediaForDirty(items: MediaEntry[]) {
  return items.map((item) =>
    item.kind === "url"
      ? { kind: "url" as const, url: item.url, overlay: item.overlay ?? null }
      : {
          kind: "file" as const,
          name: item.file.name,
          size: item.file.size,
          type: item.file.type,
          overlay: item.overlay ?? null,
        },
  );
}

function buildContentFormSnapshot(input: {
  title: string;
  caption: string;
  locucao: string;
  roteiro: string;
  cta: string;
  hashtags: string;
  theme: string;
  formatType: ContentFormat;
  materialType: string;
  widthCm: string;
  heightCm: string;
  productionNotes: string;
  funnelStage: FunnelStage | null;
  performanceReach: string;
  performanceRetention: string;
  performanceNote: string;
  repeatFormat: boolean;
  mediaItems: MediaEntry[];
  thumbnailUrl: string;
  thumbnailFileName: string;
  rowI18n: RowI18n;
}) {
  return JSON.stringify({
    title: input.title,
    caption: input.caption,
    locucao: input.locucao,
    roteiro: input.roteiro,
    cta: input.cta,
    hashtags: input.hashtags,
    theme: input.theme.trim(),
    formatType: input.formatType,
    materialType: input.materialType,
    widthCm: input.widthCm,
    heightCm: input.heightCm,
    productionNotes: input.productionNotes,
    funnelStage: input.funnelStage,
    performanceReach: input.performanceReach,
    performanceRetention: input.performanceRetention,
    performanceNote: input.performanceNote,
    repeatFormat: input.repeatFormat,
    media: serializeMediaForDirty(input.mediaItems),
    thumbnailUrl: input.thumbnailUrl,
    thumbnailFileName: input.thumbnailFileName,
    i18n: input.rowI18n,
  });
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

/** If the visible field diverged from i18n (e.g. hashtag toggles without blur), persist the display. */
function syncI18nDisplayField(
  payload: RowI18n,
  field: string,
  display: string,
  locale: string,
): RowI18n {
  const i18nDisplay = getLocalizedText(payload, field, "", locale);
  if (display === i18nDisplay) return payload;
  if (!display.trim()) {
    const { [field]: _omit, ...rest } = payload;
    return rest;
  }
  return setLocalizedField(
    payload,
    field,
    buildLocalizedFieldFromSource(display, locale),
  );
}

/** Force the same display text into every locale (carousel roteiro must not be AI-rewritten). */
function syncI18nVerbatimField(
  payload: RowI18n,
  field: string,
  display: string,
  locale: string,
): RowI18n {
  if (!display.trim()) {
    const { [field]: _omit, ...rest } = payload;
    return rest;
  }
  return setLocalizedField(
    payload,
    field,
    buildVerbatimLocalizedField(display, locale),
  );
}

export const Route = createFileRoute(
  "/_authenticated/clients/$clientId/projects/$projectId/content/$contentId",
)({
  validateSearch: validateContentSearch,
  head: () => ({ meta: [{ title: "Conteúdo — SOM" }, { name: "robots", content: "noindex" }] }),
  component: ContentDetailPage,
});

function ContentDetailPage() {
  const { clientId, projectId, contentId } = Route.useParams();
  const { t, i18n } = useTranslation();
  const queryClient = useQueryClient();
  const locale = dateLocales[(i18n.language as LanguageCode) ?? "pt-BR"] ?? ptBR;
  const { isAdmin, loading: roleLoading } = useAppRole();
  const { entitlements } = useEntitlements();
  const presetsAllowed = entitlements.presets;
  const libraryAllowed = entitlements.library;
  const { user } = useAuth();

  const [title, setTitle] = useState("");
  const [caption, setCaption] = useState("");
  const [locucao, setLocucao] = useState("");
  const [roteiro, setRoteiro] = useState("");
  const [cta, setCta] = useState("");
  const [hashtags, setHashtags] = useState("");
  const [theme, setTheme] = useState("");
  const [rowI18n, setRowI18n] = useState<RowI18n>({});
  const [formatType, setFormatType] = useState<ContentFormat>("static_feed");
  const posterPreset = getGraphicArtsMaterialPreset("poster");
  const [materialType, setMaterialType] = useState<GraphicArtsMaterialType>("poster");
  const [widthCm, setWidthCm] = useState(String(posterPreset.widthCm));
  const [heightCm, setHeightCm] = useState(String(posterPreset.heightCm));
  const [productionNotes, setProductionNotes] = useState("");
  const [funnelStage, setFunnelStage] = useState<FunnelStage | null>(null);
  const [performanceReach, setPerformanceReach] = useState("");
  const [performanceRetention, setPerformanceRetention] = useState("");
  const [performanceNote, setPerformanceNote] = useState("");
  const [repeatFormat, setRepeatFormat] = useState(false);
  const [mediaItems, setMediaItems] = useState<MediaEntry[]>([]);
  const [thumbnailUrl, setThumbnailUrl] = useState("");
  const [thumbnailFile, setThumbnailFile] = useState<File | null>(null);
  const [thumbnailBlobUrl, setThumbnailBlobUrl] = useState<string | null>(null);
  const [source, setSource] = useState<SourceMode>("file");
  const [urlDraft, setUrlDraft] = useState("");
  const [mediaLibraryOpen, setMediaLibraryOpen] = useState(false);
  const [comment, setComment] = useState("");
  const [versionNote, setVersionNote] = useState("");
  const [themeDialogOpen, setThemeDialogOpen] = useState(false);
  const [teleprompterOpen, setTeleprompterOpen] = useState(false);
  const [teleprompterText, setTeleprompterText] = useState("");
  const [newTheme, setNewTheme] = useState("");
  const [deleteCommentId, setDeleteCommentId] = useState<string | null>(null);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [dropIndex, setDropIndex] = useState<number | null>(null);
  const [formBaseline, setFormBaseline] = useState<string | null>(null);
  const [ignoreUnsavedChanges, setIgnoreUnsavedChanges] = useState(false);
  /** Which content+locale the local form was hydrated for — avoids refetch after save wiping in-progress edits. */
  const [hydratedKey, setHydratedKey] = useState<string | null>(null);
  const [viewingVersion, setViewingVersion] = useState<ContentVersion | null>(null);
  const mediaFileInputRef = useRef<HTMLInputElement>(null);
  const thumbnailFileInputRef = useRef<HTMLInputElement>(null);
  const presetTranslateSeq = useRef({ cta: 0, hashtags: 0, theme: 0 });
  const ctaRef = useRef(cta);
  const hashtagsRef = useRef(hashtags);
  ctaRef.current = cta;
  hashtagsRef.current = hashtags;

  const contentQuery = useQuery({
    queryKey: ["content", "detail", contentId],
    queryFn: () => getContent(contentId),
  });

  const commentsQuery = useQuery({
    queryKey: ["comments", contentId],
    queryFn: () => listComments(contentId),
  });

  const versionsQuery = useQuery({
    queryKey: ["versions", contentId],
    queryFn: () => listVersions(contentId),
  });

  const manageQuery = useQuery({
    queryKey: ["can-manage", clientId],
    queryFn: () => canManageClient(clientId),
  });

  const clientQuery = useQuery({
    queryKey: ["clients", clientId],
    queryFn: () => getClient(clientId),
  });

  const projectQuery = useQuery({
    queryKey: ["projects", "detail", projectId],
    queryFn: () => getProject(projectId),
  });

  const projectContentQuery = useQuery({
    queryKey: ["content", projectId],
    queryFn: () => listContent(projectId),
  });

  const content = contentQuery.data;
  const client = clientQuery.data;
  const projectI18n = parseRowI18n(projectQuery.data?.i18n);
  const uiLocale = normalizeAppLocale(i18n.resolvedLanguage ?? i18n.language);
  const ctaPresets = getLocalizedPresetList(
    projectI18n,
    "cta_presets",
    projectQuery.data?.cta_presets ?? [],
    uiLocale,
  );
  const hashtagPresets = getLocalizedPresetList(
    projectI18n,
    "hashtag_presets",
    projectQuery.data?.hashtag_presets ?? [],
    uiLocale,
  );
  const themePresets = getLocalizedPresetList(
    projectI18n,
    "theme_presets",
    projectQuery.data?.theme_presets ?? [],
    uiLocale,
  );
  const allowedFormats = contentFormatsForProject(projectQuery.data?.categories);
  const showFeedMockup =
    Boolean(projectQuery.data) &&
    projectCategoryConfig(projectQuery.data?.categories).tabs.includes("feed");
  const isVideosProject =
    getPrimaryProjectCategory(projectQuery.data?.categories) === "videos";
  const feedItems = useMemo(() => {
    return [...(projectContentQuery.data ?? [])].sort((a: ContentItem, b: ContentItem) => {
      const aOrder = a.sort_order ?? 0;
      const bOrder = b.sort_order ?? 0;
      if (aOrder !== bOrder) return aOrder - bOrder;
      return a.title.localeCompare(b.title);
    });
  }, [projectContentQuery.data]);
  const canManage = manageQuery.data ?? false;
  const status = (content?.status ?? "draft") as ContentStatus;
  const isPrintPiece = isPrintMaterialFormat(formatType);
  const isReelsPiece = isReelsFormat(formatType);
  const usesDedicatedThumbnail = contentUsesDedicatedThumbnail(formatType);
  const isCarousel = formatType === "carousel";
  const needsLocucao =
    formatType === "reels" || formatType === "recorded_video" || formatType === "youtube_short";
  const themeOptions = useMemo(() => {
    const current = theme.trim();
    return Array.from(new Set([...themePresets, ...(current ? [current] : [])])).sort((a, b) =>
      a.localeCompare(b, i18n.language),
    );
  }, [themePresets, theme, i18n.language]);
  const [blobUrls, setBlobUrls] = useState<Record<string, string>>({});
  const previewThumbnailUrl = thumbnailBlobUrl || thumbnailUrl.trim() || null;
  const coverFileName =
    thumbnailFile?.name ||
    (thumbnailUrl.trim() ? fileNameFromStoredMediaUrl(thumbnailUrl) : "");
  const previewItems: PreviewMediaItem[] = mediaItems
    .map((item) => {
      if (item.kind === "url") return { url: item.url, overlay: item.overlay ?? null };
      const url = blobUrls[item.id] ?? "";
      return {
        url,
        kind: guessMediaKind(item.file),
        name: item.file.name,
        overlay: item.overlay ?? null,
      };
    })
    .filter((item) => item.url);

  const replaceThumbnailBlob = (next: string | null) => {
    setThumbnailBlobUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return next;
    });
  };

  const setThumbnailFromFile = (file: File | null) => {
    setThumbnailFile(file);
    replaceThumbnailBlob(file ? URL.createObjectURL(file) : null);
  };

  const applyContentToForm = (row: NonNullable<typeof content>) => {
    const nextI18n = parseRowI18n(row.i18n);
    const nextTitle = getLocalizedText(nextI18n, "title", row.title, uiLocale);
    const nextCaption = getLocalizedText(nextI18n, "caption", row.caption, uiLocale);
    const nextLocucao = getLocalizedText(nextI18n, "locucao", row.locucao ?? "", uiLocale);
    // Roteiro is structural (Slide N:) — always use the column as source of truth.
    // Never display AI/i18n rewrites; keep i18n mirrored verbatim for other locales.
    const nextRoteiro = row.roteiro ?? "";
    const healedI18n = setLocalizedField(
      nextI18n,
      "roteiro",
      buildVerbatimLocalizedField(nextRoteiro, uiLocale),
    );
    const nextCta = getLocalizedText(healedI18n, "cta", row.cta, uiLocale);
    const nextHashtags = getLocalizedText(healedI18n, "hashtags", row.hashtags, uiLocale);
    const nextTheme = getLocalizedText(healedI18n, "theme", row.theme ?? "", uiLocale);
    const nextFormat =
      row.format ?? defaultContentFormatForProject(projectQuery.data?.categories);
    const nextPreset = getGraphicArtsMaterialPreset(row.material_type);
    const nextMaterialType = GRAPHIC_ARTS_MATERIAL_TYPES.includes(
      row.material_type as GraphicArtsMaterialType,
    )
      ? (row.material_type as GraphicArtsMaterialType)
      : nextPreset.id;
    const nextWidthCm = String(row.width_cm ?? nextPreset.widthCm);
    const nextHeightCm = String(row.height_cm ?? nextPreset.heightCm);
    const nextProductionNotes = row.production_notes ?? "";
    const nextFunnel = parseFunnelStage(row.funnel_stage);
    const nextReach = row.performance_reach ?? "";
    const nextRetention = row.performance_retention ?? "";
    const nextPerfNote = row.performance_note ?? "";
    const nextRepeat = Boolean(row.repeat_format);
    const nextMedia = mediaEntriesFromUrls(
      resolveContentMediaUrls(row),
      parseMediaOverlays((row as ContentItem).media_overlays),
    );
    const nextThumbnail = row.thumbnail_url?.trim() || "";
    setRowI18n(healedI18n);
    setTitle(nextTitle);
    setCaption(nextCaption);
    setLocucao(nextLocucao);
    setRoteiro(nextRoteiro);
    setCta(nextCta);
    setHashtags(nextHashtags);
    setTheme(nextTheme);
    setFormatType(nextFormat);
    setMaterialType(nextMaterialType);
    setWidthCm(nextWidthCm);
    setHeightCm(nextHeightCm);
    setProductionNotes(nextProductionNotes);
    setFunnelStage(nextFunnel);
    setPerformanceReach(nextReach);
    setPerformanceRetention(nextRetention);
    setPerformanceNote(nextPerfNote);
    setRepeatFormat(nextRepeat);
    setMediaItems(nextMedia);
    setThumbnailUrl(nextThumbnail);
    setThumbnailFile(null);
    replaceThumbnailBlob(null);
    setUrlDraft("");
    setDragIndex(null);
    setDropIndex(null);
    setFormBaseline(
      buildContentFormSnapshot({
        title: nextTitle,
        caption: nextCaption,
        locucao: nextLocucao,
        roteiro: nextRoteiro,
        cta: nextCta,
        hashtags: nextHashtags,
        theme: nextTheme,
        formatType: nextFormat,
        materialType: nextMaterialType,
        widthCm: nextWidthCm,
        heightCm: nextHeightCm,
        productionNotes: nextProductionNotes,
        funnelStage: nextFunnel,
        performanceReach: nextReach,
        performanceRetention: nextRetention,
        performanceNote: nextPerfNote,
        repeatFormat: nextRepeat,
        mediaItems: nextMedia,
        thumbnailUrl: nextThumbnail,
        thumbnailFileName: "",
        rowI18n: healedI18n,
      }),
    );
    setIgnoreUnsavedChanges(false);
  };

  const formHydrateKey = `${contentId}::${uiLocale}`;

  useEffect(() => {
    if (!content) return;
    if (hydratedKey === formHydrateKey) return;
    applyContentToForm(content);
    setHydratedKey(formHydrateKey);
    // Intentionally omit applyContentToForm from deps — hydrate once per content+locale (and after forced reset).
    // eslint-disable-next-line react-hooks/exhaustive-deps -- see meeting.$agendaId.tsx for the same pattern
  }, [content, formHydrateKey, hydratedKey, projectQuery.data?.categories]);

  const formSnapshot = buildContentFormSnapshot({
    title,
    caption,
    locucao,
    roteiro,
    cta,
    hashtags,
    theme,
    formatType,
    materialType,
    widthCm,
    heightCm,
    productionNotes,
    funnelStage,
    performanceReach,
    performanceRetention,
    performanceNote,
    repeatFormat,
    mediaItems,
    thumbnailUrl,
    thumbnailFileName: thumbnailFile?.name ?? "",
    rowI18n,
  });
  const isDirty = Boolean(formBaseline) && !ignoreUnsavedChanges && formSnapshot !== formBaseline;
  const isDirtyRef = useRef(isDirty);
  isDirtyRef.current = isDirty;

  const contentBackfillFields = useMemo(
    () =>
      content
        ? {
            title: content.title,
            caption: content.caption,
            locucao: content.locucao,
            // Omit roteiro — "Slide N:" labels break AI locale detection; field is verbatim.
            cta: content.cta,
            hashtags: content.hashtags,
            theme: content.theme,
          }
        : {},
    [content],
  );

  useI18nBackfill({
    enabled: Boolean(content) && !isDirty,
    entityKey: content ? `content:${content.id}:${content.updated_at}` : "content:none",
    locale: uiLocale,
    i18n: content?.i18n,
    fields: contentBackfillFields,
    onPersist: async (nextI18n) => {
      if (!content) return;
      const row = await updateContentI18n(contentId, nextI18n);
      queryClient.setQueryData(["content", "detail", contentId], row);
    },
    onApplied: (nextI18n) => {
      if (!content || isDirtyRef.current) return;
      // Keep the column roteiro — backfill must never remount a rewritten script.
      applyContentToForm({
        ...content,
        i18n: nextI18n as typeof content.i18n,
        roteiro: content.roteiro,
      });
    },
  });

  const onFieldI18nCommit = (payload: {
    field: string;
    display: string;
    canonical: string;
    block: LocalizedField;
    i18n: RowI18n;
  }) => {
    setRowI18n((prev) => setLocalizedField(prev, payload.field, payload.block));
    if (payload.field === "title") setTitle(payload.display);
    if (payload.field === "caption") setCaption(payload.display);
    if (payload.field === "locucao") setLocucao(payload.display);
    if (payload.field === "roteiro") setRoteiro(payload.display);
    if (payload.field === "cta") setCta(payload.display);
    if (payload.field === "hashtags") setHashtags(payload.display);
    if (payload.field === "theme") setTheme(payload.display);
    if (payload.field === "versionNote") setVersionNote(payload.display);
  };

  const persistTextPreset = async (field: "cta" | "hashtags", value: string) => {
    try {
      await addProjectTextPreset(projectId, field, value);
      queryClient.invalidateQueries({ queryKey: ["projects"] });
      toast.success(
        field === "cta"
          ? t("project.detail.ctaPresetAdded")
          : t("project.detail.hashtagPresetAdded"),
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err));
      throw err;
    }
  };

  const themePresetBlock = (display: string): LocalizedField | null => {
    const index = themePresets.findIndex((preset) => preset === display);
    if (index < 0) return null;
    const raw = projectI18n.theme_presets;
    if (!Array.isArray(raw)) return null;
    const item = raw[index];
    return isLocalizedField(item) ? item : null;
  };

  const handlePresetChange = (field: "cta" | "hashtags", value: string) => {
    presetTranslateSeq.current[field] += 1;
    const block = buildLocalizedFieldFromSource(value, uiLocale);
    onFieldI18nCommit({
      field,
      display: value,
      canonical: value,
      block,
      i18n: setLocalizedField(rowI18n, field, block),
    });
  };

  const translatePresetField = async (field: "cta" | "hashtags" | "theme", value: string) => {
    const seq = ++presetTranslateSeq.current[field];
    try {
      const block = await translateTextField({ text: value, sourceLocale: uiLocale });
      if (seq !== presetTranslateSeq.current[field]) return;
      setRowI18n((prev) => setLocalizedField(prev, field, block));
      const display = value;
      if (field === "cta") setCta(display);
      if (field === "hashtags") setHashtags(display);
      if (field === "theme") setTheme(display);
    } catch {
      if (seq !== presetTranslateSeq.current[field]) return;
      setRowI18n((prev) =>
        setLocalizedField(prev, field, buildLocalizedFieldFromSource(value, uiLocale)),
      );
    }
  };

  const applyThemeSelection = (nextDisplay: string) => {
    const trimmed = nextDisplay.trim();
    setTheme(trimmed);
    if (!trimmed) {
      setRowI18n((prev) => {
        const { theme: _omit, ...rest } = prev;
        return rest;
      });
      return;
    }
    const presetBlock = themePresetBlock(trimmed);
    if (presetBlock) {
      setRowI18n((prev) => setLocalizedField(prev, "theme", presetBlock));
      return;
    }
    setRowI18n((prev) =>
      setLocalizedField(prev, "theme", buildLocalizedFieldFromSource(trimmed, uiLocale)),
    );
    void translatePresetField("theme", trimmed);
  };

  const buildSavePayload = () => {
    // versionNote is only for change_note on new versions — never persist on content.i18n
    const { versionNote: _omitVersionNote, ...baseI18n } = rowI18n;
    const displayTheme = theme.trim();
    const i18nThemeDisplay = getLocalizedText(baseI18n, "theme", "", uiLocale).trim();
    let i18nPayload = baseI18n;
    if (displayTheme !== i18nThemeDisplay) {
      if (!displayTheme) {
        const { theme: _omitTheme, ...rest } = i18nPayload;
        i18nPayload = rest;
      } else {
        i18nPayload = setLocalizedField(
          i18nPayload,
          "theme",
          themePresetBlock(displayTheme) ?? buildLocalizedFieldFromSource(displayTheme, uiLocale),
        );
      }
    }
    i18nPayload = syncI18nDisplayField(i18nPayload, "title", title, uiLocale);
    i18nPayload = syncI18nDisplayField(i18nPayload, "caption", caption, uiLocale);
    i18nPayload = syncI18nDisplayField(i18nPayload, "locucao", locucao, uiLocale);
    // Roteiro is structural (Slide N:) — never leave a divergent AI translation in i18n.
    i18nPayload = syncI18nVerbatimField(i18nPayload, "roteiro", roteiro, uiLocale);
    i18nPayload = syncI18nDisplayField(i18nPayload, "cta", cta, uiLocale);
    i18nPayload = isPrintPiece
      ? syncI18nDisplayField(i18nPayload, "hashtags", "", uiLocale)
      : syncI18nDisplayField(i18nPayload, "hashtags", hashtags, uiLocale);
    const parsedWidth = parseCmInput(widthCm);
    const parsedHeight = parseCmInput(heightCm);
    return {
      title: getCanonicalText(i18nPayload, "title", title),
      caption: getCanonicalText(i18nPayload, "caption", caption),
      cta: getCanonicalText(i18nPayload, "cta", cta),
      hashtags: isPrintPiece ? "" : getCanonicalText(i18nPayload, "hashtags", hashtags),
      locucao: getCanonicalText(i18nPayload, "locucao", locucao),
      roteiro,
      theme: displayTheme
        ? getCanonicalText(i18nPayload, "theme", displayTheme) || null
        : null,
      materialType: isPrintPiece ? materialType : null,
      widthCm: isPrintPiece ? parsedWidth : null,
      heightCm: isPrintPiece ? parsedHeight : null,
      productionNotes: isPrintPiece ? productionNotes : "",
      i18n: i18nPayload,
    };
  };

  const pendingFileKey = mediaItems
    .filter((item): item is Extract<MediaEntry, { kind: "file" }> => item.kind === "file")
    .map((item) => item.id)
    .slice()
    .sort()
    .join("|");

  useEffect(() => {
    const fileItems = mediaItems.filter(
      (item): item is Extract<MediaEntry, { kind: "file" }> => item.kind === "file",
    );
    const next: Record<string, string> = {};
    for (const item of fileItems) {
      next[item.id] = URL.createObjectURL(item.file);
    }
    setBlobUrls(next);
    return () => {
      Object.values(next).forEach((url) => URL.revokeObjectURL(url));
    };
    // Recreate object URLs only when the set of pending files changes, not on reorder.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- pendingFileKey tracks file identity
  }, [pendingFileKey]);

  const invalidateAll = () => {
    queryClient.invalidateQueries({ queryKey: ["content"] });
    queryClient.invalidateQueries({ queryKey: ["comments", contentId] });
    queryClient.invalidateQueries({ queryKey: ["versions", contentId] });
    queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    queryClient.invalidateQueries({ queryKey: ["brand-repeat-posts", clientId] });
  };

  const resolveMediaForSave = async () => {
    const pendingFiles = mediaItems
      .filter((item): item is Extract<MediaEntry, { kind: "file" }> => item.kind === "file")
      .map((item) => item.file);
    const uploaded = pendingFiles.length
      ? await uploadContentMediaFiles(projectId, pendingFiles)
      : [];
    let fileIndex = 0;
    const resolved = mediaItems
      .map((item) => {
        const url = item.kind === "url" ? item.url : uploaded[fileIndex++] ?? "";
        return url ? { url, overlay: item.overlay ?? null } : null;
      })
      .filter((item): item is { url: string; overlay: MediaTextOverlay | null } => Boolean(item));
    const sliced = isCarousel ? resolved : resolved.slice(0, 1);
    return {
      urls: sliced.map((item) => item.url),
      overlays: serializeMediaOverlays(sliced.map((item) => item.overlay)) as Json,
    };
  };

  const resolveThumbnailForSave = async () => {
    if (thumbnailFile) {
      return uploadContentMedia(projectId, thumbnailFile);
    }
    return thumbnailUrl.trim() || null;
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      const { urls, overlays } = await resolveMediaForSave();
      const nextThumbnail = usesDedicatedThumbnail ? await resolveThumbnailForSave() : null;
      const payload = buildSavePayload();
      if (isPrintPiece && (payload.widthCm == null || payload.heightCm == null)) {
        throw new Error(t("project.graphicArts.invalidDimensions"));
      }
      const row = await updateContentFields({
        contentId,
        title: payload.title,
        caption: payload.caption,
        cta: payload.cta,
        hashtags: payload.hashtags,
        locucao: payload.locucao,
        roteiro: payload.roteiro,
        mediaUrls: urls,
        mediaOverlays: overlays,
        thumbnailUrl: usesDedicatedThumbnail ? nextThumbnail : null,
        format: formatType,
        theme: payload.theme,
        materialType: payload.materialType,
        widthCm: payload.widthCm,
        heightCm: payload.heightCm,
        productionNotes: payload.productionNotes,
        funnelStage,
        performanceReach,
        performanceRetention,
        performanceNote,
        repeatFormat,
        i18n: payload.i18n,
      });
      return { row, savedRoteiro: payload.roteiro };
    },
    onSuccess: ({ row, savedRoteiro }) => {
      queryClient.setQueryData(["content", "detail", contentId], {
        ...row,
        roteiro: savedRoteiro,
      });
      applyContentToForm({ ...row, roteiro: savedRoteiro });
      setRoteiro(savedRoteiro);
      setHydratedKey(formHydrateKey);
      invalidateAll();
      toast.success(t("common.saved"));
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const versionMutation = useMutation({
    mutationFn: async () => {
      const payload = buildSavePayload();
      if (isPrintPiece && (payload.widthCm == null || payload.heightCm == null)) {
        throw new Error(t("project.graphicArts.invalidDimensions"));
      }
      const noteCanonical = getCanonicalText(rowI18n, "versionNote", versionNote);
      // Clients save title/format/theme/copy/roteiro via RPC; admins save full content as a new version.
      if (!isAdmin) {
        return saveClientContentVersion({
          contentId,
          clientId,
          projectId,
          title: payload.title,
          caption: payload.caption,
          cta: payload.cta,
          hashtags: payload.hashtags,
          locucao: payload.locucao,
          roteiro: payload.roteiro,
          format: formatType,
          theme: payload.theme,
          changeNote: noteCanonical,
          i18n: payload.i18n,
        });
      }
      const { urls, overlays } = await resolveMediaForSave();
      const nextThumbnail = usesDedicatedThumbnail ? await resolveThumbnailForSave() : null;
      return saveContentAsNewVersion({
        contentId,
        clientId,
        projectId,
        title: payload.title,
        caption: payload.caption,
        cta: payload.cta,
        hashtags: payload.hashtags,
        locucao: payload.locucao,
        roteiro: payload.roteiro,
        mediaUrls: urls,
        mediaOverlays: overlays,
        thumbnailUrl: usesDedicatedThumbnail ? nextThumbnail : null,
        format: formatType,
        theme: payload.theme,
        materialType: payload.materialType,
        widthCm: payload.widthCm,
        heightCm: payload.heightCm,
        productionNotes: payload.productionNotes,
        changeNote: noteCanonical,
        i18n: payload.i18n,
      });
    },
    onSuccess: (row) => {
      setVersionNote("");
      const nextI18n = parseRowI18n(row.i18n);
      const { versionNote: _omit, ...cleanI18n } = nextI18n as RowI18n & {
        versionNote?: unknown;
      };
      const savedRoteiro = roteiro;
      queryClient.setQueryData(["content", "detail", contentId], {
        ...row,
        roteiro: savedRoteiro,
        i18n: cleanI18n as typeof row.i18n,
      });
      applyContentToForm({
        ...row,
        roteiro: savedRoteiro,
        i18n: cleanI18n as typeof row.i18n,
      });
      setRoteiro(savedRoteiro);
      setHydratedKey(formHydrateKey);
      invalidateAll();
      toast.success(t("project.detail.versionCreated"));
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const addThemeMutation = useMutation({
    mutationFn: async (nextTheme: string) => {
      await addProjectThemePreset(projectId, nextTheme);
      return nextTheme;
    },
    onSuccess: (nextTheme) => {
      applyThemeSelection(nextTheme);
      setThemeDialogOpen(false);
      setNewTheme("");
      queryClient.invalidateQueries({ queryKey: ["projects", "detail", projectId] });
      toast.success(t("project.calendar.themeAdded"));
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const statusMutation = useMutation({
    mutationFn: (next: ContentStatus) =>
      setContentStatus({
        contentId,
        clientId,
        projectId,
        status: next,
        title: content?.title ?? title,
      }),
    onSuccess: (row, next) => {
      queryClient.setQueryData(["content", "detail", contentId], row);
      invalidateAll();
      if (next === "approved") toast.success(t("project.detail.approvedToast"));
      else if (next === "changes") toast.success(t("project.detail.changesToast"));
      else if (next === "changes_done")
        toast.success(t("project.detail.changesDoneToast"));
      else if (next === "review") toast.success(t("project.detail.submittedToast"));
      else if (next === "published") toast.success(t("project.detail.publishedToast"));
      else toast.success(t("project.content.statusUpdated"));
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const commentMutation = useMutation({
    mutationFn: async (input: { body: string; audioBlob?: Blob | null }) => {
      let audioUrl: string | null = null;
      let audioStoragePath: string | null = null;
      if (input.audioBlob) {
        const uploaded = await uploadCommentAudio({
          projectId,
          contentId,
          blob: input.audioBlob,
        });
        audioUrl = uploaded.publicUrl;
        audioStoragePath = uploaded.storagePath;
      }

      const text = input.body.trim();
      let commentI18n: RowI18n = {};
      if (text) {
        try {
          const block = await translateTextField({ text });
          commentI18n = { body: block };
        } catch {
          commentI18n = { body: buildLocalizedFieldFromSource(text, uiLocale) };
        }
      }
      const bodyCanonical = text
        ? getCanonicalText(commentI18n, "body", text)
        : "";
      return addComment({
        contentId,
        clientId,
        projectId,
        body: bodyCanonical,
        contentTitle: content?.title ?? title,
        i18n: text ? commentI18n : undefined,
        audioUrl,
        audioStoragePath,
      });
    },
    onSuccess: (row) => {
      setComment("");
      const authorName =
        (user?.user_metadata?.full_name as string | undefined)?.trim() ||
        (user?.user_metadata?.name as string | undefined)?.trim() ||
        user?.email?.split("@")[0] ||
        null;
      const next: CommentWithAuthor = {
        ...row,
        profiles: { full_name: authorName, avatar_url: null },
      };
      queryClient.setQueryData<CommentWithAuthor[]>(["comments", contentId], (prev) => {
        const list = prev ?? [];
        if (list.some((c) => c.id === row.id)) return list;
        return [...list, next];
      });
      invalidateAll();
      toast.success(t("project.detail.commentAdded"));
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const updateCommentMutation = useMutation({
    mutationFn: async (input: { commentId: string; body: string }) => {
      const text = input.body.trim();
      let commentI18n: RowI18n = {};
      if (text) {
        try {
          const block = await translateTextField({ text });
          commentI18n = { body: block };
        } catch {
          commentI18n = { body: buildLocalizedFieldFromSource(text, uiLocale) };
        }
      }
      const bodyCanonical = text ? getCanonicalText(commentI18n, "body", text) : "";
      return updateComment({
        commentId: input.commentId,
        body: bodyCanonical,
        i18n: commentI18n,
      });
    },
    onSuccess: (row) => {
      queryClient.setQueryData<CommentWithAuthor[]>(["comments", contentId], (prev) =>
        (prev ?? []).map((item) =>
          item.id === row.id ? { ...item, ...row, profiles: item.profiles } : item,
        ),
      );
      invalidateAll();
      toast.success(t("project.detail.commentUpdated"));
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const deleteCommentMutation = useMutation({
    mutationFn: (commentId: string) => deleteComment(commentId),
    onSuccess: (_void, commentId) => {
      setDeleteCommentId(null);
      queryClient.setQueryData<CommentWithAuthor[]>(["comments", contentId], (prev) =>
        (prev ?? []).filter((c) => c.id !== commentId),
      );
      invalidateAll();
      toast.success(t("project.detail.commentDeleted"));
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const restoreMutation = useMutation({
    mutationFn: (version: ContentVersion) =>
      restoreVersion({ contentId, clientId, projectId, version }),
    onSuccess: (row) => {
      setViewingVersion(null);
      queryClient.setQueryData(["content", "detail", contentId], row);
      applyContentToForm(row);
      setHydratedKey(formHydrateKey);
      invalidateAll();
      toast.success(t("project.detail.restored"));
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const versionPreview = useMemo(() => {
    if (!viewingVersion || !content) return null;
    const versionI18n = parseRowI18n(viewingVersion.i18n);
    const format = viewingVersion.format;
    return {
      title: getLocalizedText(versionI18n, "title", content.title, uiLocale),
      caption: getLocalizedText(versionI18n, "caption", viewingVersion.caption, uiLocale),
      cta: getLocalizedText(versionI18n, "cta", viewingVersion.cta, uiLocale),
      hashtags: getLocalizedText(versionI18n, "hashtags", viewingVersion.hashtags, uiLocale),
      locucao: getLocalizedText(versionI18n, "locucao", viewingVersion.locucao ?? "", uiLocale),
      roteiro: getLocalizedText(versionI18n, "roteiro", viewingVersion.roteiro ?? "", uiLocale),
      format,
      materialType: viewingVersion.material_type,
      widthCm: viewingVersion.width_cm,
      heightCm: viewingVersion.height_cm,
      productionNotes: viewingVersion.production_notes ?? "",
      previewItems: resolveContentMediaUrls(viewingVersion).map((url) => ({ url })),
      thumbnailUrl: viewingVersion.thumbnail_url,
      needsLocucao:
        format === "reels" || format === "recorded_video" || format === "youtube_short",
      isCarousel: format === "carousel",
      isPrint: isPrintMaterialFormat(format),
    };
  }, [viewingVersion, content, uiLocale]);

  const addMediaUrl = (rawUrl: string) => {
    const next = rawUrl.trim();
    if (!next) return;
    const entry: MediaEntry = { id: createMediaId(), kind: "url", url: next };

    if (formatType === "carousel") {
      setMediaItems((prev) => [...prev, entry]);
    } else if (mediaItems.length === 0) {
      setMediaItems([entry]);
    } else if (allowedFormats.includes("carousel")) {
      setFormatType("carousel");
      setMediaItems((prev) => [...prev, entry]);
    } else {
      setMediaItems([entry]);
    }
  };

  const addUrl = () => {
    const next = urlDraft.trim();
    if (!next) return;
    addMediaUrl(next);
    setUrlDraft("");
  };

  const addLibraryAsset = (asset: LibraryAsset) => {
    const url = asset.file_url?.trim();
    if (!url) {
      toast.error(t("project.detail.mediaLibraryMissingUrl"));
      return;
    }
    addMediaUrl(url);
    toast.success(t("project.detail.mediaLibraryAdded"));
  };

  const addFiles = (files: File[]) => {
    if (!files.length) return;
    const entries: MediaEntry[] = files.map((file) => ({
      id: createMediaId(),
      kind: "file" as const,
      file,
    }));

    if (formatType === "carousel") {
      setMediaItems((prev) => [...prev, ...entries]);
      return;
    }

    if (entries.length === 1) {
      setMediaItems(entries);
      return;
    }

    if (allowedFormats.includes("carousel")) {
      setFormatType("carousel");
      setMediaItems((prev) => [...prev, ...entries]);
      return;
    }

    setMediaItems(entries.slice(0, 1));
  };

  const removeMediaAt = (index: number) => {
    setMediaItems((prev) => prev.filter((_, i) => i !== index));
  };

  const onDragStart = (index: number) => (event: DragEvent<HTMLLIElement>) => {
    setDragIndex(index);
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", String(index));
  };

  const onDragOver = (index: number) => (event: DragEvent<HTMLLIElement>) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
    if (dropIndex !== index) setDropIndex(index);
  };

  const onDrop = (index: number) => (event: DragEvent<HTMLLIElement>) => {
    event.preventDefault();
    const from = dragIndex ?? Number(event.dataTransfer.getData("text/plain"));
    if (Number.isFinite(from)) {
      setMediaItems((prev) => moveItem(prev, from, index));
    }
    setDragIndex(null);
    setDropIndex(null);
  };

  const onDragEnd = () => {
    setDragIndex(null);
    setDropIndex(null);
  };

  if (contentQuery.isLoading || roleLoading || manageQuery.isLoading) {
    return <p className="text-sm text-muted-foreground">{t("common.loading")}</p>;
  }

  if (!content) {
    return <p className="text-sm text-muted-foreground">{t("project.detail.notFound")}</p>;
  }

  // "Em produção" (draft): only managers/admins; clients cannot open the detail page.
  if (!canManage && status === "draft") {
    return (
      <Navigate
        to={
          CONTENT_TAB_ENABLED
            ? "/clients/$clientId/projects/$projectId/content"
            : "/clients/$clientId/projects/$projectId/calendar"
        }
        params={{ clientId, projectId }}
        {...(CONTENT_TAB_ENABLED ? { search: {} } : {})}
        replace
      />
    );
  }

  // Same form for admin and client. Clients edit title/format/theme/copy/roteiro; media stays admin-only.
  // Clients always get approve / production-adjustment actions on content they can open
  // (draft is already redirected away above).
  const statusButtons = isAdmin ? CONTENT_STATUSES : CLIENT_REVIEW_STATUSES;
  const saving = saveMutation.isPending || versionMutation.isPending;

  const renderSaveAndStatusCard = (noteId: string) => (
    <Card className="rounded-xl">
      <CardContent className="space-y-4 p-6">
        <div className="space-y-1.5">
          <Label htmlFor={noteId} variant="highlight">
            {t("project.detail.versionNote")}
          </Label>
          <LocalizedTextInput
            id={noteId}
            field="versionNote"
            i18n={rowI18n}
            fallback={versionNote}
            placeholder={t("project.detail.versionNotePlaceholder")}
            onI18nCommit={onFieldI18nCommit}
          />
        </div>
        <div className="flex flex-wrap gap-2">
          {isAdmin ? (
            <Button
              type="button"
              variant="outline"
              disabled={saving}
              onClick={() => saveMutation.mutate()}
            >
              <Save className="mr-2 h-4 w-4" aria-hidden="true" />
              {saving && saveMutation.isPending ? t("common.loading") : t("common.save")}
            </Button>
          ) : null}
          <Button type="button" disabled={saving} onClick={() => versionMutation.mutate()}>
            <History className="mr-2 h-4 w-4" aria-hidden="true" />
            {saving && versionMutation.isPending
              ? t("common.loading")
              : t("project.detail.saveVersion")}
          </Button>
        </div>
        {statusButtons.length > 0 ? (
          <div className="space-y-2 border-t pt-4">
            <Label variant="highlight">{t("project.content.columns.status")}</Label>
            <div className="flex flex-wrap gap-2">
              {statusButtons.map((value) => {
                const isCurrent = value === status;
                return (
                  <Button
                    key={value}
                    type="button"
                    size="sm"
                    disabled={statusMutation.isPending || isCurrent}
                    aria-pressed={isCurrent}
                    className={cn(
                      "border shadow-sm",
                      isCurrent
                        ? contentStatusStyles[value]
                        : "border-border bg-background text-foreground hover:bg-muted",
                    )}
                    onClick={() => {
                      if (isCurrent) return;
                      statusMutation.mutate(value);
                    }}
                  >
                    {t(`project.content.status.${value}`)}
                  </Button>
                );
              })}
            </div>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );

  return (
    <div className="space-y-6">
      <UnsavedChangesGuard isDirty={isDirty} />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link
          to={
            CONTENT_TAB_ENABLED
              ? "/clients/$clientId/projects/$projectId/content"
              : "/clients/$clientId/projects/$projectId/calendar"
          }
          params={{ clientId, projectId }}
          {...(CONTENT_TAB_ENABLED ? { search: {} } : {})}
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ChevronLeft className="h-4 w-4" aria-hidden="true" />
          {t(CONTENT_TAB_ENABLED ? "project.tabs.content" : "project.tabs.calendar")}
        </Link>
        <StatusBadge status={status} asButton />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card className="rounded-xl">
            <CardHeader>
              <CardTitle className="text-base">{t("project.detail.preview")}</CardTitle>
            </CardHeader>
            <CardContent>
              <ContentMediaPreview
                items={previewItems}
                format={formatType}
                title={title}
                caption={caption}
                hashtags={hashtags}
                cta={cta}
                username={client?.name ?? title}
                avatarUrl={client?.logo_url}
                thumbnailUrl={previewThumbnailUrl}
                size="lg"
                materialType={materialType}
                widthCm={parseCmInput(widthCm)}
                heightCm={parseCmInput(heightCm)}
                textEditor={
                  ART_TEXT_EDITOR_ENABLED &&
                  isAdmin &&
                  (formatType === "static_feed" || formatType === "carousel")
                    ? {
                        brandFonts: brandKitFromClient(client ?? {}).brand_fonts,
                        colors: brandKitFromClient(client ?? {}).brand_colors,
                        headerLeft: formatInstagramHandle(client?.instagram),
                        headerRight:
                          resolveBrandTagline(brandKitFromClient(client ?? {}).brand_fonts.notes) ||
                          undefined,
                        overlayText: title,
                        onSave: async (index, overlay) => {
                          try {
                            const file = await flattenOverlayToFile(
                              overlay,
                              `${title.trim() || "arte"}-texto.png`,
                            );
                            const url = await uploadContentMedia(projectId, file);
                            setMediaItems((prev) =>
                              prev.map((item, i) =>
                                i === index
                                  ? { id: item.id, kind: "url", url, overlay }
                                  : item,
                              ),
                            );
                            toast.success(t("project.detail.artText.saved"));
                          } catch (err) {
                            toast.error(
                              err instanceof Error
                                ? err.message
                                : t("project.detail.artText.saveError"),
                            );
                            throw err;
                          }
                        },
                      }
                    : undefined
                }
              />
            </CardContent>
          </Card>

          {isAdmin ? (
            <ContentAiAssistant
              key={contentId}
              contentId={contentId}
              projectId={projectId}
              clientId={clientId}
              format={formatType}
              onApply={async (suggestion) => {
                const translated = await translateManyFields({
                  title: suggestion.title,
                  caption: suggestion.caption,
                  cta: suggestion.cta,
                  hashtags: suggestion.hashtags,
                  ...(suggestion.theme ? { theme: suggestion.theme } : {}),
                  ...(formatType === "reels" ||
                  formatType === "recorded_video" ||
                  formatType === "youtube_short"
                    ? { locucao: suggestion.locucao }
                    : {}),
                  // Roteiro is never AI-translated — applied verbatim below.
                });
                let merged = mergeRowI18n(rowI18n, translated);
                setTitle(getLocalizedText(merged, "title", suggestion.title, uiLocale));
                setCaption(getLocalizedText(merged, "caption", suggestion.caption, uiLocale));
                setCta(getLocalizedText(merged, "cta", suggestion.cta, uiLocale));
                setHashtags(getLocalizedText(merged, "hashtags", suggestion.hashtags, uiLocale));
                if (suggestion.theme) {
                  setTheme(getLocalizedText(merged, "theme", suggestion.theme, uiLocale));
                }
                if (
                  formatType === "reels" ||
                  formatType === "recorded_video" ||
                  formatType === "youtube_short"
                ) {
                  setLocucao(getLocalizedText(merged, "locucao", suggestion.locucao, uiLocale));
                }
                if (formatType === "carousel") {
                  const nextRoteiro = suggestion.roteiro ?? "";
                  merged = setLocalizedField(
                    merged,
                    "roteiro",
                    buildVerbatimLocalizedField(nextRoteiro, uiLocale),
                  );
                  setRoteiro(nextRoteiro);
                }
                setRowI18n(merged);
              }}
              onClearAppliedFields={() => {
                const empty = buildLocalizedFieldFromSource("", uiLocale);
                let next = rowI18n;
                const fields = ["title", "caption", "cta", "hashtags", "theme"] as const;
                for (const field of fields) {
                  next = setLocalizedField(next, field, empty);
                }
                if (
                  formatType === "reels" ||
                  formatType === "recorded_video" ||
                  formatType === "youtube_short"
                ) {
                  next = setLocalizedField(next, "locucao", empty);
                  setLocucao("");
                }
                if (formatType === "carousel") {
                  next = setLocalizedField(next, "roteiro", empty);
                  setRoteiro("");
                }
                setRowI18n(next);
                setTitle("");
                setCaption("");
                setCta("");
                setHashtags("");
                setTheme("");
              }}
            />
          ) : null}

          {isAdmin ? (
            <ContentDesignAssistant
              contentId={contentId}
              projectId={projectId}
              clientId={clientId}
              format={formatType}
              title={title}
              caption={caption}
              roteiro={roteiro}
              onApply={(items) => {
                if (usesDedicatedThumbnail && items[0]) {
                  setThumbnailFromFile(null);
                  setThumbnailUrl(items[0].url);
                  return;
                }
                setMediaItems(
                  items.map((item) => ({
                    id: createMediaId(),
                    kind: "url" as const,
                    url: item.url,
                    overlay: item.overlay ?? null,
                  })),
                );
                if (
                  formatType !== "carousel" &&
                  items.length > 1 &&
                  allowedFormats.includes("carousel")
                ) {
                  setFormatType("carousel");
                }
              }}
              onApplyAtIndex={(index, item) => {
                if (usesDedicatedThumbnail) {
                  setThumbnailFromFile(null);
                  setThumbnailUrl(item.url);
                  return true;
                }

                let applied = false;
                let nextRequiredSlide = 1;
                setMediaItems((prev) => {
                  if (index > prev.length) {
                    nextRequiredSlide = prev.length + 1;
                    return prev;
                  }
                  applied = true;
                  const entry: MediaEntry = {
                    id: createMediaId(),
                    kind: "url",
                    url: item.url,
                    overlay: item.overlay ?? null,
                  };
                  const next = [...prev];
                  if (index < next.length) {
                    next[index] = entry;
                  } else {
                    next.push(entry);
                  }
                  return next;
                });

                if (!applied) {
                  toast.error(
                    t("project.detail.designAssistant.approveNeedPrevious", {
                      n: nextRequiredSlide,
                    }),
                  );
                  return false;
                }

                if (
                  index > 0 &&
                  formatType !== "carousel" &&
                  allowedFormats.includes("carousel")
                ) {
                  setFormatType("carousel");
                }
                return true;
              }}
            />
          ) : null}

          <Card className="rounded-xl">
            <CardContent className="space-y-4 p-6">
              <div className="rounded-lg border bg-muted/20 p-3">
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {isPrintPiece ? (
                    <div className="space-y-1.5 sm:col-span-2">
                      <GraphicArtsMaterialFields
                        idPrefix="content-detail"
                        materialType={materialType}
                        widthCm={widthCm}
                        heightCm={heightCm}
                        onMaterialTypeChange={setMaterialType}
                        onWidthCmChange={setWidthCm}
                        onHeightCmChange={setHeightCm}
                      />
                    </div>
                  ) : (
                    <div className="space-y-1.5">
                      <Label variant="highlight">{t("project.detail.format")}</Label>
                      <ContentFormatSelect
                        format={formatType}
                        formats={allowedFormats}
                        onValueChange={(next) => {
                          setFormatType(next);
                          if (next !== "carousel" && mediaItems.length > 1) {
                            setMediaItems((prev) => prev.slice(0, 1));
                          }
                        }}
                      />
                    </div>
                  )}
                  <div className={cn("space-y-1.5", isPrintPiece && "sm:col-span-2")}>
                    <Label variant="highlight">{t("project.calendar.columns.theme")}</Label>
                    <Select
                      value={theme.trim() || NONE_THEME_VALUE}
                      onValueChange={(value) => {
                        if (value === NEW_THEME_VALUE) {
                          setNewTheme("");
                          setThemeDialogOpen(true);
                          return;
                        }
                        applyThemeSelection(value === NONE_THEME_VALUE ? "" : value);
                      }}
                    >
                      <SelectTrigger className="h-8 text-xs">
                        <SelectValue placeholder={t("project.calendar.selectTheme")} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={NONE_THEME_VALUE}>
                          {t("project.calendar.noTheme")}
                        </SelectItem>
                        {themeOptions.map((option) => (
                          <SelectItem key={option} value={option}>
                            {option}
                          </SelectItem>
                        ))}
                        <SelectItem value={NEW_THEME_VALUE}>
                          {t("project.calendar.newTheme")}
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  {!isPrintPiece ? (
                    <div className="space-y-1.5 sm:col-span-2">
                      <Label variant="highlight">{t("project.funnel.label")}</Label>
                      <Select
                        value={funnelStage ?? "none"}
                        onValueChange={(value) =>
                          setFunnelStage(value === "none" ? null : parseFunnelStage(value))
                        }
                      >
                        <SelectTrigger className="h-8 text-xs">
                          <SelectValue placeholder={t("project.funnel.none")} />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">{t("project.funnel.none")}</SelectItem>
                          {FUNNEL_STAGES.map((stage) => (
                            <SelectItem key={stage} value={stage}>
                              {t(`project.funnel.${stage}`)} — {t(`project.funnel.${stage}Hint`)}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  ) : null}
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="title" variant="highlight">
                  {isPrintPiece
                    ? t("project.graphicArts.pieceTitle")
                    : t("project.content.layoutText")}
                </Label>
                <LocalizedTextInput
                  id="title"
                  field="title"
                  i18n={rowI18n}
                  fallback={title}
                  onI18nCommit={onFieldI18nCommit}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="caption" variant="highlight">
                  {isPrintPiece
                    ? t("project.graphicArts.pieceCopy")
                    : t("project.detail.caption")}
                </Label>
                <LocalizedTextarea
                  id="caption"
                  field="caption"
                  i18n={rowI18n}
                  fallback={caption}
                  rows={8}
                  autoResize
                  className="min-h-[12rem]"
                  onI18nCommit={onFieldI18nCommit}
                />
              </div>
              {needsLocucao ? (
                <div className="space-y-1.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <Label htmlFor="locucao" variant="highlight">
                      {t("project.detail.locucao")}
                    </Label>
                    <Button
                      type="button"
                      variant="mint"
                      size="sm"
                      onClick={() => {
                        const el = document.getElementById("locucao");
                        const live =
                          el instanceof HTMLTextAreaElement ? el.value : locucao;
                        setTeleprompterText(live);
                        setTeleprompterOpen(true);
                      }}
                    >
                      {t("project.detail.teleprompter")}
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">{t("project.detail.locucaoHint")}</p>
                  <LocalizedTextarea
                    id="locucao"
                    field="locucao"
                    i18n={rowI18n}
                    fallback={locucao}
                    rows={10}
                    autoResize
                    className="min-h-[15rem]"
                    placeholder={t("project.detail.locucaoPlaceholder")}
                    onI18nCommit={onFieldI18nCommit}
                  />
                  <LocucaoTeleprompterDialog
                    open={teleprompterOpen}
                    onOpenChange={setTeleprompterOpen}
                    text={teleprompterText}
                  />
                </div>
              ) : null}
              {isCarousel ? (
                <div className="space-y-1.5">
                  <Label htmlFor="roteiro" variant="highlight">
                    {t("project.detail.roteiro")}
                  </Label>
                  <p className="text-xs text-muted-foreground">{t("project.detail.roteiroHint")}</p>
                  <Textarea
                    id="roteiro"
                    rows={6}
                    className="min-h-[10rem]"
                    placeholder={t("project.detail.roteiroPlaceholder")}
                    value={roteiro}
                    onChange={(e) => {
                      const next = e.target.value;
                      setRoteiro(next);
                      setRowI18n((prev) =>
                        setLocalizedField(
                          prev,
                          "roteiro",
                          buildVerbatimLocalizedField(next, uiLocale),
                        ),
                      );
                    }}
                  />
                </div>
              ) : null}
              <div className={cn("grid gap-4", isPrintPiece ? "sm:grid-cols-1" : "sm:grid-cols-2")}>
                <PresetField
                  id="cta"
                  label={
                    isPrintPiece
                      ? t("project.graphicArts.cta")
                      : t("project.detail.cta")
                  }
                  value={cta}
                  onChange={(value) => handlePresetChange("cta", value)}
                  onBlur={() => void translatePresetField("cta", ctaRef.current)}
                  presets={ctaPresets}
                  selectLabel={t("project.detail.selectCtaPreset")}
                  emptyPresetsLabel={t("project.detail.noCtaPresets")}
                  labelVariant="highlight"
                  create={
                    presetsAllowed
                      ? {
                          onCreate: (value) => persistTextPreset("cta", value),
                          label: t("project.detail.newCta"),
                          title: t("project.detail.newCtaTitle"),
                          hint: t("project.detail.newCtaHint"),
                          placeholder: t("project.detail.ctaPlaceholder"),
                          saveLabel: t("common.save"),
                          cancelLabel: t("common.cancel"),
                        }
                      : undefined
                  }
                />
                {!isPrintPiece ? (
                  <PresetField
                    id="hashtags"
                    label={t("project.detail.hashtags")}
                    value={hashtags}
                    onChange={(value) => handlePresetChange("hashtags", value)}
                    onBlur={() => void translatePresetField("hashtags", hashtagsRef.current)}
                    presets={hashtagPresets}
                    selectLabel={t("project.detail.selectHashtagPreset")}
                    emptyPresetsLabel={t("project.detail.noHashtagPresets")}
                    multiple
                    labelVariant="highlight"
                    create={
                      presetsAllowed
                        ? {
                            onCreate: (value) => persistTextPreset("hashtags", value),
                            label: t("project.detail.newHashtags"),
                            title: t("project.detail.newHashtagsTitle"),
                            hint: t("project.detail.newHashtagsHint"),
                            placeholder: t("project.detail.hashtagsPlaceholder"),
                            saveLabel: t("common.save"),
                            cancelLabel: t("common.cancel"),
                          }
                        : undefined
                    }
                  />
                ) : null}
              </div>
              {isPrintPiece ? (
                <div className="space-y-1.5">
                  <Label htmlFor="production-notes" variant="highlight">
                    {t("project.graphicArts.productionNotes")}
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    {t("project.graphicArts.productionNotesHint")}
                  </p>
                  <Textarea
                    id="production-notes"
                    value={productionNotes}
                    onChange={(e) => setProductionNotes(e.target.value)}
                    rows={4}
                    className="min-h-[6rem]"
                    placeholder={t("project.graphicArts.productionNotesPlaceholder")}
                  />
                </div>
              ) : null}
              {isAdmin ? (
                <>
                  {usesDedicatedThumbnail ? (
                    <div className="space-y-3">
                      <Label variant="highlight">
                        {t(isReelsPiece ? "project.detail.cover" : "project.detail.thumbnail")}
                      </Label>
                      <p className="text-xs text-muted-foreground">
                        {t(isReelsPiece ? "project.detail.coverHint" : "project.detail.thumbnailHint")}
                      </p>
                      <input
                        ref={thumbnailFileInputRef}
                        type="file"
                        className="sr-only"
                        accept={CLIENT_LOGO_ACCEPT}
                        onChange={(e) => {
                          const file = e.target.files?.[0] ?? null;
                          if (file) {
                            if (!file.type.startsWith("image/")) {
                              toast.error(
                                t(
                                  isReelsPiece
                                    ? "project.detail.coverImageOnly"
                                    : "project.detail.thumbnailImageOnly",
                                ),
                              );
                            } else {
                              setThumbnailFromFile(file);
                            }
                          }
                          e.target.value = "";
                        }}
                      />
                      <div className="flex flex-wrap items-center gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => thumbnailFileInputRef.current?.click()}
                        >
                          {t(isReelsPiece ? "project.detail.coverUpload" : "project.detail.thumbnailUpload")}
                        </Button>
                        {previewThumbnailUrl ? (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setThumbnailFromFile(null);
                              setThumbnailUrl("");
                            }}
                          >
                            {t(isReelsPiece ? "project.detail.coverRemove" : "project.detail.thumbnailRemove")}
                          </Button>
                        ) : null}
                      </div>
                      {previewThumbnailUrl ? (
                        isReelsPiece ? (
                          <p className="truncate text-xs text-muted-foreground" title={coverFileName}>
                            {coverFileName}
                          </p>
                        ) : (
                          <div className="overflow-hidden rounded-lg border bg-muted/20">
                            <img
                              src={previewThumbnailUrl}
                              alt=""
                              className="aspect-video max-h-40 w-full object-cover"
                            />
                          </div>
                        )
                      ) : null}
                    </div>
                  ) : null}
                  <div className="space-y-3">
                    <Label variant="highlight">{t("project.detail.media")}</Label>
                    <input
                      ref={mediaFileInputRef}
                      id="media-file"
                      type="file"
                      className="sr-only"
                      accept={CONTENT_MEDIA_ACCEPT}
                      multiple
                      onChange={(e) => {
                        const files = Array.from(e.target.files ?? []);
                        addFiles(files);
                        e.target.value = "";
                      }}
                    />
                    <Tabs
                      value={source}
                      onValueChange={(v) => setSource(v as SourceMode)}
                      className="w-full"
                    >
                      <TabsList
                        className={cn(
                          "grid w-full",
                          libraryAllowed ? "grid-cols-3" : "grid-cols-2",
                        )}
                      >
                        <TabsTrigger
                          value="file"
                          onClick={() => mediaFileInputRef.current?.click()}
                        >
                          {t("project.detail.sourceFile")}
                        </TabsTrigger>
                        <TabsTrigger value="url">{t("project.detail.sourceUrl")}</TabsTrigger>
                        {libraryAllowed ? (
                          <TabsTrigger
                            value="library"
                            onClick={() => setMediaLibraryOpen(true)}
                          >
                            {t("project.detail.sourceLibrary")}
                          </TabsTrigger>
                        ) : null}
                      </TabsList>
                      <TabsContent value="file" className="space-y-1.5 pt-3">
                        <p className="text-xs text-muted-foreground">
                          {t("project.detail.mediaHint")}
                        </p>
                      </TabsContent>
                      <TabsContent value="url" className="space-y-1.5 pt-3">
                        <div className="flex flex-col gap-2 sm:flex-row">
                          <Input
                            id="media-url"
                            type="url"
                            className="min-w-0 flex-1"
                            value={urlDraft}
                            onChange={(e) => setUrlDraft(e.target.value)}
                            placeholder="https://"
                          />
                          <Button
                            type="button"
                            variant="outline"
                            className="shrink-0 sm:w-auto"
                            onClick={addUrl}
                          >
                            {t("project.detail.addSlide")}
                          </Button>
                        </div>
                      </TabsContent>
                      {libraryAllowed ? (
                        <TabsContent value="library" className="space-y-1.5 pt-3">
                          <p className="text-xs text-muted-foreground">
                            {t("project.detail.mediaLibraryHint")}
                          </p>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => setMediaLibraryOpen(true)}
                          >
                            {t("project.detail.mediaLibraryOpen")}
                          </Button>
                        </TabsContent>
                      ) : null}
                    </Tabs>
                    {libraryAllowed ? (
                      <ContentMediaLibraryPicker
                        clientId={clientId}
                        open={mediaLibraryOpen}
                        onOpenChange={setMediaLibraryOpen}
                        onSelect={addLibraryAsset}
                      />
                    ) : null}

                    {mediaItems.length > 0 ? (
                      <ul className="space-y-2 rounded-lg border p-3">
                        {mediaItems.map((item, index) => {
                          const label = item.kind === "file" ? item.file.name : item.url;
                          const canReorder = mediaItems.length > 1;
                          return (
                            <li
                              key={item.id}
                              draggable={canReorder}
                              onDragStart={canReorder ? onDragStart(index) : undefined}
                              onDragOver={canReorder ? onDragOver(index) : undefined}
                              onDrop={canReorder ? onDrop(index) : undefined}
                              onDragEnd={canReorder ? onDragEnd : undefined}
                              className={cn(
                                "flex items-center gap-2 rounded-md px-1 py-1 text-xs transition-colors",
                                canReorder && "cursor-grab active:cursor-grabbing",
                                dragIndex === index && "opacity-50",
                                dropIndex === index &&
                                  dragIndex !== null &&
                                  dragIndex !== index &&
                                  "bg-muted",
                              )}
                            >
                              {canReorder ? (
                                <span
                                  className="inline-flex shrink-0 text-muted-foreground"
                                  aria-hidden="true"
                                >
                                  <GripVertical className="h-3.5 w-3.5" />
                                </span>
                              ) : null}
                              <span className="min-w-0 flex-1 truncate text-muted-foreground">
                                {isCarousel || mediaItems.length > 1
                                  ? `${t("project.detail.slide")} ${index + 1}`
                                  : t("project.detail.media")}
                                {": "}
                                {label}
                              </span>
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 shrink-0"
                                onClick={() => removeMediaAt(index)}
                                aria-label={t("project.detail.removeMedia")}
                              >
                                <X className="h-3.5 w-3.5" aria-hidden="true" />
                              </Button>
                            </li>
                          );
                        })}
                      </ul>
                    ) : null}
                    {mediaItems.length > 1 ? (
                      <p className="text-xs text-muted-foreground">
                        {t("project.detail.reorderHint")}
                      </p>
                    ) : null}
                  </div>
                </>
              ) : null}
            </CardContent>
          </Card>

          <Card className="rounded-xl border-primary/20 bg-primary/5">
            <CardHeader>
              <CardTitle className="text-base">{t("project.detail.comments")}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {commentsQuery.isError ? (
                <p className="text-sm text-destructive">
                  {(commentsQuery.error as Error)?.message || t("project.detail.commentsLoadError")}
                </p>
              ) : null}
              {(commentsQuery.data ?? []).length === 0 && !commentsQuery.isError ? (
                <p className="text-sm text-muted-foreground">{t("project.detail.noComments")}</p>
              ) : (commentsQuery.data ?? []).length > 0 ? (
                <ul className="space-y-3">
                  {(commentsQuery.data ?? []).map((c) => (
                    <CommentThreadItem
                      key={c.id}
                      className="border-primary/15 bg-background"
                      authorName={c.profiles?.full_name?.trim() || t("project.detail.anonymous")}
                      createdAtLabel={formatDistanceToNow(new Date(c.created_at), {
                        addSuffix: true,
                        locale,
                      })}
                      body={getLocalizedText(c.i18n, "body", c.body, uiLocale)}
                      audioUrl={c.audio_url}
                      canEdit={c.user_id === user?.id}
                      canDelete={canManage || c.user_id === user?.id}
                      isSaving={
                        updateCommentMutation.isPending &&
                        updateCommentMutation.variables?.commentId === c.id
                      }
                      isDeleting={
                        deleteCommentMutation.isPending && deleteCommentMutation.variables === c.id
                      }
                      onSave={(body) => updateCommentMutation.mutateAsync({ commentId: c.id, body })}
                      onDelete={() => setDeleteCommentId(c.id)}
                    />
                  ))}
                </ul>
              ) : null}
              <CommentComposer
                value={comment}
                onChange={setComment}
                isPending={commentMutation.isPending}
                onSubmitText={() => commentMutation.mutateAsync({ body: comment })}
                onSubmitAudio={(blob) =>
                  commentMutation.mutateAsync({ body: "", audioBlob: blob })
                }
              />
            </CardContent>
          </Card>

          {isAdmin && !isPrintPiece ? (
            <Card className="rounded-xl border-amber-500/25 bg-amber-500/5">
              <CardHeader>
                <CardTitle className="text-base">{t("project.learning.title")}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-xs text-muted-foreground">{t("project.learning.hint")}</p>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label htmlFor="performance-reach">{t("project.learning.reach")}</Label>
                    <Input
                      id="performance-reach"
                      value={performanceReach}
                      onChange={(e) => setPerformanceReach(e.target.value)}
                      placeholder={t("project.learning.reachPlaceholder")}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="performance-retention">{t("project.learning.retention")}</Label>
                    <Input
                      id="performance-retention"
                      value={performanceRetention}
                      onChange={(e) => setPerformanceRetention(e.target.value)}
                      placeholder={t("project.learning.retentionPlaceholder")}
                    />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="performance-note">{t("project.learning.note")}</Label>
                  <Textarea
                    id="performance-note"
                    rows={2}
                    value={performanceNote}
                    onChange={(e) => setPerformanceNote(e.target.value)}
                    placeholder={t("project.learning.notePlaceholder")}
                  />
                </div>
                <label className="flex items-center gap-2 text-sm">
                  <Switch checked={repeatFormat} onCheckedChange={setRepeatFormat} />
                  {t("project.learning.repeat")}
                </label>
              </CardContent>
            </Card>
          ) : null}

          {renderSaveAndStatusCard("version-note")}
        </div>

        <div className="space-y-6">
          {renderSaveAndStatusCard("version-note-top")}

          <Card className="h-fit rounded-xl">
            <CardHeader>
              <CardTitle className="text-base">{t("project.detail.versions")}</CardTitle>
            </CardHeader>
            <CardContent>
              <ol className="space-y-3">
                {(versionsQuery.data ?? []).map((v) => {
                  const isCurrent = v.version_number === content.current_version;
                  const isViewing = viewingVersion?.id === v.id;
                  return (
                    <li
                      key={v.id}
                      className={cn(
                        "overflow-hidden rounded-md border text-sm transition-colors",
                        isViewing && "border-primary bg-muted/30",
                      )}
                    >
                      <button
                        type="button"
                        aria-label={t("project.detail.viewVersionAria", {
                          number: v.version_number,
                        })}
                        className="w-full space-y-2 p-3 text-left outline-none transition-colors hover:bg-muted/40 focus-visible:bg-muted/40"
                        onClick={() => setViewingVersion(v)}
                      >
                        <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between sm:gap-2">
                          <span className="min-w-0 font-medium">
                            {t("project.detail.version")} {v.version_number}
                            {isCurrent ? (
                              <span className="ml-2 text-xs text-primary">
                                ({t("project.detail.current")})
                              </span>
                            ) : null}
                          </span>
                          <span className="shrink-0 text-xs text-muted-foreground">
                            {format(new Date(v.created_at), "dd MMM yyyy HH:mm", { locale })}
                          </span>
                        </div>
                        {v.change_note ? (
                          <p className="text-xs text-muted-foreground">{v.change_note}</p>
                        ) : null}
                        <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                          <Eye className="h-3.5 w-3.5" aria-hidden="true" />
                          {t("project.detail.viewVersion")}
                        </span>
                      </button>
                      {isAdmin && !isCurrent ? (
                        <div className="border-t px-3 py-2">
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="h-7 px-2"
                            disabled={restoreMutation.isPending}
                            onClick={() => restoreMutation.mutate(v)}
                          >
                            {t("project.detail.restore")}
                          </Button>
                        </div>
                      ) : null}
                    </li>
                  );
                })}
              </ol>
            </CardContent>
          </Card>

          {showFeedMockup ? (
            isVideosProject ? (
              <YouTubeChannelMockup
                items={feedItems}
                clientId={clientId}
                projectId={projectId}
                username={client?.name}
                avatarUrl={client?.logo_url}
                className="mx-auto w-full"
              />
            ) : (
              <InstagramFeedMockup
                items={feedItems}
                clientId={clientId}
                projectId={projectId}
                username={client?.name}
                avatarUrl={client?.logo_url}
                className="mx-auto w-full"
              />
            )
          ) : null}
        </div>
      </div>

      <Dialog
        open={Boolean(viewingVersion)}
        onOpenChange={(open) => {
          if (!open) setViewingVersion(null);
        }}
      >
        <DialogContent className="max-h-[min(90dvh,calc(100vh-2rem))] max-w-2xl overflow-y-auto">
          {viewingVersion && versionPreview ? (
            <>
              <DialogHeader>
                <DialogTitle>
                  {t("project.detail.version")} {viewingVersion.version_number}
                  {viewingVersion.version_number === content.current_version ? (
                    <span className="ml-2 text-sm font-normal text-primary">
                      ({t("project.detail.current")})
                    </span>
                  ) : null}
                </DialogTitle>
                <DialogDescription>
                  {format(new Date(viewingVersion.created_at), "dd MMM yyyy HH:mm", { locale })}
                  {viewingVersion.change_note
                    ? ` · ${viewingVersion.change_note}`
                    : null}
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4">
                <ContentMediaPreview
                  items={versionPreview.previewItems}
                  format={versionPreview.format}
                  title={versionPreview.title}
                  caption={versionPreview.caption}
                  hashtags={versionPreview.hashtags}
                  cta={versionPreview.cta}
                  username={client?.name ?? versionPreview.title}
                  avatarUrl={client?.logo_url}
                  thumbnailUrl={versionPreview.thumbnailUrl}
                  materialType={versionPreview.materialType}
                  widthCm={versionPreview.widthCm}
                  heightCm={versionPreview.heightCm}
                />

                <div className="space-y-3 rounded-md border p-3">
                  <div className="space-y-1">
                    <p className="text-xs font-medium text-muted-foreground">
                      {t("project.content.title")}
                    </p>
                    <p className="text-sm">{versionPreview.title}</p>
                  </div>
                  {versionPreview.isPrint ? (
                    <>
                      <div className="space-y-1">
                        <p className="text-xs font-medium text-muted-foreground">
                          {t("project.graphicArts.materialType")}
                        </p>
                        <p className="text-sm">
                          {t(`project.graphicArts.materials.${versionPreview.materialType}`, {
                            defaultValue: versionPreview.materialType ?? "",
                          })}
                        </p>
                      </div>
                      <div className="space-y-1">
                        <p className="text-xs font-medium text-muted-foreground">
                          {t("project.graphicArts.dimensions")}
                        </p>
                        <p className="text-sm">
                          {versionPreview.widthCm ?? "—"} × {versionPreview.heightCm ?? "—"} cm
                        </p>
                      </div>
                    </>
                  ) : (
                    <div className="space-y-1">
                      <p className="text-xs font-medium text-muted-foreground">
                        {t("project.detail.format")}
                      </p>
                      <p className="text-sm">
                        {t(`project.detail.formats.${versionPreview.format}`)}
                      </p>
                    </div>
                  )}
                  {versionPreview.caption.trim() ? (
                    <div className="space-y-1">
                      <p className="text-xs font-medium text-muted-foreground">
                        {versionPreview.isPrint
                          ? t("project.graphicArts.pieceCopy")
                          : t("project.detail.caption")}
                      </p>
                      <p className="whitespace-pre-wrap text-sm">{versionPreview.caption}</p>
                    </div>
                  ) : null}
                  {versionPreview.needsLocucao && versionPreview.locucao.trim() ? (
                    <div className="space-y-1">
                      <p className="text-xs font-medium text-muted-foreground">
                        {t("project.detail.locucao")}
                      </p>
                      <p className="whitespace-pre-wrap text-sm">{versionPreview.locucao}</p>
                    </div>
                  ) : null}
                  {versionPreview.isCarousel && versionPreview.roteiro.trim() ? (
                    <div className="space-y-1">
                      <p className="text-xs font-medium text-muted-foreground">
                        {t("project.detail.roteiro")}
                      </p>
                      <p className="whitespace-pre-wrap text-sm">{versionPreview.roteiro}</p>
                    </div>
                  ) : null}
                  {versionPreview.cta.trim() ? (
                    <div className="space-y-1">
                      <p className="text-xs font-medium text-muted-foreground">
                        {versionPreview.isPrint
                          ? t("project.graphicArts.cta")
                          : t("project.detail.cta")}
                      </p>
                      <p className="text-sm">{versionPreview.cta}</p>
                    </div>
                  ) : null}
                  {!versionPreview.isPrint && versionPreview.hashtags.trim() ? (
                    <div className="space-y-1">
                      <p className="text-xs font-medium text-muted-foreground">
                        {t("project.detail.hashtags")}
                      </p>
                      <p className="text-sm">{versionPreview.hashtags}</p>
                    </div>
                  ) : null}
                  {versionPreview.isPrint && versionPreview.productionNotes.trim() ? (
                    <div className="space-y-1">
                      <p className="text-xs font-medium text-muted-foreground">
                        {t("project.graphicArts.productionNotes")}
                      </p>
                      <p className="whitespace-pre-wrap text-sm">
                        {versionPreview.productionNotes}
                      </p>
                    </div>
                  ) : null}
                </div>
              </div>

              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setViewingVersion(null)}>
                  {t("project.detail.closePreview")}
                </Button>
                {isAdmin &&
                viewingVersion.version_number !== content.current_version ? (
                  <Button
                    type="button"
                    disabled={restoreMutation.isPending}
                    onClick={() => restoreMutation.mutate(viewingVersion)}
                  >
                    {t("project.detail.restore")}
                  </Button>
                ) : null}
              </DialogFooter>
            </>
          ) : null}
        </DialogContent>
      </Dialog>

      <Dialog
        open={themeDialogOpen}
        onOpenChange={(open) => {
          if (!open && !addThemeMutation.isPending) {
            setThemeDialogOpen(false);
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
              if (!newTheme.trim()) return;
              addThemeMutation.mutate(newTheme.trim());
            }}
          >
            <div className="space-y-1.5">
              <Label htmlFor="content-new-theme">{t("project.calendar.columns.theme")}</Label>
              <Input
                id="content-new-theme"
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
                disabled={addThemeMutation.isPending}
                onClick={() => {
                  setThemeDialogOpen(false);
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
        open={Boolean(deleteCommentId)}
        onOpenChange={(nextOpen) => {
          if (!nextOpen && !deleteCommentMutation.isPending) setDeleteCommentId(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("project.detail.deleteCommentConfirmTitle")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("project.detail.deleteCommentConfirmDescription")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteCommentMutation.isPending}>
              {t("common.cancel")}
            </AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={deleteCommentMutation.isPending || !deleteCommentId}
              onClick={(e) => {
                e.preventDefault();
                if (!deleteCommentId) return;
                deleteCommentMutation.mutate(deleteCommentId);
              }}
            >
              {t("project.detail.deleteComment")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
