import { useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { format, formatDistanceToNow } from "date-fns";
import { ptBR, enUS, es } from "date-fns/locale";
import {
  ChevronLeft,
  Check,
  MessageSquareWarning,
  Send,
  SendHorizonal,
  Save,
  History,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { StatusBadge, type ContentStatus } from "@/components/status-badge";
import {
  addComment,
  canManageClient,
  getContent,
  listComments,
  listVersions,
  restoreVersion,
  saveContentAsNewVersion,
  setContentStatus,
  updateContentFields,
  type ContentVersion,
} from "@/lib/api";
import type { LanguageCode } from "@/i18n";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const dateLocales = { "pt-BR": ptBR, "en-US": enUS, "es-ES": es };

export const Route = createFileRoute(
  "/_authenticated/clients/$clientId/projects/$projectId/content/$contentId",
)({
  head: () => ({ meta: [{ title: "Conteúdo — SOM" }, { name: "robots", content: "noindex" }] }),
  component: ContentDetailPage,
});

function ContentDetailPage() {
  const { clientId, projectId, contentId } = Route.useParams();
  const { t, i18n } = useTranslation();
  const queryClient = useQueryClient();
  const locale = dateLocales[(i18n.language as LanguageCode) ?? "pt-BR"] ?? ptBR;

  const [title, setTitle] = useState("");
  const [caption, setCaption] = useState("");
  const [cta, setCta] = useState("");
  const [hashtags, setHashtags] = useState("");
  const [mediaUrl, setMediaUrl] = useState("");
  const [comment, setComment] = useState("");
  const [changesOpen, setChangesOpen] = useState(false);
  const [changesNote, setChangesNote] = useState("");
  const [versionNote, setVersionNote] = useState("");

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

  const content = contentQuery.data;
  const canManage = manageQuery.data ?? false;
  const status = (content?.status ?? "draft") as ContentStatus;

  useEffect(() => {
    if (!content) return;
    setTitle(content.title);
    setCaption(content.caption);
    setCta(content.cta);
    setHashtags(content.hashtags);
    setMediaUrl(content.media_url ?? "");
  }, [content]);

  const invalidateAll = () => {
    queryClient.invalidateQueries({ queryKey: ["content"] });
    queryClient.invalidateQueries({ queryKey: ["comments", contentId] });
    queryClient.invalidateQueries({ queryKey: ["versions", contentId] });
    queryClient.invalidateQueries({ queryKey: ["dashboard"] });
  };

  const saveMutation = useMutation({
    mutationFn: () =>
      updateContentFields({
        contentId,
        title,
        caption,
        cta,
        hashtags,
        mediaUrl,
      }),
    onSuccess: () => {
      invalidateAll();
      toast.success(t("common.saved"));
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const versionMutation = useMutation({
    mutationFn: () =>
      saveContentAsNewVersion({
        contentId,
        clientId,
        projectId,
        title,
        caption,
        cta,
        hashtags,
        mediaUrl,
        changeNote: versionNote,
      }),
    onSuccess: () => {
      setVersionNote("");
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
        title: content?.title ?? title,
      }),
    onSuccess: (_row, next) => {
      invalidateAll();
      if (next === "approved") toast.success(t("project.detail.approvedToast"));
      else if (next === "changes") toast.success(t("project.detail.changesToast"));
      else if (next === "review") toast.success(t("project.detail.submittedToast"));
      else if (next === "published") toast.success(t("project.detail.publishedToast"));
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const commentMutation = useMutation({
    mutationFn: () =>
      addComment({
        contentId,
        clientId,
        projectId,
        body: comment,
        contentTitle: content?.title ?? title,
      }),
    onSuccess: () => {
      setComment("");
      invalidateAll();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const restoreMutation = useMutation({
    mutationFn: (version: ContentVersion) =>
      restoreVersion({ contentId, clientId, projectId, version }),
    onSuccess: () => {
      invalidateAll();
      toast.success(t("project.detail.restored"));
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const requestChanges = async () => {
    if (changesNote.trim()) {
      await addComment({
        contentId,
        clientId,
        projectId,
        body: changesNote.trim(),
        contentTitle: content?.title ?? title,
      });
    }
    statusMutation.mutate("changes");
    setChangesOpen(false);
    setChangesNote("");
  };

  if (contentQuery.isLoading) {
    return <p className="text-sm text-muted-foreground">{t("common.loading")}</p>;
  }

  if (!content) {
    return <p className="text-sm text-muted-foreground">{t("project.detail.notFound")}</p>;
  }

  const canApprove = status === "review";
  const canSubmit = canManage && (status === "draft" || status === "changes");
  const canPublish = canManage && status === "approved";

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link
          to="/clients/$clientId/projects/$projectId/content"
          params={{ clientId, projectId }}
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ChevronLeft className="h-4 w-4" aria-hidden="true" />
          {t("project.tabs.content")}
        </Link>
        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge status={status} />
          {canSubmit ? (
            <Button
              variant="secondary"
              disabled={statusMutation.isPending}
              onClick={() => statusMutation.mutate("review")}
            >
              <SendHorizonal className="mr-2 h-4 w-4" aria-hidden="true" />
              {t("project.detail.submitReview")}
            </Button>
          ) : null}
          {canApprove ? (
            <>
              <Button variant="outline" onClick={() => setChangesOpen(true)}>
                <MessageSquareWarning className="mr-2 h-4 w-4" aria-hidden="true" />
                {t("project.detail.requestChanges")}
              </Button>
              <Button
                disabled={statusMutation.isPending}
                onClick={() => statusMutation.mutate("approved")}
              >
                <Check className="mr-2 h-4 w-4" aria-hidden="true" />
                {t("project.detail.approve")}
              </Button>
            </>
          ) : null}
          {canPublish ? (
            <Button
              disabled={statusMutation.isPending}
              onClick={() => statusMutation.mutate("published")}
            >
              {t("project.detail.publish")}
            </Button>
          ) : null}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card className="rounded-xl">
            <CardHeader>
              <CardTitle className="text-base">{t("project.detail.preview")}</CardTitle>
            </CardHeader>
            <CardContent>
              {mediaUrl ? (
                <img
                  src={mediaUrl}
                  alt={title}
                  className="aspect-square w-full rounded-lg object-cover"
                />
              ) : (
                <div className="flex aspect-square w-full items-center justify-center rounded-lg bg-muted text-xs text-muted-foreground">
                  {t("project.detail.noPreview")}
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="rounded-xl">
            <CardContent className="space-y-4 p-6">
              <div className="space-y-1.5">
                <Label htmlFor="title">{t("project.content.title")}</Label>
                <Input
                  id="title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  disabled={!canManage}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="caption">{t("project.detail.caption")}</Label>
                <Textarea
                  id="caption"
                  rows={4}
                  value={caption}
                  onChange={(e) => setCaption(e.target.value)}
                  disabled={!canManage}
                />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="cta">{t("project.detail.cta")}</Label>
                  <Input
                    id="cta"
                    value={cta}
                    onChange={(e) => setCta(e.target.value)}
                    disabled={!canManage}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="hashtags">{t("project.detail.hashtags")}</Label>
                  <Input
                    id="hashtags"
                    value={hashtags}
                    onChange={(e) => setHashtags(e.target.value)}
                    disabled={!canManage}
                  />
                </div>
              </div>
              {canManage ? (
                <>
                  <div className="space-y-1.5">
                    <Label htmlFor="media">{t("project.detail.mediaUrl")}</Label>
                    <Input
                      id="media"
                      type="url"
                      value={mediaUrl}
                      onChange={(e) => setMediaUrl(e.target.value)}
                      placeholder="https://"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="version-note">{t("project.detail.versionNote")}</Label>
                    <Input
                      id="version-note"
                      value={versionNote}
                      onChange={(e) => setVersionNote(e.target.value)}
                      placeholder={t("project.detail.versionNotePlaceholder")}
                    />
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      disabled={saveMutation.isPending}
                      onClick={() => saveMutation.mutate()}
                    >
                      <Save className="mr-2 h-4 w-4" aria-hidden="true" />
                      {t("common.save")}
                    </Button>
                    <Button
                      type="button"
                      disabled={versionMutation.isPending}
                      onClick={() => versionMutation.mutate()}
                    >
                      <History className="mr-2 h-4 w-4" aria-hidden="true" />
                      {t("project.detail.saveVersion")}
                    </Button>
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
                  {(commentsQuery.data ?? []).map((c) => (
                    <li key={c.id} className="rounded-md border p-3 text-sm">
                      <div className="mb-1 flex items-center justify-between gap-2">
                        <span className="font-medium">
                          {c.profiles?.full_name || t("project.detail.anonymous")}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {formatDistanceToNow(new Date(c.created_at), {
                            addSuffix: true,
                            locale,
                          })}
                        </span>
                      </div>
                      <p className="whitespace-pre-wrap text-muted-foreground">{c.body}</p>
                    </li>
                  ))}
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
                  <Send className="h-4 w-4" aria-hidden="true" />
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>

        <Card className="h-fit rounded-xl">
          <CardHeader>
            <CardTitle className="text-base">{t("project.detail.versions")}</CardTitle>
          </CardHeader>
          <CardContent>
            <ol className="space-y-3">
              {(versionsQuery.data ?? []).map((v) => (
                <li
                  key={v.id}
                  className="space-y-2 rounded-md border p-3 text-sm"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium">
                      {t("project.detail.version")} {v.version_number}
                      {v.version_number === content.current_version ? (
                        <span className="ml-2 text-xs text-primary">
                          ({t("project.detail.current")})
                        </span>
                      ) : null}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {format(new Date(v.created_at), "dd MMM yyyy HH:mm", { locale })}
                    </span>
                  </div>
                  {v.change_note ? (
                    <p className="text-xs text-muted-foreground">{v.change_note}</p>
                  ) : null}
                  {canManage && v.version_number !== content.current_version ? (
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
                  ) : null}
                </li>
              ))}
            </ol>
          </CardContent>
        </Card>
      </div>

      <Dialog open={changesOpen} onOpenChange={setChangesOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("project.detail.requestChanges")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label htmlFor="changes-note">{t("project.detail.changesNote")}</Label>
            <Textarea
              id="changes-note"
              rows={4}
              value={changesNote}
              onChange={(e) => setChangesNote(e.target.value)}
              placeholder={t("project.detail.changesNotePlaceholder")}
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setChangesOpen(false)}>
              {t("common.cancel")}
            </Button>
            <Button
              type="button"
              disabled={statusMutation.isPending}
              onClick={() => void requestChanges()}
            >
              {t("project.detail.requestChanges")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
