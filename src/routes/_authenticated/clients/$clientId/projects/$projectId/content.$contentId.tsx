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
  Send,
  Save,
  History,
  Trash2,
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
import {
  ContentMediaPreview,
  guessMediaKind,
  type PreviewMediaItem,
} from "@/components/content-media-preview";
import { ContentAiAssistant } from "@/components/content-ai-assistant";
import { ContentDesignAssistant } from "@/components/content-design-assistant";
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
  addComment,
  addProjectThemePreset,
  canManageClient,
  contentFormatsForProject,
  defaultContentFormatForProject,
  deleteComment,
  getClient,
  getContent,
  getProject,
  listComments,
  listVersions,
  resolveContentMediaUrls,
  restoreVersion,
  saveClientContentVersion,
  saveContentAsNewVersion,
  setContentStatus,
  updateContentFields,
  uploadContentMediaFiles,
  getLocalizedText,
  getCanonicalText,
  parseRowI18n,
  normalizeAppLocale,
  setLocalizedField,
  mergeRowI18n,
  translateTextField,
  translateManyFields,
  buildLocalizedFieldFromSource,
  type ContentFormat,
  type ContentVersion,
  type RowI18n,
} from "@/lib/api";
import type { LanguageCode } from "@/i18n";
import { useAppRole } from "@/hooks/use-app-role";
import { useAuth } from "@/hooks/use-auth";
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

const dateLocales = { "pt-BR": ptBR, "en-US": enUS, "es-ES": es };
const NONE_THEME_VALUE = "__none__";
const NEW_THEME_VALUE = "__new_theme__";
type SourceMode = "file" | "url";

type MediaEntry =
  { id: string; kind: "url"; url: string } | { id: string; kind: "file"; file: File };

function createMediaId() {
  return crypto.randomUUID();
}

function mediaEntriesFromUrls(urls: string[]): MediaEntry[] {
  return urls.filter(Boolean).map((url) => ({ id: createMediaId(), kind: "url" as const, url }));
}

