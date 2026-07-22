import { createFileRoute } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { Plus, Search, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/empty-state";

export const Route = createFileRoute("/_authenticated/clients/")({
  head: () => ({
    meta: [
      { title: "Clientes — SOM" },
      { name: "description", content: "Gerencie seus clientes." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: ClientsPage,
});

function ClientsPage() {
  const { t } = useTranslation();
  return (
    <div className="mx-auto max-w-7xl space-y-6 p-8">
      <PageHeader
        title={t("clients.title")}
        actions={
          <Button>
            <Plus className="mr-2 h-4 w-4" aria-hidden="true" />
            {t("clients.new")}
          </Button>
        }
      />
      <div className="relative max-w-sm">
        <Search
          className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
          aria-hidden="true"
        />
        <Input
          type="search"
          placeholder={t("clients.search")}
          aria-label={t("clients.search")}
          className="pl-9"
        />
      </div>
      <EmptyState icon={Users} title={t("clients.empty")} />
    </div>
  );
}
