import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { canManageClient, getProject, updateProject } from "@/lib/api";

export const Route = createFileRoute(
  "/_authenticated/clients/$clientId/projects/$projectId/settings",
)({
  component: ProjectSettingsPage,
});

function ProjectSettingsPage() {
  const { clientId, projectId } = Route.useParams();
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState("active");

  const projectQuery = useQuery({
    queryKey: ["projects", "detail", projectId],
    queryFn: () => getProject(projectId),
  });

  const manageQuery = useQuery({
    queryKey: ["can-manage", clientId],
    queryFn: () => canManageClient(clientId),
  });

  useEffect(() => {
    if (!projectQuery.data) return;
    setName(projectQuery.data.name);
    setDescription(projectQuery.data.description ?? "");
    setStatus(projectQuery.data.status);
  }, [projectQuery.data]);

  const saveMutation = useMutation({
    mutationFn: () => updateProject(projectId, { name, description, status }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["projects"] });
      toast.success(t("common.saved"));
    },
    onError: (err: Error) => toast.error(err.message),
  });

  if (manageQuery.isLoading || projectQuery.isLoading) {
    return <p className="text-sm text-muted-foreground">{t("common.loading")}</p>;
  }

  if (!manageQuery.data) {
    return (
      <div className="rounded-lg border border-dashed p-12 text-center text-sm text-muted-foreground">
        {t("project.settings.readOnly")}
      </div>
    );
  }

  return (
    <form
      className="max-w-lg space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        saveMutation.mutate();
      }}
    >
      <div className="space-y-1.5">
        <Label htmlFor="settings-name">{t("clients.projectName")}</Label>
        <Input
          id="settings-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="settings-description">{t("clients.projectDescription")}</Label>
        <Textarea
          id="settings-description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={4}
        />
      </div>
      <div className="space-y-1.5">
        <Label>{t("project.settings.status")}</Label>
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="active">{t("clients.active")}</SelectItem>
            <SelectItem value="archived">{t("clients.archived")}</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <Button type="submit" disabled={saveMutation.isPending || !name.trim()}>
        {t("common.save")}
      </Button>
    </form>
  );
}
