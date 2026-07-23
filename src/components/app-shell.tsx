import { Link, useParams, useRouter } from "@tanstack/react-router";
import { CheckCircle2, FileText, LayoutDashboard, LogOut, Settings, Users } from "lucide-react";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { LanguageSwitcher } from "./language-switcher";
import { useAppRole } from "@/hooks/use-app-role";

export function AppShell({ children }: { children: React.ReactNode }) {
  const { t } = useTranslation();
  const router = useRouter();
  const { isAdmin, isClient, loading } = useAppRole();
  const params = useParams({ strict: false }) as {
    clientId?: string;
    projectId?: string;
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.navigate({ to: "/auth", search: {}, replace: true });
  };

  const showClientProjectNav = isClient && params.clientId && params.projectId;

  return (
    <div className="flex min-h-screen bg-background">
      <aside className="hidden w-60 shrink-0 border-r bg-sidebar text-sidebar-foreground md:flex md:flex-col">
        <div className="border-b px-6 py-5">
          <div className="text-lg font-semibold tracking-tight">{t("app.name")}</div>
          <div className="text-xs text-muted-foreground">{t("app.tagline")}</div>
        </div>
        <nav className="flex-1 space-y-1 p-3">
          {loading ? null : isAdmin ? (
            <>
              <Link
                to="/dashboard"
                className="flex items-center gap-2 rounded-md px-3 py-2 text-sm hover:bg-sidebar-accent"
                activeProps={{ className: "bg-sidebar-accent text-sidebar-accent-foreground" }}
              >
                <LayoutDashboard className="h-4 w-4" /> {t("nav.dashboard")}
              </Link>
              <Link
                to="/clients"
                className="flex items-center gap-2 rounded-md px-3 py-2 text-sm hover:bg-sidebar-accent"
                activeProps={{ className: "bg-sidebar-accent text-sidebar-accent-foreground" }}
              >
                <Users className="h-4 w-4" /> {t("nav.clients")}
              </Link>
            </>
          ) : (
            <>
              {showClientProjectNav ? (
                <>
                  <Link
                    to="/clients/$clientId/projects/$projectId/content"
                    params={{ clientId: params.clientId!, projectId: params.projectId! }}
                    search={{}}
                    className="flex items-center gap-2 rounded-md px-3 py-2 text-sm hover:bg-sidebar-accent"
                    activeProps={{ className: "bg-sidebar-accent text-sidebar-accent-foreground" }}
                  >
                    <FileText className="h-4 w-4" /> {t("nav.content")}
                  </Link>
                  <Link
                    to="/clients/$clientId/projects/$projectId/content"
                    params={{ clientId: params.clientId!, projectId: params.projectId! }}
                    search={{ filter: "review" }}
                    className="flex items-center gap-2 rounded-md px-3 py-2 text-sm hover:bg-sidebar-accent"
                    activeProps={{ className: "bg-sidebar-accent text-sidebar-accent-foreground" }}
                  >
                    <CheckCircle2 className="h-4 w-4" /> {t("nav.approvals")}
                  </Link>
                </>
              ) : (
                <Link
                  to="/home"
                  className="flex items-center gap-2 rounded-md px-3 py-2 text-sm hover:bg-sidebar-accent"
                  activeProps={{ className: "bg-sidebar-accent text-sidebar-accent-foreground" }}
                >
                  <FileText className="h-4 w-4" /> {t("nav.myProjects")}
                </Link>
              )}
              <Link
                to="/settings"
                className="flex items-center gap-2 rounded-md px-3 py-2 text-sm hover:bg-sidebar-accent"
                activeProps={{ className: "bg-sidebar-accent text-sidebar-accent-foreground" }}
              >
                <Settings className="h-4 w-4" /> {t("nav.settings")}
              </Link>
            </>
          )}
        </nav>
        <div className="space-y-2 border-t p-3">
          <LanguageSwitcher />
          <Button variant="ghost" className="w-full justify-start" onClick={handleSignOut}>
            <LogOut className="mr-2 h-4 w-4" /> {t("nav.signOut")}
          </Button>
        </div>
      </aside>
      <main className="flex-1">{children}</main>
    </div>
  );
}
