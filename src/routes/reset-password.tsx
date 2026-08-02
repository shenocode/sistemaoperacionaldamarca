import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { PasswordInput } from "@/components/ui/password-input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

type ResetSearch = {
  code?: string;
  error?: string;
  error_description?: string;
};

export const Route = createFileRoute("/reset-password")({
  ssr: false,
  validateSearch: (search: Record<string, unknown>): ResetSearch => {
    const result: ResetSearch = {};
    if (typeof search.code === "string" && search.code.length > 0) result.code = search.code;
    if (typeof search.error === "string" && search.error.length > 0) result.error = search.error;
    if (typeof search.error_description === "string" && search.error_description.length > 0) {
      result.error_description = search.error_description;
    }
    return result;
  },
  head: () => ({
    meta: [
      { title: "Redefinir senha — SOM" },
      {
        name: "description",
        content:
          "Defina uma nova senha para sua conta SOM e volte a acessar seus clientes, conteúdos e aprovações com segurança.",
      },
      { property: "og:title", content: "Redefinir senha — SOM" },
      {
        property: "og:description",
        content: "Crie uma nova senha para recuperar o acesso à sua conta no SOM.",
      },
      { property: "og:type", content: "website" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: ResetPasswordPage,
});

function ResetPasswordPage() {
  const { t } = useTranslation();
  const router = useRouter();
  const search = Route.useSearch();
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      if (search.error) {
        toast.error(search.error_description || search.error);
        setReady(true);
        return;
      }

      if (search.code) {
        const { data: existing } = await supabase.auth.getSession();
        if (!existing.session) {
          const { error } = await supabase.auth.exchangeCodeForSession(search.code);
          if (cancelled) return;
          if (error) {
            toast.error(error.message);
            setReady(true);
            return;
          }
        }
        const url = new URL(window.location.href);
        url.searchParams.delete("code");
        url.searchParams.delete("state");
        window.history.replaceState(window.history.state, "", `${url.pathname}${url.hash}`);
      }

      if (!cancelled) setReady(true);
    })();

    return () => {
      cancelled = true;
    };
  }, [search.code, search.error, search.error_description]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      toast.success("Password updated.");
      router.navigate({ to: "/dashboard", replace: true });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/40 px-4">
      <form onSubmit={handleSubmit} className="w-full max-w-sm space-y-4 rounded-lg border bg-card p-6 shadow-sm">
        <h1 className="text-lg font-medium">{t("auth.resetPassword")}</h1>
        <div className="space-y-1.5">
          <Label htmlFor="password">{t("auth.newPassword")}</Label>
          <PasswordInput
            id="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={6}
            disabled={!ready}
            autoComplete="new-password"
          />
        </div>
        <Button type="submit" className="w-full" disabled={busy || !ready}>
          {t("auth.resetPassword")}
        </Button>
      </form>
    </div>
  );
}
