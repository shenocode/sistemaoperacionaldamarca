import { useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { formatDistanceToNow } from "date-fns";
import { ptBR, enUS, es } from "date-fns/locale";
import { Copy, FileText, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/empty-state";
import { StatusBadge, type ContentStatus } from "@/components/status-badge";
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
import { InstagramFeedMockup } from "@/components/instagram-feed-mockup";
import {
  canManageClient,
  createContent,
  deleteContent,
  duplicateContent,
  getClient,
  listContent,
} from "@/lib/api";
import type { LanguageCode } from "@/i18n";
import { validateContentSearch } from "./content";

const dateLocales = { "pt-BR": ptBR, "en-US": enUS, "es-ES": es };

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

  const allRows = contentQuery.data ?? [];
  const rows = filter === "review" ? allRows.filter((r) => r.status === "review") : allRows;
  const locale = dateLocales[(i18n.language as LanguageCode) ?? "pt-BR"] ?? ptBR;
  const canManage = Boolean(manageQuery.data);
  const isBusy = duplicateMutation.isPending || deleteMutation.isPending;

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
            username={clientQuery.data?.name}
            avatarUrl={clientQuery.data?.logo_url}
            className="mx-auto shrink-0 lg:sticky lg:top-6"
          />
        </div>
      ) : (
        <div className="flex flex-col gap-8 lg:flex-row lg:items-start">
          <Card className="min-w-0 flex-1 overflow-hidden rounded-xl">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-4 py-3">{t("project.content.columns.thumbnail")}</th>
                  <th className="px-4 py-3">{t("project.content.columns.title")}</th>
                  <th className="px-4 py-3">{t("project.content.columns.status")}</th>
                  <th className="px-4 py-3">{t("project.content.columns.version")}</th>
                  <th className="px-4 py-3">{t("project.content.columns.updated")}</th>
                  <th className="px-4 py-3 text-right">{t("project.content.columns.actions")}</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {rows.map((r) => (
                  <tr key={r.id} className="hover:bg-muted/30">
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
                    <td className="px-4 py-3 font-medium">{r.title}</td>
                    <td className="px-4 py-3">
                      <Link
                        to="/clients/$clientId/projects/$projectId/content/$contentId"
                        params={{ clientId, projectId, contentId: r.id }}
                        search={{}}
                        className="inline-flex rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      >
                        <StatusBadge status={r.status as ContentStatus} asButton />
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">v{r.current_version}</td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {formatDistanceToNow(new Date(r.updated_at), { addSuffix: true, locale })}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1.5">
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
                        <Button asChild variant="ghost" size="sm">
                          <Link
                            to="/clients/$clientId/projects/$projectId/content/$contentId"
                            params={{ clientId, projectId, contentId: r.id }}
                            search={{}}
                          >
                            {t("project.content.open")}
                          </Link>
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>

          <InstagramFeedMockup
            items={rows}
            username={clientQuery.data?.name}
            avatarUrl={clientQuery.data?.logo_url}
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