function serializeMediaForDirty(items: MediaEntry[]) {
  return items.map((item) =>
    item.kind === "url"
      ? { kind: "url" as const, url: item.url }
      : {
          kind: "file" as const,
          name: item.file.name,
          size: item.file.size,
          type: item.file.type,
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
  mediaItems: MediaEntry[];
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
    media: serializeMediaForDirty(input.mediaItems),
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
  const [mediaItems, setMediaItems] = useState<MediaEntry[]>([]);
  const [source, setSource] = useState<SourceMode>("file");
  const [urlDraft, setUrlDraft] = useState("");
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
  const [viewingVersion, setViewingVersion] = useState<ContentVersion | null>(null);
  const mediaFileInputRef = useRef<HTMLInputElement>(null);

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

  const content = contentQuery.data;
  const client = clientQuery.data;
  const ctaPresets = projectQuery.data?.cta_presets ?? [];
  const hashtagPresets = projectQuery.data?.hashtag_presets ?? [];
  const themePresets = projectQuery.data?.theme_presets ?? [];
  const allowedFormats = contentFormatsForProject(projectQuery.data?.categories);
  const canManage = manageQuery.data ?? false;
  const status = (content?.status ?? "draft") as ContentStatus;
  const isCarousel = formatType === "carousel";
  const needsLocucao = formatType === "reels" || formatType === "recorded_video";
  const themeOptions = useMemo(() => {
    const current = theme.trim();
    return Array.from(new Set([...themePresets, ...(current ? [current] : [])])).sort((a, b) =>
      a.localeCompare(b, i18n.language),
    );
  }, [themePresets, theme, i18n.language]);
  const [blobUrls, setBlobUrls] = useState<Record<string, string>>({});
  const previewItems: PreviewMediaItem[] = mediaItems
    .map((item) => {
      if (item.kind === "url") return { url: item.url };
      const url = blobUrls[item.id] ?? "";
      return {
        url,
        kind: guessMediaKind(item.file),
        name: item.file.name,
      };
    })
    .filter((item) => item.url);

  const uiLocale = normalizeAppLocale(i18n.resolvedLanguage ?? i18n.language);

  useEffect(() => {
    if (!content) return;
    const nextI18n = parseRowI18n(content.i18n);
    const nextTitle = getLocalizedText(nextI18n, "title", content.title, uiLocale);
    const nextCaption = getLocalizedText(nextI18n, "caption", content.caption, uiLocale);
    const nextLocucao = getLocalizedText(nextI18n, "locucao", content.locucao ?? "", uiLocale);
    const nextRoteiro = getLocalizedText(nextI18n, "roteiro", content.roteiro ?? "", uiLocale);
    const nextCta = getLocalizedText(nextI18n, "cta", content.cta, uiLocale);
    const nextHashtags = getLocalizedText(nextI18n, "hashtags", content.hashtags, uiLocale);
    const nextTheme = getLocalizedText(nextI18n, "theme", content.theme ?? "", uiLocale);
    const nextFormat =
      content.format ?? defaultContentFormatForProject(projectQuery.data?.categories);
    const nextMedia = mediaEntriesFromUrls(resolveContentMediaUrls(content));
    setRowI18n(nextI18n);
    setTitle(nextTitle);
    setCaption(nextCaption);
    setLocucao(nextLocucao);
    setRoteiro(nextRoteiro);
    setCta(nextCta);
    setHashtags(nextHashtags);
    setTheme(nextTheme);
    setFormatType(nextFormat);
    setMediaItems(nextMedia);
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
        mediaItems: nextMedia,
        rowI18n: nextI18n,
      }),
    );
    setIgnoreUnsavedChanges(false);
  }, [content, uiLocale, projectQuery.data?.categories]);

  const formSnapshot = buildContentFormSnapshot({
    title,
    caption,
    locucao,
    roteiro,
    cta,
    hashtags,
    theme,
    formatType,
    mediaItems,
    rowI18n,
  });
  const isDirty = Boolean(formBaseline) && !ignoreUnsavedChanges && formSnapshot !== formBaseline;

  const onFieldI18nCommit = (payload: {
    field: string;
    display: string;
    canonical: string;
    i18n: RowI18n;
  }) => {
    setRowI18n(payload.i18n);
    if (payload.field === "title") setTitle(payload.display);
    if (payload.field === "caption") setCaption(payload.display);
    if (payload.field === "locucao") setLocucao(payload.display);
    if (payload.field === "roteiro") setRoteiro(payload.display);
    if (payload.field === "cta") setCta(payload.display);
    if (payload.field === "hashtags") setHashtags(payload.display);
    if (payload.field === "theme") setTheme(payload.display);
    if (payload.field === "versionNote") setVersionNote(payload.display);
  };

  const translatePresetField = async (field: "cta" | "hashtags" | "theme", value: string) => {
    try {
      const block = await translateTextField({ text: value });
      const merged = setLocalizedField(rowI18n, field, block);
      setRowI18n(merged);
      const display = getLocalizedText(merged, field, value, uiLocale);
      if (field === "cta") setCta(display);
      if (field === "hashtags") setHashtags(display);
      if (field === "theme") setTheme(display);
    } catch {
      const block = buildLocalizedFieldFromSource(value, uiLocale);
      setRowI18n(setLocalizedField(rowI18n, field, block));
    }
  };

  const buildSavePayload = () => {
    const i18nPayload = rowI18n;
    return {
      title: getCanonicalText(i18nPayload, "title", title),
      caption: getCanonicalText(i18nPayload, "caption", caption),
      cta: getCanonicalText(i18nPayload, "cta", cta),
      hashtags: getCanonicalText(i18nPayload, "hashtags", hashtags),
      locucao: getCanonicalText(i18nPayload, "locucao", locucao),
      roteiro: getCanonicalText(i18nPayload, "roteiro", roteiro),
      theme: getCanonicalText(i18nPayload, "theme", theme.trim()) || null,
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
  };

  const resolveMediaForSave = async () => {
    const pendingFiles = mediaItems
      .filter((item): item is Extract<MediaEntry, { kind: "file" }> => item.kind === "file")
      .map((item) => item.file);
    const uploaded = pendingFiles.length
      ? await uploadContentMediaFiles(projectId, pendingFiles)
      : [];
    let fileIndex = 0;
    const urls = mediaItems
      .map((item) => {
        if (item.kind === "url") return item.url;
        return uploaded[fileIndex++] ?? "";
      })
      .filter(Boolean);
    if (!isCarousel) return urls.slice(0, 1);
    return urls;
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      const urls = await resolveMediaForSave();
      const payload = buildSavePayload();
      return updateContentFields({
        contentId,
        title: payload.title,
        caption: payload.caption,
        cta: payload.cta,
        hashtags: payload.hashtags,
        locucao: payload.locucao,
        roteiro: payload.roteiro,
        mediaUrls: urls,
        format: formatType,
        theme: payload.theme,
        i18n: payload.i18n,
      });
    },
    onSuccess: () => {
      setIgnoreUnsavedChanges(true);
      invalidateAll();
      toast.success(t("common.saved"));
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const versionMutation = useMutation({
    mutationFn: async () => {
      const payload = buildSavePayload();
      const noteCanonical = getCanonicalText(rowI18n, "versionNote", versionNote);
      // Clients save title/format/theme/copy via RPC; admins save full content as a new version.
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
          format: formatType,
          theme: payload.theme,
          changeNote: noteCanonical,
          i18n: payload.i18n,
        });
      }
      const urls = await resolveMediaForSave();
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
        format: formatType,
        theme: payload.theme,
        changeNote: noteCanonical,
        i18n: payload.i18n,
      });
    },
    onSuccess: () => {
      setVersionNote("");
      setIgnoreUnsavedChanges(true);
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
      setTheme(nextTheme);
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
    onSuccess: (_row, next) => {
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
    mutationFn: async () => {
      let commentI18n: RowI18n = {};
      try {
        const block = await translateTextField({ text: comment });
        commentI18n = { body: block };
      } catch {
        commentI18n = { body: buildLocalizedFieldFromSource(comment, uiLocale) };
      }
      const bodyCanonical =
        (commentI18n.body as { values?: Record<string, string>; source?: string })?.values?.[
          (commentI18n.body as { source?: string })?.source ?? "pt-BR"
        ] ?? comment;
      return addComment({
        contentId,
        clientId,
        projectId,
        body: bodyCanonical,
        contentTitle: content?.title ?? title,
        i18n: commentI18n,
      });
    },
    onSuccess: () => {
      setComment("");
      invalidateAll();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const deleteCommentMutation = useMutation({
    mutationFn: (commentId: string) => deleteComment(commentId),
    onSuccess: () => {
      setDeleteCommentId(null);
      invalidateAll();
      toast.success(t("project.detail.commentDeleted"));
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const restoreMutation = useMutation({
    mutationFn: (version: ContentVersion) =>
      restoreVersion({ contentId, clientId, projectId, version }),
    onSuccess: () => {
      setViewingVersion(null);
      setIgnoreUnsavedChanges(true);
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
      previewItems: resolveContentMediaUrls(viewingVersion).map((url) => ({ url })),
      needsLocucao: format === "reels" || format === "recorded_video",
      isCarousel: format === "carousel",
    };
  }, [viewingVersion, content, uiLocale]);

  const addUrl = () => {
    const next = urlDraft.trim();
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
    setUrlDraft("");
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
        to="/clients/$clientId/projects/$projectId/content"
        params={{ clientId, projectId }}
        search={{}}
        replace
      />
    );
  }

  // Same form for admin and client. Clients edit title/format/theme/copy; media stays admin-only.
  // Clients always get approve / production-adjustment actions on content they can open
  // (draft is already redirected away above).
  const statusButtons = isAdmin ? CONTENT_STATUSES : CLIENT_REVIEW_STATUSES;
  const saving = saveMutation.isPending || versionMutation.isPending;

  return (
    <div className="space-y-6">
      <UnsavedChangesGuard isDirty={isDirty} />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link
          to="/clients/$clientId/projects/$projectId/content"
          params={{ clientId, projectId }}
          search={{}}
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ChevronLeft className="h-4 w-4" aria-hidden="true" />
          {t("project.tabs.content")}
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
              />
            </CardContent>
          </Card>

          {isAdmin ? (
            <ContentAiAssistant
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
                  ...(formatType === "reels" || formatType === "recorded_video"
                    ? { locucao: suggestion.locucao }
                    : {}),
                  ...(formatType === "carousel" ? { roteiro: suggestion.roteiro } : {}),
                });
                const merged = mergeRowI18n(rowI18n, translated);
                setRowI18n(merged);
                setTitle(getLocalizedText(merged, "title", suggestion.title, uiLocale));
                setCaption(getLocalizedText(merged, "caption", suggestion.caption, uiLocale));
                setCta(getLocalizedText(merged, "cta", suggestion.cta, uiLocale));
                setHashtags(getLocalizedText(merged, "hashtags", suggestion.hashtags, uiLocale));
                if (suggestion.theme) {
                  setTheme(getLocalizedText(merged, "theme", suggestion.theme, uiLocale));
                }
                if (formatType === "reels" || formatType === "recorded_video") {
                  setLocucao(getLocalizedText(merged, "locucao", suggestion.locucao, uiLocale));
                }
                if (formatType === "carousel") {
                  setRoteiro(getLocalizedText(merged, "roteiro", suggestion.roteiro, uiLocale));
                }
              }}
            />
          ) : null}

          {isAdmin && (formatType === "static_feed" || formatType === "carousel") ? (
            <ContentDesignAssistant
              contentId={contentId}
              projectId={projectId}
              clientId={clientId}
              format={formatType}
              title={title}
              caption={caption}
              roteiro={roteiro}
              onApply={(urls) => {
                setMediaItems(mediaEntriesFromUrls(urls));
                if (
                  formatType !== "carousel" &&
                  urls.length > 1 &&
                  allowedFormats.includes("carousel")
                ) {
                  setFormatType("carousel");
                }
              }}
            />
          ) : null}

          <Card className="rounded-xl">
            <CardContent className="space-y-4 p-6">
              <div className="-mx-6 -mt-6 space-y-1.5 rounded-t-xl bg-primary/5 px-6 pb-4 pt-6">
                <Label htmlFor="version-note" variant="highlight">
                  {t("project.detail.versionNote")}
                </Label>
                <LocalizedTextInput
                  id="version-note"
                  field="versionNote"
                  i18n={rowI18n}
                  fallback={versionNote}
                  placeholder={t("project.detail.versionNotePlaceholder")}
                  onI18nCommit={onFieldI18nCommit}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="title" variant="highlight">
                  {t("project.content.title")}
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
                <Label variant="highlight">{t("project.detail.format")}</Label>
                <Select
                  value={formatType}
                  onValueChange={(v) => {
                    const next = v as ContentFormat;
                    setFormatType(next);
                    if (next !== "carousel" && mediaItems.length > 1) {
                      setMediaItems((prev) => prev.slice(0, 1));
                    }
                  }}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {allowedFormats.map((key) => (
                      <SelectItem key={key} value={key}>
                        {t(`project.detail.formats.${key}`)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label variant="highlight">{t("project.calendar.columns.theme")}</Label>
                <Select
                  value={theme.trim() || NONE_THEME_VALUE}
                  onValueChange={(value) => {
                    if (value === NEW_THEME_VALUE) {
                      setNewTheme("");
                      setThemeDialogOpen(true);
                      return;
                    }
                    setTheme(value === NONE_THEME_VALUE ? "" : value);
                  }}
                >
                  <SelectTrigger>
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
              <div className="space-y-1.5">
                <Label htmlFor="caption" variant="highlight">
                  {t("project.detail.caption")}
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
                  <LocalizedTextarea
                    id="roteiro"
                    field="roteiro"
                    i18n={rowI18n}
                    fallback={roteiro}
                    rows={6}
                    disabled={!isAdmin}
                    placeholder={t("project.detail.roteiroPlaceholder")}
                    onI18nCommit={onFieldI18nCommit}
                  />
                </div>
              ) : null}
              <div className="grid gap-4 sm:grid-cols-2">
                <PresetField
                  id="cta"
                  label={t("project.detail.cta")}
                  value={cta}
                  onChange={setCta}
                  onBlur={() => void translatePresetField("cta", cta)}
                  presets={ctaPresets}
                  selectLabel={t("project.detail.selectCtaPreset")}
                  emptyPresetsLabel={t("project.detail.noCtaPresets")}
                  labelVariant="highlight"
                />
                <PresetField
                  id="hashtags"
                  label={t("project.detail.hashtags")}
                  value={hashtags}
                  onChange={setHashtags}
                  onBlur={() => void translatePresetField("hashtags", hashtags)}
                  presets={hashtagPresets}
                  selectLabel={t("project.detail.selectHashtagPreset")}
                  emptyPresetsLabel={t("project.detail.noHashtagPresets")}
                  multiple
                  labelVariant="highlight"
                />
              </div>
              {isAdmin ? (
                <>
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
                      <TabsList className="grid w-full grid-cols-2">
                        <TabsTrigger
                          value="file"
                          onClick={() => mediaFileInputRef.current?.click()}
                        >
                          {t("project.detail.sourceFile")}
                        </TabsTrigger>
                        <TabsTrigger value="url">{t("project.detail.sourceUrl")}</TabsTrigger>
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
                    </Tabs>

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

          <Card className="rounded-xl">
            <CardHeader>
              <CardTitle className="text-base">{t("project.detail.comments")}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {(commentsQuery.data ?? []).length === 0 ? (
                <p className="text-sm text-muted-foreground">{t("project.detail.noComments")}</p>
              ) : (
                <ul className="space-y-3">
                  {(commentsQuery.data ?? []).map((c) => {
                    const canDeleteComment = canManage || c.user_id === user?.id;
                    return (
                      <li key={c.id} className="rounded-md border p-3 text-sm">
                        <div className="mb-1 flex items-start justify-between gap-2">
                          <span className="min-w-0 flex-1 truncate font-medium">
                            {c.profiles?.full_name?.trim() || t("project.detail.anonymous")}
                          </span>
                          <div className="flex shrink-0 items-center gap-1">
                            <span className="text-xs text-muted-foreground">
                              {formatDistanceToNow(new Date(c.created_at), {
                                addSuffix: true,
                                locale,
                              })}
                            </span>
                            {canDeleteComment ? (
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 text-muted-foreground hover:text-destructive"
                                aria-label={t("project.detail.deleteComment")}
                                disabled={deleteCommentMutation.isPending}
                                onClick={() => setDeleteCommentId(c.id)}
                              >
                                <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                              </Button>
                            ) : null}
                          </div>
                        </div>
                        <p className="whitespace-pre-wrap text-muted-foreground">
                          {getLocalizedText(c.i18n, "body", c.body, uiLocale)}
                        </p>
                      </li>
                    );
                  })}
                </ul>
              )}
              <form
                className="flex gap-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  if (!comment.trim()) return;
                  commentMutation.mutate();
                }}
              >
                <Input
                  className="min-w-0 flex-1"
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  placeholder={t("project.detail.leaveComment")}
                  aria-label={t("project.detail.leaveComment")}
                />
                <Button
                  type="submit"
                  size="icon"
                  className="shrink-0"
                  aria-label={t("project.detail.send")}
                  disabled={commentMutation.isPending || !comment.trim()}
                >
                  <Send className="h-4 w-4" aria-hidden="true" />
                </Button>
              </form>
            </CardContent>
          </Card>

          <Card className="rounded-xl">
            <CardContent className="space-y-4 p-6">
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
        </div>

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
      </div>

      <Dialog
        open={Boolean(viewingVersion)}
        onOpenChange={(open) => {
          if (!open) setViewingVersion(null);
        }}
      >
        <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
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
                />

                <div className="space-y-3 rounded-md border p-3">
                  <div className="space-y-1">
                    <p className="text-xs font-medium text-muted-foreground">
                      {t("project.content.title")}
                    </p>
                    <p className="text-sm">{versionPreview.title}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs font-medium text-muted-foreground">
                      {t("project.detail.format")}
                    </p>
                    <p className="text-sm">
                      {t(`project.detail.formats.${versionPreview.format}`)}
                    </p>
                  </div>
                  {versionPreview.caption.trim() ? (
                    <div className="space-y-1">
                      <p className="text-xs font-medium text-muted-foreground">
                        {t("project.detail.caption")}
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
                        {t("project.detail.cta")}
                      </p>
                      <p className="text-sm">{versionPreview.cta}</p>
                    </div>
                  ) : null}
                  {versionPreview.hashtags.trim() ? (
                    <div className="space-y-1">
                      <p className="text-xs font-medium text-muted-foreground">
                        {t("project.detail.hashtags")}
                      </p>
                      <p className="text-sm">{versionPreview.hashtags}</p>
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
