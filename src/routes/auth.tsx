import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LanguageSwitcher } from "@/components/language-switcher";
import { toast } from "sonner";
import {
  claimClientAccess,
  clearAuthNext,
  extractAccessTokenFromPath,
  hasPlatformAccess,
  isSafeAppPath,
  readAuthNext,
  rememberAuthNext,
  resolvePostLoginPath,
  toClientProjectFeedPath,
} from "@/lib/api";

export const Route = createFileRoute("/auth")({
  ssr: false,
  validateSearch: (search: Record<string, unknown>): { next?: string } => {
    if (typeof search.next === "string" && isSafeAppPath(search.next)) {
      return { next: search.next };
    }
    return {};
  },
  head: () => ({
    meta: [
      { title: "Entrar — SOM" },
      {
        name: "description",
        content:
          "Acesse sua conta no SOM para gerenciar clientes, produzir conteúdo e acompanhar aprovações de posts em um só lugar.",
      },
      { property: "og:title", content: "Entrar — SOM" },
      {
        property: "og:description",
        content:
          "Entre no SOM para gerenciar clientes, produção de conteúdo e aprovações com sua equipe.",
      },
      { property: "og:type", content: "website" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AuthPage,
});

function isUnauthorizedLoginError(message: string): boolean {
  const normalized = message.toLowerCase();
  return (
    normalized.includes("invalid login") ||
    normalized.includes("invalid credentials") ||
    normalized.includes("invalid email or password") ||
    normalized.includes("user not found") ||
    normalized.includes("email not confirmed")
  );
}

function AuthPage() {
  const { t } = useTranslation();
  const router = useRouter();
  const { next: nextFromSearch } = Route.useSearch();
  const [mode, setMode] = useState<"signin" | "forgot">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [accessDenied, setAccessDenied] = useState(false);

  const nextPath = nextFromSearch ?? readAuthNext() ?? undefined;

  useEffect(() => {
    if (nextFromSearch) rememberAuthNext(nextFromSearch);
  }, [nextFromSearch]);

  const denyAccess = async () => {
    await supabase.auth.signOut();
    setAccessDenied(true);
  };

  const goAfterLogin = async () => {
    const rawNext = nextPath && isSafeAppPath(nextPath) ? nextPath : null;
    // Always land on Feed for project links (WhatsApp / deep links), never the last tab.
    const destination = rawNext ? toClientProjectFeedPath(rawNext) : null;
    const access = rawNext ? extractAccessTokenFromPath(rawNext) : null;

    if (access) {
      try {
        await claimClientAccess(access);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : String(err));
      }
    }

    const allowed = await hasPlatformAccess();
    if (!allowed) {
      await denyAccess();
      return;
    }

    clearAuthNext();
    setAccessDenied(false);

    if (destination) {
      router.history.push(destination);
      return;
    }

    const dest = await resolvePostLoginPath();
    if (dest.to === "/clients/$clientId/projects/$projectId/feed") {
      router.navigate({
        to: dest.to,
        params: dest.params,
        search: dest.search,
        replace: true,
      });
    } else {
      router.navigate({ to: dest.to, replace: true });
    }
  };

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data }) => {
      if (data.session) await goAfterLogin();
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- run once on mount
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setAccessDenied(false);
    try {
      if (mode === "signin") {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) {
          if (isUnauthorizedLoginError(error.message)) {
            setAccessDenied(true);
            return;
          }
          throw error;
        }
        await goAfterLogin();
      } else {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/reset-password`,
        });
        if (error) throw error;
        toast.success(t("auth.resetSent"));
        setMode("signin");
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  const handleGoogle = async () => {
    setAccessDenied(false);
    rememberAuthNext(nextPath);
    const redirectTo = `${window.location.origin}/auth${nextPath ? `?next=${encodeURIComponent(nextPath)}` : ""}`;
    const host = window.location.hostname;
    const onLovableHost = host.endsWith(".lovable.app") || host.endsWith(".lovable.dev");

    // Netlify (and any custom domain) must use Supabase Google OAuth.
    // Lovable's /~oauth broker only allows *.lovable.app as redirect_uri.
    // If Supabase Site URL is still the Lovable host, OAuth may bounce there after login —
    // set Site URL to the Netlify origin and keep both hosts in Redirect URLs.
    if (!onLovableHost) {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo },
      });
      if (error) {
        toast.error(
          error.message.toLowerCase().includes("provider") ||
            error.message.toLowerCase().includes("oauth") ||
            error.message.toLowerCase().includes("redirect")
            ? "Google: no Supabase → Authentication → URL Configuration, defina Site URL como https://som-sistemaoperacionaldamarca.netlify.app e inclua essa URL em Redirect URLs."
            : error.message,
        );
      }
      return;
    }

    const result = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: redirectTo,
    });
    if (result.error) {
      toast.error(result.error instanceof Error ? result.error.message : "Google sign-in failed");
      return;
    }
    if (result.redirected) return;
    await goAfterLogin();
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/40 px-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="flex justify-end">
          <LanguageSwitcher />
        </div>
        <div className="text-center">
          <h1 className="text-2xl font-semibold tracking-tight">{t("app.name")}</h1>
          <p className="text-sm text-muted-foreground">{t("app.tagline")}</p>
          {nextPath ? (
            <p className="mt-2 text-sm text-muted-foreground">{t("auth.reviewInviteHint")}</p>
          ) : null}
        </div>

        <div className="rounded-lg border bg-card p-6 shadow-sm">
          <h2 className="mb-4 text-lg font-medium">
            {mode === "signin" && t("auth.signIn")}
            {mode === "forgot" && t("auth.resetPassword")}
          </h2>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="email">{t("auth.email")}</Label>
              <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
            </div>
            {mode !== "forgot" && (
              <div className="space-y-1.5">
                <Label htmlFor="password">{t("auth.password")}</Label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={6}
                />
              </div>
            )}
            <Button type="submit" className="w-full" disabled={busy}>
              {mode === "signin" && t("auth.signIn")}
              {mode === "forgot" && t("auth.sendResetLink")}
            </Button>
          </form>

          {accessDenied ? (
            <div className="mt-4 rounded-md border border-amber-200 bg-amber-50 px-3 py-3 text-sm text-amber-950">
              <p>{t("auth.accessDenied")}</p>
              <Link
                to="/"
                hash="planos"
                className="mt-2 inline-block font-medium text-primary underline-offset-4 hover:underline"
              >
                {t("auth.accessDeniedCta")}
              </Link>
            </div>
          ) : null}

          {mode !== "forgot" && (
            <>
              <div className="my-4 flex items-center gap-2 text-xs text-muted-foreground">
                <div className="h-px flex-1 bg-border" />
                <span>or</span>
                <div className="h-px flex-1 bg-border" />
              </div>
              <Button variant="outline" className="w-full" onClick={handleGoogle}>
                {t("auth.signInWithGoogle")}
              </Button>
            </>
          )}

          <div className="mt-6 space-y-2 text-center text-sm">
            {mode === "signin" && (
              <>
                <button
                  type="button"
                  className="text-muted-foreground hover:underline"
                  onClick={() => {
                    setAccessDenied(false);
                    setMode("forgot");
                  }}
                >
                  {t("auth.forgotPassword")}
                </button>
                <div>
                  {t("auth.noAccount")}{" "}
                  <Link
                    to="/"
                    hash="planos"
                    className="font-medium text-primary hover:underline"
                  >
                    {t("auth.requestAccess")}
                  </Link>
                </div>
              </>
            )}
            {mode === "forgot" && (
              <button
                type="button"
                className="text-muted-foreground hover:underline"
                onClick={() => setMode("signin")}
              >
                {t("auth.backToSignIn")}
              </button>
            )}
          </div>
        </div>

        <div className="text-center text-xs text-muted-foreground">
          <Link to="/" className="hover:underline">
            ← Home
          </Link>
        </div>
      </div>
    </div>
  );
}
