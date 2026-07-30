import { useEffect, useMemo, useRef, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { format } from "date-fns";
import { ptBR, enUS, es } from "date-fns/locale";
import { ChevronLeft, MessageCircle, Plus, Save } from "lucide-react";
import { toast } from "sonner";
import {
  MeetingAgendaTopicsEditor,
  type MeetingAgendaTopicsEditorHandle,
} from "@/components/meeting-agenda-topics-editor";
import { UnsavedChangesGuard } from "@/components/unsaved-changes-guard";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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

/** Snapshot of editable fields — used as dirty baseline so server ISO/JSON quirks never stick the form as dirty. */
function buildMeetingFormSnapshot(
  scheduledLocal: string,
  topics: MeetingAgendaTopic[],
  notes: string,
) {
  return JSON.stringify({
    scheduledLocal,
    topics: topics.map((topic) => ({
      title: topic.title.trim(),
      description: topic.description?.trim() || "",
      needsAction: Boolean(topic.needsAction),
    })),
    notes: notes.trim(),
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

  const [scheduledLocal, setScheduledLocal] = useState("");
  const [topics, setTopics] = useState<MeetingAgendaTopic[]>([]);
  const [notes, setNotes] = useState("");
  const [formBaseline, setFormBaseline] = useState<string | null>(null);
  /** Which agendaId the local form was hydrated for — avoids a mount race that cleared the baseline when cache was warm. */
  const [hydratedAgendaId, setHydratedAgendaId] = useState<string | null>(null);
  const topicsEditorRef = useRef<MeetingAgendaTopicsEditorHandle>(null);

  useEffect(() => {
    if (!agendaQuery.data || hydratedAgendaId === agendaId) return;
    const nextScheduled = toDatetimeLocalValue(agendaQuery.data.scheduled_at);
    const nextTopics = parseMeetingAgendaTopics(agendaQuery.data.topics);
    const nextNotes = agendaQuery.data.notes ?? "";
    setScheduledLocal(nextScheduled);
    setTopics(nextTopics);
    setNotes(nextNotes);
    setFormBaseline(buildMeetingFormSnapshot(nextScheduled, nextTopics, nextNotes));
    setHydratedAgendaId(agendaId);
  }, [agendaId, agendaQuery.data, hydratedAgendaId]);

  const scheduledAt = fromDatetimeLocalValue(scheduledLocal);
  const notesNormalized = notes.trim() || null;
  const formSnapshot = useMemo(
    () => buildMeetingFormSnapshot(scheduledLocal, topics, notes),
    [scheduledLocal, topics, notes],
  );
  const hasChanges = formBaseline !== null && formSnapshot !== formBaseline;

  const saveMutation = useMutation({
    mutationFn: () =>
      updateMeetingAgenda({
        agendaId,
        clientId,
        projectId,
        scheduledAt,
        topics,
        notes: notesNormalized,
      }),
    onSuccess: (row) => {
      const nextScheduled = toDatetimeLocalValue(row.scheduled_at);
      const nextTopics = parseMeetingAgendaTopics(row.topics);
      // Keep local notes if the DB column is not deployed yet (row has no `notes` key).
      const nextNotes = "notes" in row ? (row.notes ?? "") : (notesNormalized ?? "");
      setScheduledLocal(nextScheduled);
      setTopics(nextTopics);
      setNotes(nextNotes);
      setFormBaseline(buildMeetingFormSnapshot(nextScheduled, nextTopics, nextNotes));
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

  function openWhatsAppWithCurrentForm() {
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

  async function handleSendWhatsApp() {
    // Persist first when dirty so the shared link reflects the latest agenda.
    if (hasChanges) {
      try {
        await saveMutation.mutateAsync();
      } catch {
        return;
      }
    }
    openWhatsAppWithCurrentForm();
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
    <div className="space-y-4 pb-24">
      <Link
        to="/clients/$clientId/projects/$projectId/meeting"
        params={{ clientId, projectId }}
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ChevronLeft className="h-4 w-4" aria-hidden="true" />
        {t("project.meeting.back")}
      </Link>

      <Card className="rounded-xl">
        <CardHeader className="sticky top-0 z-10 flex flex-col gap-3 space-y-0 border-b bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/80 sm:flex-row sm:items-center sm:justify-between">
          <CardTitle>{t("project.meeting.detailTitle")}</CardTitle>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              disabled={saveMutation.isPending}
              onClick={() => topicsEditorRef.current?.addTopic()}
            >
              <Plus className="mr-2 h-4 w-4" aria-hidden="true" />
              {t("project.meeting.addTopic")}
            </Button>
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
        <CardContent className="space-y-6 pt-6">
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
              ref={topicsEditorRef}
              topics={topics}
              disabled={saveMutation.isPending}
              onChange={setTopics}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="meeting-notes">{t("project.meeting.notesLabel")}</Label>
            <Textarea
              id="meeting-notes"
              value={notes}
              disabled={saveMutation.isPending}
              placeholder={t("project.meeting.notesPlaceholder")}
              rows={4}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>
        </CardContent>
      </Card>

      {hasChanges ? (
        <div className="fixed inset-x-0 bottom-0 z-40 border-t bg-background/95 p-3 shadow-lg backdrop-blur supports-[backdrop-filter]:bg-background/90">
          <div className="mx-auto flex w-full max-w-5xl flex-wrap items-center justify-between gap-3 px-1 sm:px-2">
            <p className="text-sm text-muted-foreground">{t("project.meeting.unsavedChanges")}</p>
            <Button
              type="button"
              disabled={saveMutation.isPending}
              onClick={() => saveMutation.mutate()}
            >
              <Save className="mr-2 h-4 w-4" aria-hidden="true" />
              {saveMutation.isPending ? t("common.loading") : t("common.save")}
            </Button>
          </div>
        </div>
      ) : null}

      <UnsavedChangesGuard isDirty={hasChanges} />
    </div>
  );
}
