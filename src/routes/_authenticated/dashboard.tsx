import { createFileRoute } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { Route as AuthLayout } from "./route";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [
      { title: "Dashboard — SOM" },
      { name: "description", content: "Visão geral da sua operação SOM." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: DashboardPage,
});

function DashboardPage() {
  const { t } = useTranslation();
  const { user } = AuthLayout.useRouteContext();
  return (
    <div className="p-8">
      <h1 className="text-2xl font-semibold tracking-tight">{t("dashboard.title")}</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        {t("dashboard.welcome")}, {user.email}
      </p>
    </div>
  );
}
