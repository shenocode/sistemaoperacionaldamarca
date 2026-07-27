import { useEffect, useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { format } from "date-fns";
import { ptBR, enUS, es } from "date-fns/locale";
import { ChevronLeft, MessageCircle, Save } from "lucide-react";
import { toast } from "sonner";
import { MeetingAgendaTopicsEditor } from "@/components/meeting-agenda-topics-editor";
import { UnsavedChangesGuard } from "@/components/unsaved-changes-guard";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { LanguageCode } from "@/i18n";
import {
  buildMeetingAgendaUrl,
  buildWhatsAppNotifyUrl,
  canManageClient,
  getClient,
  getMeetingAgenda,
  getProject,
  parseMeetingAgendaTopics,
  updateMeetingAgenda,
  type MeetingAgendaTopic,
} from "@/lib/api";

const dateLocales = { "pt-BR": ptBR, "en-US": enUS, "es-ES": es };

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

/** Compare at minute precision — datetime-local and Postgres ISO strings often differ. */
function scheduledAtEqual(a: string | null, b: string | null) {
  return toDatetimeLocalValue(a) === toDatetimeLocalValue(b);
}

function topicsEqual(a: MeetingAgendaTopic[], b: MeetingAgendaTopic[]) {
  if (a.length !== b.length) return false;
  return a.every((topic, index) => {
    const other = b[index];
    return (
      topic.title.trim() === other.title.trim() &&
      (topic.description?.trim() || "") === (other.description?.trim() || "")
    );
  });
}

export const Route = createFileRoute(
  "/_authenticated/clients/$clientId/projects/$projectId/meeting/$agendaId",
)({
  component: MeetingDetailPage,
});

function MeetingDetailPage() {
  const { clientId, projectId, agendaId } = Route.useParams();
  const { t, i18n } = useTranslation();
  const queryClient = useQueryClient();
  const locale = dateLocales[(i18n.language as LanguageCode) ?? "pt-BR"] ?? ptBR;

  const agendaQuery = useQuery({
    queryKey: ["meeting-agendas", "detail", agendaId],
    queryFn: () => getMeetingAgenda(agendaId),
  });

  const clientQuery = useQuery({
    queryKey: ["clients", clientId],
    queryFn: () => getClient(clientId),
  });

  const projectQuery = useQuery({
    queryKey: ["projects", "detail", projectId],
    queryFn: () => getProject(projectId),
  });

  const manageQuery = useQuery({
    queryKey: ["can-manage", clientId],
    queryFn: () => canManageClient(clientId),
  });

  const canSendWhatsApp = Boolean(manageQuery.data);

  const serverScheduledAt = agendaQuery.data?.scheduled_at ?? null;
  const serverTopics = useMemo(
    () => parseMeetingAgendaTopics(agendaQuery.data?.topics),
    [agendaQuery.data?.topics],
  );

  const [scheduledLocal, setScheduledLocal] = useState("");
  const [topics, setTopics] = useState<MeetingAgendaTopic[]>([]);
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    if (!agendaQuery.data || initialized) return;
    setScheduledLocal(toDatetimeLocalValue(agendaQuery.data.scheduled_at));
    setTopics(parseMeetingAgendaTopics(agendaQuery.data.topics));
    setInitialized(true);
  }, [agendaQuery.data, initialized]);

  useEffect(() => {
    setInitialized(false);
  }, [agendaId]);

  const scheduledAt = fromDatetimeLocalValue(scheduledLocal);
  const hasChanges =
    initialized &&
    (!scheduledAtEqual(scheduledAt, serverScheduledAt) || !topicsEqual(topics, serverTopics));

  const saveMutation = useMutation({
    mutationFn: () =>
      updateMeetingAgenda({
        agendaId,
        clientId,
        projectId,
        scheduledAt,
        topics,
      }),
    onSuccess: (row) => {
      // Sync local state before cache so hasChanges clears before any re-render from setQueryData.
      setScheduledLocal(toDatetimeLocalValue(row.scheduled_at));
      setTopics(parseMeetingAgendaTopics(row.topics));
      queryClient.setQueryData(["meeting-agendas", "detail", agendaId], row);
      queryClient.invalidateQueries({ queryKey: ["meeting-agendas", projectId] });
      toast.success(t("project.meeting.saved"));
    },
    onError: (err: Error) => toast.error(err.message),
  });

  function formatMeetingDate(iso: string | null): string {
    if (!iso) return t("project.meeting.noDate");
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) return t("project.meeting.noDate");
    return format(date, "PPp", { locale });
  }

  function handleSendWhatsApp() {
    if (hasChanges) {
      toast.error(t("project.meeting.saveBeforeSend"));
      return;
    }

    const client = clientQuery.data;
    const project = projectQuery.data;
    if (!client || !project) return;

    if (!scheduledAt) {
      toast.error(t("project.meeting.dateRequiredForSend"));
      return;
    }

    if (!client.access_token) {
      toast.error(t("clients.accessTokenMissing"));
      return;
    }

    const link = buildMeetingAgendaUrl(
      client.id,
      project.id,
      agendaId,
      client.access_token,
    );
    const message = t("project.meeting.whatsappMessage", {
      client: client.name,
      project: project.name,
      date: formatMeetingDate(scheduledAt),
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

  if (agendaQuery.isLoading) {
    return <p className="text-sm text-muted-foreground">{t("common.loading")}</p>;
  }

  if (agendaQuery.isError || !agendaQuery.data) {
    return (
      <p className="text-sm text-destructive">
        {agendaQuery.error instanceof Error ? agendaQuery.error.message : t("common.error")}
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <Link
        to="/clients/$clientId/projects/$projectId/meeting"
        params={{ clientId, projectId }}
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ChevronLeft className="h-4 w-4" aria-hidden="true" />
        {t("project.meeting.back")}
      </Link>

      <Card className="rounded-xl">
        <CardHeader className="flex flex-col gap-3 space-y-0 sm:flex-row sm:items-center sm:justify-between">
          <CardTitle>{t("project.meeting.detailTitle")}</CardTitle>
          <div className="flex flex-wrap gap-2">
            {canSendWhatsApp ? (
              <Button
                type="button"
                variant="secondary"
                disabled={
                  saveMutation.isPending ||
                  clientQuery.isLoading ||
                  projectQuery.isLoading
                }
                onClick={handleSendWhatsApp}
              >
                <MessageCircle className="mr-2 h-4 w-4" aria-hidden="true" />
                {t("project.meeting.sendWhatsApp")}
              </Button>
            ) : null}
            <Button
              type="button"
              disabled={!hasChanges || saveMutation.isPending}
              onClick={() => saveMutation.mutate()}
            >
              <Save className="mr-2 h-4 w-4" aria-hidden="true" />
              {t("common.save")}
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="meeting-scheduled-at">{t("project.meeting.dateLabel")}</Label>
            <Input
              id="meeting-scheduled-at"
              type="datetime-local"
              value={scheduledLocal}
              disabled={saveMutation.isPending}
              onChange={(e) => setScheduledLocal(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label>{t("project.meeting.topicsLabel")}</Label>
            <MeetingAgendaTopicsEditor
              topics={topics}
              disabled={saveMutation.isPending}
              onChange={setTopics}
            />
          </div>
        </CardContent>
      </Card>

      <UnsavedChangesGuard isDirty={hasChanges} />
    </div>
  );
}
