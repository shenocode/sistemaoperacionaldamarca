import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { formatDistanceToNow } from "date-fns";
import { ptBR, enUS, es } from "date-fns/locale";
import {
  Check,
  ChevronLeft,
  History,
  MessageSquareWarning,
  Send,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { StatusBadge, type ContentStatus, isClientActionableStatus } from "@/components/status-badge";
import {
  ContentMediaPreview,
  type PreviewMediaItem,
} from "@/components/content-media-preview";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  addComment,
  listComments,
  saveClientContentVersion,
  setContentStatus,
  updateCommentI18n,
  type CommentWithAuthor,
  type ContentFormat,
} from "@/lib/api";
import {
  buildLocalizedFieldFromSource,
  getCanonicalText,
  getLocalizedText,
  normalizeAppLocale,
  translateTextField,
  type RowI18n,
} from "@/lib/i18n-content";
import { backfillRowsForLocale } from "@/hooks/use-i18n-backfill";
import type { LanguageCode } from "@/i18n";

const dateLocales = { "pt-BR": ptBR, "en-US": enUS, "es-ES": es };

type ClientContentApprovalViewProps = {
  clientId: string;
  projectId: string;
  contentId: string;
  title: string;
  status: ContentStatus;
  format: ContentFormat;
  caption: string;
  locucao?: string;
  hashtags: string;
  cta: string;
  previewItems: PreviewMediaItem[];
  username?: string;
  avatarUrl?: string | null;
  onCaptionChange: (value: string) => void;
  onHashtagsChange: (value: string) => void;
  onCtaChange: (value: string) => void;
};

async function buildCommentI18n(text: string, locale: string): Promise<{ body: string; i18n: RowI18n }> {
  let i18n: RowI18n = {};
  try {
    const block = await translateTextField({ text });
    i18n = { body: block };
  } catch {
    i18n = { body: buildLocalizedFieldFromSource(text, locale) };
  }
  return {
    body: getCanonicalText(i18n, "body", text),
    i18n,
  };
}

