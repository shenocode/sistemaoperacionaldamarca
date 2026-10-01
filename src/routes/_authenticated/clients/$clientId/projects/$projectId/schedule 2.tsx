import { useEffect, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  canManageClient,
  createEmptyScheduleRows,
  ensureProjectSite,
  getPrimaryProjectCategory,
  getProject,
  projectDefaultRoute,
  updateSiteSchedule,
  type SiteScheduleRow,
} from "@/lib/api";

export const Route = createFileRoute(
  "/_authenticated/clients/$clientId/projects/$projectId/schedule 2",
)({
  head: () => ({
    meta: [{ title: "Cronograma — SOM" }, { name: "robots", content: "noindex" }],
  }),
  component: ProjectSiteSchedulePage,
});

function ProjectSiteSchedulePage() {
  const { clientId, projectId } = Route.useParams();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [rows, setRows] = useState<SiteScheduleRow[]>(() => createEmptyScheduleRows(5));

  const projectQuery = useQuery({
    queryKey: ["projects", "detail", projectId],
    queryFn: () => getProject(projectId),
  });

  const siteQuery = useQuery({
    queryKey: ["project-site", projectId],
    queryFn: () => ensureProjectSite(projectId),
    enabled: getPrimaryProjectCategory(projectQuery.data?.categories) === "site",
  });

  const manageQuery = useQuery({
    queryKey: ["can-manage", clientId],
    queryFn: () => canManageClient(clientId),
  });

  const isSite = getPrimaryProjectCategory(projectQuery.data?.categories) === "site";
  const canManage = Boolean(manageQuery.data);

  useEffect(() => {
    if (!projectQuery.data || isSite) return;
    const { to } = projectDefaultRoute(projectQuery.data.categories);
    void navigate({
      to,
      params: { clientId, projectId },
      replace: true,
      ...(to === "/clients/$clientId/projects/$projectId/content" ? { search: {} } : {}),
    });
  }, [projectQuery.data, isSite, navigate, clientId, projectId]);

  useEffect(() => {
    if (siteQuery.data?.scheduleParsed) {
      setRows(siteQuery.data.scheduleParsed);
    }
  }, [siteQuery.data?.scheduleParsed, siteQuery.dataUpdatedAt]);

  const saveMutation = useMutation({
    mutationFn: () => updateSiteSchedule({ projectId, schedule: rows }),
    onSuccess: (data) => {
      queryClient.setQueryData(["project-site", projectId], data);
      toast.success(t("project.site.schedule.saved"));
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const updateRow = (id: string, key: keyof Omit<SiteScheduleRow, "id">, value: string) => {
    setRows((prev) => prev.map((row) => (row.id === id ? { ...row, [key]: value } : row)));
  };

  const addRow = () => {
    setRows((prev) => [
      ...prev,
      { id: crypto.randomUUID(), fase: "", prazo: "", entregas: "" },
    ]);
  };

  const removeRow = (id: string) => {
    setRows((prev) => (prev.length <= 1 ? prev : prev.filter((row) => row.id !== id)));
  };

  if (projectQuery.isLoading || (isSite && siteQuery.isLoading)) {
    return <p className="text-sm text-muted-foreground">{t("common.loading")}</p>;
  }

  if (!isSite) {
    return <p className="text-sm text-muted-foreground">{t("common.loading")}</p>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <h2 className="text-base font-medium">{t("project.site.schedule.title")}</h2>
          <p className="text-sm text-muted-foreground">{t("project.site.schedule.hint")}</p>
        </div>
        {canManage ? (
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" onClick={addRow}>
              <Plus className="mr-2 h-4 w-4" aria-hidden="true" />
              {t("project.site.schedule.addRow")}
            </Button>
            <Button
              type="button"
              onClick={() => saveMutation.mutate()}
              disabled={saveMutation.isPending}
            >
              {saveMutation.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
              ) : null}
              {t("project.site.schedule.save")}
            </Button>
          </div>
        ) : null}
      </div>

      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full min-w-[640px] border-collapse text-sm">
          <thead>
            <tr className="bg-muted">
              <th className="border-b px-3 py-2.5 text-left font-medium">
                {t("project.site.schedule.fase")}
              </th>
              <th className="border-b px-3 py-2.5 text-left font-medium">
                {t("project.site.schedule.prazo")}
              </th>
              <th className="border-b px-3 py-2.5 text-left font-medium">
                {t("project.site.schedule.entregas")}
              </th>
              {canManage ? <th className="w-12 border-b px-2 py-2.5" /> : null}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id} className="border-b last:border-b-0">
                <td className="align-top p-2">
                  {canManage ? (
                    <Input
                      value={row.fase}
                      onChange={(e) => updateRow(row.id, "fase", e.target.value)}
                      className="border-0 bg-transparent shadow-none focus-visible:ring-1"
                    />
                  ) : (
                    <span className="block px-1 py-2">
                      {row.fase.trim() || t("project.site.schedule.emptyCell")}
                    </span>
                  )}
                </td>
                <td className="align-top p-2">
                  {canManage ? (
                    <Input
                      value={row.prazo}
                      onChange={(e) => updateRow(row.id, "prazo", e.target.value)}
                      className="border-0 bg-transparent shadow-none focus-visible:ring-1"
                    />
                  ) : (
                    <span className="block px-1 py-2">
                      {row.prazo.trim() || t("project.site.schedule.emptyCell")}
                    </span>
                  )}
                </td>
                <td className="align-top p-2">
                  {canManage ? (
                    <Textarea
                      value={row.entregas}
                      rows={2}
                      onChange={(e) => updateRow(row.id, "entregas", e.target.value)}
                      className="min-h-[2.5rem] resize-y border-0 bg-transparent shadow-none focus-visible:ring-1"
                    />
                  ) : (
                    <span className="block whitespace-pre-wrap px-1 py-2">
                      {row.entregas.trim() || t("project.site.schedule.emptyCell")}
                    </span>
                  )}
                </td>
                {canManage ? (
                  <td className="align-top p-2">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-muted-foreground"
                      onClick={() => removeRow(row.id)}
                      aria-label={t("project.site.schedule.removeRow")}
                      disabled={rows.length <= 1}
                    >
                      <Trash2 className="h-4 w-4" aria-hidden="true" />
                    </Button>
                  </td>
                ) : null}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
