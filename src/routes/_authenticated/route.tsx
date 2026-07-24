import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/app-shell";
import { isSafeAppPath, rememberAuthNext, toClientProjectFeedPath } from "@/lib/api";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async ({ location }) => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) {
      const raw = `${location.pathname}${location.searchStr || ""}`;
      // Prefer Feed so WhatsApp / deep links don't reopen Calendar or Content after login.
      const next = toClientProjectFeedPath(raw) ?? (isSafeAppPath(raw) ? raw : null);
      if (next) rememberAuthNext(next);
      throw redirect({
        to: "/auth",
        search: next ? { next } : {},
      });
    }
    return { user: data.user };
  },
  component: () => (
    <AppShell>
      <Outlet />
    </AppShell>
  ),
});
