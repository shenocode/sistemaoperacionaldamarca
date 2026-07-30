import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { ChevronLeft, FolderKanban, Library, Plus } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/empty-state";
import { ProjectCategoriesField } from "@/components/project-categories-field";
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
import {
  canManageClient,
  createProject,
  getClient,
  getLocalizedText,
  getPrimaryProjectCategory,
  listProjects,
  normalizeAppLocale,
  projectDefaultRoute,
  type ProjectCategory,
} from "@/lib/api";
import { useAppRole } from "@/hooks/use-app-role";
import { useEntitlements } from "@/hooks/use-entitlements";

export const Route = createFileRoute("/_authenticated/clients/$clientId/")({
  head: () => ({
    meta: [{ title: "Cliente — SOM" }, { name: "robots", content: "noindex" }],
  }),
  component: ClientDetailPage,
});

function ClientDetailPage() {
  const { clientId } = Route.useParams();
  const { t, i18n } = useTranslation();
  const queryClient = useQueryClient();
  const { isClient } = useAppRole();
  const { entitlements } = useEntitlements();
  const libraryAllowed = isClient || entitlements.library;
  const uiLocale = normalizeAppLocale(i18n.resolvedLanguage ?? i18n.language);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState<ProjectCategory | null>(null);

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

  const resetForm = () => {
    setName("");
    setDescription("");
    setCategory(null);
  };

  const createMutation = useMutation({
    mutationFn: createProject,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["projects", clientId] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      setOpen(false);
      resetForm();
      toast.success(t("clients.projectCreated"));
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const client = clientQuery.data;
  const projects = projectsQuery.data ?? [];
  const canManage = manageQuery.data ?? false;

  return (
    <div className="mx-auto max-w-7xl space-y-6 px-4 py-6 sm:px-6 sm:py-8 md:p-8">
      <Link
        to="/clients"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ChevronLeft className="h-4 w-4" aria-hidden="true" />
        {t("nav.clients")}
      </Link>
      <PageHeader
        title={
          client
            ? getLocalizedText(client.i18n, "name", client.name, uiLocale)
            : t("common.loading")
        }
        description={t("clients.projects")}
        actions={
          libraryAllowed || canManage ? (
            <div className="flex flex-col gap-2 sm:flex-row">
              {libraryAllowed ? (
                <Button asChild variant="outline">
                  <Link to="/clients/$clientId/library" params={{ clientId }}>
                    <Library className="mr-2 h-4 w-4" aria-hidden="true" />
                    {t("project.tabs.library")}
                  </Link>
                </Button>
              ) : null}
              {canManage ? (
                <Button onClick={() => setOpen(true)}>
                  <Plus className="mr-2 h-4 w-4" aria-hidden="true" />
                  {t("clients.newProject")}
                </Button>
              ) : null}
            </div>
          ) : undefined
        }
      />

      {projectsQuery.isLoading ? (
        <p className="text-sm text-muted-foreground">{t("common.loading")}</p>
      ) : projects.length === 0 ? (
        <EmptyState icon={FolderKanban} title={t("clients.noProjects")} />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {projects.map((project) => {
            const primaryCategory = getPrimaryProjectCategory(project.categories);
            const defaultRoute = projectDefaultRoute(project.categories);
            const projectName = getLocalizedText(project.i18n, "name", project.name, uiLocale);
            const projectDescription = getLocalizedText(
              project.i18n,
              "description",
              project.description ?? "",
              uiLocale,
            );
            return (
              <Link
                key={project.id}
                to={defaultRoute.to}
                params={{ clientId, projectId: project.id }}
                className="block"
              >
                <Card className="rounded-xl transition-colors hover:bg-muted/40">
                  <CardContent className="space-y-2 p-5">
                    <p className="font-medium tracking-tight">{projectName}</p>
                    {projectDescription ? (
                      <p className="line-clamp-2 text-sm text-muted-foreground">{projectDescription}</p>
                    ) : null}
                    <p className="line-clamp-2 text-xs text-muted-foreground">
                      {t(`clients.categories.${primaryCategory}.label`)}
                    </p>
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">
                      {project.status === "archived"
                        ? t("clients.archived")
                        : t("clients.active")}
                    </p>
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      )}

      <Dialog
        open={open}
        onOpenChange={(next) => {
          setOpen(next);
          if (!next) resetForm();
        }}
      >
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t("clients.newProject")}</DialogTitle>
          </DialogHeader>
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              if (!name.trim()) return;
              if (!category) {
                toast.error(t("clients.projectCategoryRequired"));
                return;
              }
              createMutation.mutate({
                clientId,
                name,
                description,
                categories: [category],
              });
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
            <ProjectCategoriesField
              value={category}
              onChange={setCategory}
              required
            />
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                {t("common.cancel")}
              </Button>
              <Button
                type="submit"
                disabled={createMutation.isPending || !name.trim() || !category}
              >
                {t("common.save")}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
