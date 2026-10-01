import { createFileRoute, Link, Outlet, redirect } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { isAdmin, resolvePostLoginPath } from "@/lib/api";

export const Route = createFileRoute("/_authenticated/profile/route 2")({
  beforeLoad: async () => {
    if (!(await isAdmin())) {
      const dest = await resolvePostLoginPath();
      if (dest.to === "/clients/$clientId/projects/$projectId/feed") {
        throw redirect({ to: dest.to, params: dest.params, search: dest.search });
      }
      throw redirect({ to: dest.to });
    }
  },
  head: () => ({
    meta: [
      { title: "Meu Perfil — SOM" },
      { name: "description", content: "Atualize seus dados de acesso e contato." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: GestorProfileLayout,
});

function GestorProfileLayout() {
  const { t } = useTranslation();

  return (
    <div className="mx-auto max-w-lg space-y-6 px-4 py-6 sm:px-6 sm:py-8 md:p-8">
      <Outlet />
      <p className="text-sm text-muted-foreground">
        {t("gestorProfile.helpLinkPrefix")}{" "}
        <Link to="/help" className="font-medium text-foreground underline-offset-2 hover:underline">
          {t("nav.helpRequest")}
        </Link>
      </p>
    </div>
  );
}
