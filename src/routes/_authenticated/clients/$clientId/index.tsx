import { createFileRoute, Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";

export const Route = createFileRoute("/_authenticated/clients/$clientId/")({
  head: () => ({
    meta: [
      { title: "Cliente — SOM" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: ClientDetailPage,
});

function ClientDetailPage() {
  const { clientId } = Route.useParams();
  const { t } = useTranslation();
  return (
    <div className="p-8">
      <Link to="/clients" className="text-sm text-muted-foreground hover:underline">
        ← {t("nav.clients")}
      </Link>
      <h1 className="mt-2 text-2xl font-semibold tracking-tight">Client {clientId}</h1>
      <h2 className="mt-6 text-lg font-medium">{t("clients.projects")}</h2>
      <div className="mt-4 rounded-lg border border-dashed p-8 text-sm text-muted-foreground">
        —
      </div>
    </div>
  );
}
