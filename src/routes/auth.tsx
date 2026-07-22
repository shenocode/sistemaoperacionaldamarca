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

export const Route = createFileRoute("/auth")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Entrar — SOM" },
      { name: "description", content: "Acesse sua conta SOM." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const { t } = useTranslation();
  const router = useRouter();
  const [mode, setMode] = useState<"signin" | "signup" | "forgot">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) router.navigate({ to: "/dashboard", replace: true });
    });
  }, [router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      if (mode === "signin") {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        router.navigate({ to: "/dashboard", replace: true });
      } else if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: window.location.origin,
            data: { full_name: fullName },
          },
        });
        if (error) throw error;
        toast.success("Check your inbox to confirm your email.");
      } else {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/reset-password`,
        });
        if (error) throw error;
        toast.success("Reset link sent.");
        setMode("signin");
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  const handleGoogle = async () => {
    const result = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: window.location.origin,
    });
    if (result.error) {
      toast.error(result.error instanceof Error ? result.error.message : "Google sign-in failed");
      return;
    }
    if (result.redirected) return;
    router.navigate({ to: "/dashboard", replace: true });
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
        </div>

        <div className="rounded-lg border bg-card p-6 shadow-sm">
          <h2 className="mb-4 text-lg font-medium">
            {mode === "signin" && t("auth.signIn")}
            {mode === "signup" && t("auth.signUp")}
            {mode === "forgot" && t("auth.resetPassword")}
          </h2>

          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === "signup" && (
              <div className="space-y-1.5">
                <Label htmlFor="fullName">{t("auth.fullName")}</Label>
                <Input id="fullName" value={fullName} onChange={(e) => setFullName(e.target.value)} required />
              </div>
            )}
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
              {mode === "signup" && t("auth.signUp")}
              {mode === "forgot" && t("auth.sendResetLink")}
            </Button>
          </form>

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
                <button className="text-muted-foreground hover:underline" onClick={() => setMode("forgot")}>
                  {t("auth.forgotPassword")}
                </button>
                <div>
                  {t("auth.noAccount")}{" "}
                  <button className="font-medium text-primary hover:underline" onClick={() => setMode("signup")}>
                    {t("auth.signUp")}
                  </button>
                </div>
              </>
            )}
            {mode === "signup" && (
              <div>
                {t("auth.hasAccount")}{" "}
                <button className="font-medium text-primary hover:underline" onClick={() => setMode("signin")}>
                  {t("auth.signIn")}
                </button>
              </div>
            )}
            {mode === "forgot" && (
              <button className="text-muted-foreground hover:underline" onClick={() => setMode("signin")}>
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
