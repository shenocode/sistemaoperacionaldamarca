import { createFileRoute } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";

export const Route = createFileRoute("/_authenticated/clients/$clientId/projects/$projectId/settings")({
  component: () => {
    const { t } = useTranslation();
    return (
      <div className="rounded-lg border border-dashed p-12 text-center text-sm text-muted-foreground">
        {t("project.tabs.settings")}
      </div>
    );
  },
});
