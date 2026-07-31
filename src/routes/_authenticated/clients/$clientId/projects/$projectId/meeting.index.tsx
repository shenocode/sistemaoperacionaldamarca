import { useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { format, type Locale } from "date-fns";
import { ptBR, enUS, es } from "date-fns/locale";
import { CalendarDays, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/empty-state";
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
  canManageClient,
  createMeetingAgenda,
  deleteMeetingAgenda,
  listMeetingAgendas,
  type MeetingAgenda,
} from "@/lib/api";
import type { LanguageCode } from "@/i18n";

const dateLocales = { "pt-BR": ptBR, "en-US": enUS, "es-ES": es };

function formatAgendaDate(
  scheduledAt: string | null,
  locale: Locale,
  noDateLabel: string,
): string {
  if (!scheduledAt) return noDateLabel;
  const date = new Date(scheduledAt);
  if (Number.isNaN(date.getTime())) return noDateLabel;
  return format(date, "PPp", { locale });
}

export const Route = createFileRoute(
  "/_authenticated/clients/$clientId/projects/$projectId/meeting/",
)({
  component: MeetingListPage,
});

function MeetingListPage() {
  const { clientId, projectId } = Route.useParams();
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [deleteTarget, setDeleteTarget] = useState<MeetingAgenda | null>(null);

  const locale = dateLocales[(i18n.language as LanguageCode) ?? "pt-BR"] ?? ptBR;

  const agendasQuery = useQuery({
    queryKey: ["meeting-agendas", projectId],
    queryFn: () => listMeetingAgendas(projectId),
  });

  const manageQuery = useQuery({
    queryKey: ["can-manage", clientId],
    queryFn: () => canManageClient(clientId),
  });

  const createMutation = useMutation({
    mutationFn: () => createMeetingAgenda({ projectId, clientId }),
    onSuccess: (row) => {
      queryClient.invalidateQueries({ queryKey: ["meeting-agendas", projectId] });
      toast.success(t("project.meeting.created"));
      navigate({
        to: "/clients/$clientId/projects/$projectId/meeting/$agendaId",
        params: { clientId, projectId, agendaId: row.id },
      });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const deleteMutation = useMutation({
    mutationFn: (agendaId: string) =>
      deleteMeetingAgenda({ agendaId, clientId, projectId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["meeting-agendas", projectId] });
      setDeleteTarget(null);
      toast.success(t("project.meeting.deleted"));
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const canManage = Boolean(manageQuery.data);
  const rows = agendasQuery.data ?? [];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">{t("project.meeting.hint")}</p>
        <Button
          onClick={() => createMutation.mutate()}
          disabled={createMutation.isPending}
          className="w-full sm:w-auto"
        >
          <Plus className="mr-2 h-4 w-4" aria-hidden="true" />
          {t("project.meeting.new")}
        </Button>
      </div>

      {agendasQuery.isLoading ? (
        <p className="text-sm text-muted-foreground">{t("common.loading")}</p>
      ) : agendasQuery.isError ? (
        <p className="text-sm text-destructive">
          {agendasQuery.error instanceof Error
            ? agendasQuery.error.message
            : t("common.error")}
        </p>
      ) : rows.length === 0 ? (
        <EmptyState icon={CalendarDays} title={t("project.meeting.empty")} />
      ) : (
        <div className="space-y-3">
          {rows.map((row) => {
            const dateLabel = formatAgendaDate(
              row.scheduled_at,
              locale,
              t("project.meeting.noDate"),
            );

            return (
              <Card key={row.id} className="rounded-xl p-4">
                <div className="flex items-center justify-between gap-3">
                  <Link
                    to="/clients/$clientId/projects/$projectId/meeting/$agendaId"
                    params={{ clientId, projectId, agendaId: row.id }}
                    className="min-w-0 flex-1 hover:underline"
                  >
                    <p className="font-medium">{dateLabel}</p>
                  </Link>
                  {canManage ? (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="shrink-0 text-muted-foreground hover:text-destructive"
                      aria-label={t("project.meeting.delete")}
                      onClick={() => setDeleteTarget(row)}
                    >
                      <Trash2 className="h-4 w-4" aria-hidden="true" />
                    </Button>
                  ) : null}
                </div>
              </Card>
            );
          })}
        </div>
      )}

      <AlertDialog open={deleteTarget !== null} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("project.meeting.deleteTitle")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("project.meeting.deleteDescription")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={deleteMutation.isPending}
              onClick={() => {
                if (deleteTarget) deleteMutation.mutate(deleteTarget.id);
              }}
            >
              {t("project.meeting.delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
