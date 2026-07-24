import { useState } from "react";
import { Link, useParams, useRouter } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  FileText,
  FolderKanban,
  LayoutDashboard,
  LogOut,
  Menu,
  Settings,
  Users,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { getProject } from "@/lib/api";
import { supabase } from "@/integrations/supabase/client";
import { LanguageSwitcher } from "./language-switcher";
import { useAppRole } from "@/hooks/use-app-role";
import { Button } from "./ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "./ui/sheet";

export function AppShell({ children }: { children: React.ReactNode }) {
  const { t } = useTranslation();
  const router = useRouter();
  const { isAdmin, isClient, loading } = useAppRole();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const params = useParams({ strict: false }) as {
    clientId?: string;
    projectId?: string;
  };

  const showClientProjectNav = isClient && params.clientId && params.projectId;

  const projectQuery = useQuery({
    queryKey: ["projects", "detail", params.projectId],
    queryFn: () => getProject(params.projectId!),
    enabled: Boolean(showClientProjectNav && params.projectId),
  });

  const handleSignOut = async () => {
    setMobileNavOpen(false);
    await supabase.auth.signOut();
    router.navigate({ to: "/auth", search: {}, replace: true });
  };

  const closeMobileNav = () => setMobileNavOpen(false);

  const navClass =
    "flex items-center gap-2 rounded-md px-3 py-2 text-sm hover:bg-sidebar-accent";
  const navActiveClass =
    "flex items-center gap-2 rounded-md bg-sidebar-accent px-3 py-2 text-sm text-sidebar-accent-foreground hover:bg-sidebar-accent";

  const navLinks = (
    <>
      {loading ? null : isAdmin ? (
        <>
          <Link
            to="/dashboard"
            onClick={closeMobileNav}
            className={navClass}
            activeProps={{ className: navActiveClass }}
          >
            <LayoutDashboard className="h-4 w-4" /> {t("nav.dashboard")}
          </Link>
          <Link
            to="/clients"
            onClick={closeMobileNav}
            className={navClass}
            activeProps={{ className: navActiveClass }}
          >
            <Users className="h-4 w-4" /> {t("nav.clients")}
          </Link>
        </>
      ) : (
        <>
          {showClientProjectNav ? (
            <Link
              to="/clients/$clientId/projects/$projectId/content"
              params={{ clientId: params.clientId!, projectId: params.projectId! }}
              search={{}}
              onClick={closeMobileNav}
              className={navActiveClass}
            >
              <FolderKanban className="h-4 w-4 shrink-0" />
              <span className="truncate">
                {projectQuery.data?.name ?? t("common.loading")}
              </span>
            </Link>
          ) : (
            <Link
              to="/home"
              onClick={closeMobileNav}
              className={navClass}
              activeProps={{ className: navActiveClass }}
            >
              <FileText className="h-4 w-4" /> {t("nav.myProjects")}
            </Link>
          )}
          <Link
            to="/settings"
            onClick={closeMobileNav}
            className={navClass}
            activeProps={{ className: navActiveClass }}
          >
            <Settings className="h-4 w-4" /> {t("nav.settings")}
          </Link>
        </>
      )}
      {!loading && (
        <button
          type="button"
          onClick={handleSignOut}
          className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm hover:bg-sidebar-accent"
        >
          <LogOut className="h-4 w-4" /> {t("nav.signOut")}
        </button>
      )}
    </>
  );

  return (
    <div className="flex min-h-screen bg-background">
      <aside className="hidden w-60 shrink-0 border-r bg-sidebar text-sidebar-foreground md:flex md:flex-col">
        <div className="border-b px-6 py-4">
          <div className="text-lg font-semibold tracking-tight">{t("app.name")}</div>
          <div className="text-xs text-muted-foreground">{t("app.tagline")}</div>
          <LanguageSwitcher className="mt-3 w-full" />
        </div>
        <nav className="flex-1 space-y-1 p-3">{navLinks}</nav>
      </aside>

      <header className="fixed inset-x-0 top-0 z-40 flex h-14 items-center gap-3 border-b bg-background/95 px-4 backdrop-blur supports-[backdrop-filter]:bg-background/80 md:hidden">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="-ml-1"
          onClick={() => setMobileNavOpen(true)}
          aria-label={t("nav.openMenu")}
        >
          <Menu className="h-5 w-5" />
        </Button>
        <div className="min-w-0">
          <div className="truncate text-sm font-semibold tracking-tight">{t("app.name")}</div>
          <div className="truncate text-[11px] text-muted-foreground">{t("app.tagline")}</div>
        </div>
      </header>

      <Sheet open={mobileNavOpen} onOpenChange={setMobileNavOpen}>
        <SheetContent
          side="left"
          className="flex w-[min(100%,20rem)] flex-col bg-sidebar p-0 text-sidebar-foreground"
        >
          <SheetHeader className="border-b px-6 py-4 text-left">
            <SheetTitle className="text-lg font-semibold tracking-tight text-sidebar-foreground">
              {t("app.name")}
            </SheetTitle>
            <SheetDescription className="text-xs text-muted-foreground">
              {t("app.tagline")}
            </SheetDescription>
            <LanguageSwitcher className="mt-3 w-full" />
          </SheetHeader>
          <nav className="flex-1 space-y-1 overflow-y-auto p-3">{navLinks}</nav>
        </SheetContent>
      </Sheet>

      <main className="min-w-0 flex-1 pt-14 md:pt-0">{children}</main>
    </div>
  );
}
