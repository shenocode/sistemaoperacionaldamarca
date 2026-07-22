import { createFileRoute, Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { ChevronLeft, FolderKanban, Plus } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/empty-state";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/clients/$clientId/")({
  head: () => ({
    meta: [{ title: "Cliente — SOM" }, { name: "robots", content: "noindex" }],
  }),
  component: ClientDetailPage,
});

function ClientDetailPage() {
  const { clientId } = Route.useParams();
  const { t } = useTranslation();
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
        title={`Client ${clientId}`}
        description={t("clients.projects")}
        actions={
          <Button>
            <Plus className="mr-2 h-4 w-4" aria-hidden="true" />
            {t("clients.new")}
          </Button>
        }
      />
      <EmptyState icon={FolderKanban} title={t("clients.empty")} />
    </div>
  );
}