export function ClientContentApprovalView({
  clientId,
  projectId,
  contentId,
  title,
  status,
  format,
  caption,
  locucao = "",
  hashtags,
  cta,
  previewItems,
  username,
  avatarUrl,
  onCaptionChange,
  onHashtagsChange,
  onCtaChange,
}: ClientContentApprovalViewProps) {
  const { t, i18n } = useTranslation();
  const queryClient = useQueryClient();
  const uiLocale = normalizeAppLocale(i18n.resolvedLanguage ?? i18n.language);
  const locale = dateLocales[(i18n.language as LanguageCode) ?? "pt-BR"] ?? ptBR;
  const [comment, setComment] = useState("");
  const [changesOpen, setChangesOpen] = useState(false);
  const [changesNote, setChangesNote] = useState("");
  const [commentsOpen, setCommentsOpen] = useState(false);
  const showLocucao =
    (format === "reels" || format === "recorded_video") && locucao.trim().length > 0;

  const commentsQuery = useQuery({
    queryKey: ["comments", contentId],
    queryFn: () => listComments(contentId),
  });

  useEffect(() => {
    const comments = commentsQuery.data;
    if (!comments?.length) return;
    let cancelled = false;
    void (async () => {
      const improved = await backfillRowsForLocale({
        rows: comments,
        locale: uiLocale,
        getKey: (c) => c.id,
        getI18n: (c) => c.i18n,
        getFields: (c) => ({ body: c.body }),
        persist: async (c, nextI18n) => {
          const row = await updateCommentI18n(c.id, nextI18n);
          if (cancelled) return;
          queryClient.setQueryData<CommentWithAuthor[]>(["comments", contentId], (prev) =>
            (prev ?? []).map((item) =>
              item.id === row.id ? { ...item, ...row, profiles: item.profiles } : item,
            ),
          );
        },
        concurrency: 2,
      });
      if (!cancelled && improved > 0) {
        void queryClient.invalidateQueries({ queryKey: ["comments", contentId] });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [commentsQuery.data, contentId, queryClient, uiLocale]);

  const invalidateAll = () => {
    queryClient.invalidateQueries({ queryKey: ["content"] });
    queryClient.invalidateQueries({ queryKey: ["comments", contentId] });
    queryClient.invalidateQueries({ queryKey: ["versions", contentId] });
    queryClient.invalidateQueries({ queryKey: ["dashboard"] });
  };

  const versionMutation = useMutation({
    mutationFn: () =>
      saveClientContentVersion({
        contentId,
        clientId,
        projectId,
        title,
        format,
        caption,
        cta,
        hashtags,
      }),
    onSuccess: () => {
      invalidateAll();
      toast.success(t("project.detail.versionCreated"));
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
        title,
      }),
    onSuccess: (_row, next) => {
      invalidateAll();
      if (next === "approved") toast.success(t("project.detail.approvedToast"));
      else if (next === "changes") toast.success(t("project.detail.changesToast"));
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const commentMutation = useMutation({
    mutationFn: async () => {
      const payload = await buildCommentI18n(comment, uiLocale);
      return addComment({
        contentId,
        clientId,
        projectId,
        body: payload.body,
        contentTitle: title,
        i18n: payload.i18n,
      });
    },
    onSuccess: (row) => {
      setComment("");
      const next: CommentWithAuthor = { ...row, profiles: null };
      queryClient.setQueryData<CommentWithAuthor[]>(["comments", contentId], (prev) => {
        const list = prev ?? [];
        if (list.some((c) => c.id === row.id)) return list;
        return [...list, next];
      });
      invalidateAll();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const requestChanges = async () => {
    if (changesNote.trim()) {
      const payload = await buildCommentI18n(changesNote.trim(), uiLocale);
      const row = await addComment({
        contentId,
        clientId,
        projectId,
        body: payload.body,
        contentTitle: title,
        i18n: payload.i18n,
      });
      const next: CommentWithAuthor = { ...row, profiles: null };
      queryClient.setQueryData<CommentWithAuthor[]>(["comments", contentId], (prev) => {
        const list = prev ?? [];
        if (list.some((c) => c.id === row.id)) return list;
        return [...list, next];
      });
    }
    statusMutation.mutate("changes");
    setChangesOpen(false);
    setChangesNote("");
  };

  const canApprove = isClientActionableStatus(status);
  const busy = versionMutation.isPending || statusMutation.isPending;

  return (
    <div className="-mx-4 -mt-6 min-h-[calc(100vh-8rem)] bg-gradient-to-b from-neutral-100 via-neutral-50 to-background sm:-mx-6 md:-mx-8">
      <div className="mx-auto flex max-w-3xl flex-col px-4 pb-10 pt-4 sm:px-6">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <Link
            to="/clients/$clientId/projects/$projectId/content"
            params={{ clientId, projectId }}
            search={{}}
            className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
          >
            <ChevronLeft className="h-4 w-4" aria-hidden="true" />
            {t("project.tabs.content")}
          </Link>
          <div className="flex items-center gap-2">
            <StatusBadge status={status} asButton />
            <span className="text-sm font-medium text-foreground">{title}</span>
          </div>
        </div>

        <div className="flex flex-1 flex-col items-center justify-center py-4">
          <ContentMediaPreview
            items={previewItems}
            format={format}
            title={title}
            caption={caption}
            hashtags={hashtags}
            cta={cta}
            username={username ?? title}
            avatarUrl={avatarUrl}
            editable
            size="lg"
            onCaptionChange={onCaptionChange}
            onHashtagsChange={onHashtagsChange}
            onCtaChange={onCtaChange}
          />
        </div>

        {showLocucao ? (
          <div className="mx-auto mt-4 w-full max-w-[420px] space-y-1.5 rounded-xl border bg-background/80 p-4">
            <p className="text-sm font-medium text-foreground">
              {t("project.detail.locucao")}
            </p>
            <p className="text-xs text-muted-foreground">
              {t("project.detail.locucaoHint")}
            </p>
            <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground">
              {locucao}
            </p>
          </div>
        ) : null}

        <div className="mx-auto mt-6 flex w-full max-w-[420px] flex-col gap-3">
          <Button
            type="button"
            size="lg"
            disabled={busy}
            onClick={() => versionMutation.mutate()}
            className="w-full"
          >
            <History className="mr-2 h-4 w-4" aria-hidden="true" />
            {versionMutation.isPending
              ? t("common.loading")
              : t("project.detail.saveVersion")}
          </Button>

          {canApprove ? (
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <Button
                type="button"
                variant="default"
                disabled={busy}
                onClick={() => statusMutation.mutate("approved")}
              >
                <Check className="mr-2 h-4 w-4" aria-hidden="true" />
                {t("project.detail.approve")}
              </Button>
              <Button
                type="button"
                variant="outline"
                disabled={busy}
                onClick={() => setChangesOpen(true)}
              >
                <MessageSquareWarning className="mr-2 h-4 w-4" aria-hidden="true" />
                {t("project.detail.requestChanges")}
              </Button>
            </div>
          ) : null}

          <Button
            type="button"
            variant="ghost"
            className="text-muted-foreground"
            onClick={() => setCommentsOpen((open) => !open)}
          >
            {commentsOpen
              ? t("clientApproval.hideComments")
              : t("clientApproval.showComments", {
                  count: commentsQuery.data?.length ?? 0,
                })}
          </Button>

          {commentsOpen ? (
            <div className="space-y-4 rounded-xl border bg-card p-4">
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
                    <li key={c.id} className="rounded-md border p-3 text-sm">
                      <div className="mb-1 flex items-center justify-between gap-2">
                        <span className="font-medium">
                          {c.profiles?.full_name?.trim() || t("project.detail.anonymous")}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {formatDistanceToNow(new Date(c.created_at), {
                            addSuffix: true,
                            locale,
                          })}
                        </span>
                      </div>
                      <p className="whitespace-pre-wrap text-muted-foreground">
                        {getLocalizedText(c.i18n, "body", c.body, uiLocale)}
                      </p>
                    </li>
                  ))}
                </ul>
              ) : null}
              <form
                className="flex gap-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  if (!comment.trim()) return;
                  commentMutation.mutate();
                }}
              >
                <Input
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  placeholder={t("project.detail.leaveComment")}
                  aria-label={t("project.detail.leaveComment")}
                />
                <Button
                  type="submit"
                  size="icon"
                  aria-label={t("project.detail.send")}
                  disabled={commentMutation.isPending || !comment.trim()}
                >
                  <Send className="h-4 w-4" />
                </Button>
              </form>
            </div>
          ) : null}
        </div>
      </div>

      <Dialog open={changesOpen} onOpenChange={setChangesOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("project.detail.requestChanges")}</DialogTitle>
          </DialogHeader>
          <Textarea
            value={changesNote}
            onChange={(e) => setChangesNote(e.target.value)}
            rows={4}
            placeholder={t("project.detail.changesNotePlaceholder")}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setChangesOpen(false)}>
              {t("common.cancel")}
            </Button>
            <Button onClick={() => void requestChanges()} disabled={statusMutation.isPending}>
              {t("project.detail.requestChanges")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
