import { useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { formatDistanceToNow } from "date-fns";
import { ptBR, enUS, es } from "date-fns/locale";
import { Plus, FileText } from "lucide-react";
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
import { canManageClient, createContent, listContent } from "@/lib/api";
import type { LanguageCode } from "@/i18n";

const dateLocales = { "pt-BR": ptBR, "en-US": enUS, "es-ES": es };

export const Route = createFileRoute("/_authenticated/clients/$clientId/projects/$projectId/content/")({
  component: ContentListPage,
});

function ContentListPage() {
  const { clientId, projectId } = Route.useParams();
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");

  const contentQuery = useQuery({
    queryKey: ["content", projectId],
    queryFn: () => listContent(projectId),
  });

  const manageQuery = useQuery({
    queryKey: ["can-manage", clientId],
    queryFn: () => canManageClient(clientId),
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
      });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const rows = contentQuery.data ?? [];
  const locale = dateLocales[(i18n.language as LanguageCode) ?? "pt-BR"] ?? ptBR;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-end">
        {manageQuery.data ? (
          <Button onClick={() => setOpen(true)}>
            <Plus className="mr-2 h-4 w-4" aria-hidden="true" />
            {t("project.content.new")}
          </Button>
        ) : null}
      </div>

      {contentQuery.isLoading ? (
        <p className="text-sm text-muted-foreground">{t("common.loading")}</p>
      ) : rows.length === 0 ? (
        <EmptyState icon={FileText} title={t("project.content.empty")} />
      ) : (
        <Card className="overflow-hidden rounded-xl">
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
                    <StatusBadge status={r.status as ContentStatus} />
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">v{r.current_version}</td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {formatDistanceToNow(new Date(r.updated_at), { addSuffix: true, locale })}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Button asChild variant="ghost" size="sm">
                      <Link
                        to="/clients/$clientId/projects/$projectId/content/$contentId"
                        params={{ clientId, projectId, contentId: r.id }}
                      >
                        {t("project.content.open")}
                      </Link>
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
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
    </div>
  );
}
