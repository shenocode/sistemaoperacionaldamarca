import { useEffect, useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { ChevronLeft, Save } from "lucide-react";
import { toast } from "sonner";
import { MeetingAgendaTopicsEditor } from "@/components/meeting-agenda-topics-editor";
import { UnsavedChangesGuard } from "@/components/unsaved-changes-guard";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  getMeetingAgenda,
  parseMeetingAgendaTopics,
  updateMeetingAgenda,
  type MeetingAgendaTopic,
} from "@/lib/api";

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
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  const agendaQuery = useQuery({
    queryKey: ["meeting-agendas", "detail", agendaId],
    queryFn: () => getMeetingAgenda(agendaId),
  });

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
    (scheduledAt !== serverScheduledAt || !topicsEqual(topics, serverTopics));

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
      queryClient.setQueryData(["meeting-agendas", "detail", agendaId], row);
      queryClient.invalidateQueries({ queryKey: ["meeting-agendas", projectId] });
      setScheduledLocal(toDatetimeLocalValue(row.scheduled_at));
      setTopics(parseMeetingAgendaTopics(row.topics));
      toast.success(t("project.meeting.saved"));
    },
    onError: (err: Error) => toast.error(err.message),
  });

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
        <CardHeader className="flex flex-row items-center justify-between gap-3 space-y-0">
          <CardTitle>{t("project.meeting.detailTitle")}</CardTitle>
          <Button
            type="button"
            disabled={!hasChanges || saveMutation.isPending}
            onClick={() => saveMutation.mutate()}
          >
            <Save className="mr-2 h-4 w-4" aria-hidden="true" />
            {t("common.save")}
          </Button>
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
