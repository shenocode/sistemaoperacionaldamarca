import { createFileRoute, Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { Plus, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/empty-state";
import { StatusBadge, type ContentStatus } from "@/components/status-badge";

type ContentRow = {
  id: string;
  title: string;
  status: ContentStatus;
  version: number;
  updated: string;
};

const rows: ContentRow[] = [];

export const Route = createFileRoute("/_authenticated/clients/$clientId/projects/$projectId/content/")({
  component: ContentListPage,
});

function ContentListPage() {
  const { clientId, projectId } = Route.useParams();
  const { t } = useTranslation();

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-end">
        <Button>
          <Plus className="mr-2 h-4 w-4" aria-hidden="true" />
          {t("project.content.new")}
        </Button>
      </div>

      {rows.length === 0 ? (
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
                    <div className="h-10 w-10 rounded-md bg-muted" />
                  </td>
                  <td className="px-4 py-3 font-medium">{r.title}</td>
                  <td className="px-4 py-3">
                    <StatusBadge status={r.status} />
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">v{r.version}</td>
                  <td className="px-4 py-3 text-muted-foreground">{r.updated}</td>
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
    </div>
  );
}
