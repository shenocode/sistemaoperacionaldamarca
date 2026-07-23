import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { ChevronLeft, FolderKanban, Plus } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/empty-state";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { canManageClient, createProject, getClient, listProjects } from "@/lib/api";

export const Route = createFileRoute("/_authenticated/clients/$clientId/")({
  head: () => ({
    meta: [{ title: "Cliente — SOM" }, { name: "robots", content: "noindex" }],
  }),
  component: ClientDetailPage,
});

function ClientDetailPage() {
  const { clientId } = Route.useParams();
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");

  const clientQuery = useQuery({
    queryKey: ["clients", clientId],
    queryFn: () => getClient(clientId),
  });

  const projectsQuery = useQuery({
    queryKey: ["projects", clientId],
    queryFn: () => listProjects(clientId),
  });

  const manageQuery = useQuery({
    queryKey: ["can-manage", clientId],
    queryFn: () => canManageClient(clientId),
  });

  const createMutation = useMutation({
    mutationFn: createProject,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["projects", clientId] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      setOpen(false);
      setName("");
      setDescription("");
      toast.success(t("clients.projectCreated"));
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const client = clientQuery.data;
  const projects = projectsQuery.data ?? [];
  const canManage = manageQuery.data ?? false;

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-8">
      <Link
        to="/clients"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ChevronLeft className="h-4 w-4" aria-hidden="true" />
        {t("nav.clients")}
      </Link>
      <PageHeader
        title={client?.name ?? t("common.loading")}
        description={t("clients.projects")}
        actions={
          canManage ? (
            <Button onClick={() => setOpen(true)}>
              <Plus className="mr-2 h-4 w-4" aria-hidden="true" />
              {t("clients.newProject")}
            </Button>
          ) : undefined
        }
      />

      {projectsQuery.isLoading ? (
        <p className="text-sm text-muted-foreground">{t("common.loading")}</p>
      ) : projects.length === 0 ? (
        <EmptyState icon={FolderKanban} title={t("clients.noProjects")} />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {projects.map((project) => (
            <Link
              key={project.id}
              to="/clients/$clientId/projects/$projectId/calendar"
              params={{ clientId, projectId: project.id }}
              className="block"
            >
              <Card className="rounded-xl transition-colors hover:bg-muted/40">
                <CardContent className="space-y-2 p-5">
                  <p className="font-medium tracking-tight">{project.name}</p>
                  {project.description ? (
                    <p className="line-clamp-2 text-sm text-muted-foreground">{project.description}</p>
                  ) : null}
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">
                    {project.status === "archived"
                      ? t("clients.archived")
                      : t("clients.active")}
                  </p>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("clients.newProject")}</DialogTitle>
          </DialogHeader>
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              if (!name.trim()) return;
              createMutation.mutate({ clientId, name, description });
            }}
          >
            <div className="space-y-1.5">
              <Label htmlFor="project-name">{t("clients.projectName")}</Label>
              <Input
                id="project-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                autoFocus
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="project-description">{t("clients.projectDescription")}</Label>
              <Textarea
                id="project-description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                {t("common.cancel")}
              </Button>
              <Button type="submit" disabled={createMutation.isPending || !name.trim()}>
                {t("common.save")}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
