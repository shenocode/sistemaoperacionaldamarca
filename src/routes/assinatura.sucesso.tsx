import { useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { getCheckoutSessionStatus, type CheckoutSessionStatus } from "@/lib/api";

export const Route = createFileRoute("/assinatura/sucesso")({
  ssr: false,
  validateSearch: (search: Record<string, unknown>) => ({
    session_id: typeof search.session_id === "string" ? search.session_id : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Assinatura confirmada — SOM" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AssinaturaSucessoPage,
});

function AssinaturaSucessoPage() {
  const { t } = useTranslation();
  const { session_id: sessionId } = Route.useSearch();
  const [status, setStatus] = useState<CheckoutSessionStatus>(sessionId ? "pending" : "ready");

  useEffect(() => {
    if (!sessionId) return;
    let cancelled = false;
    let attempts = 0;

    const poll = async () => {
      try {
        const result = await getCheckoutSessionStatus(sessionId);
        if (cancelled) return;
        setStatus(result.status);
        if (result.status === "pending" && attempts < 20) {
          attempts += 1;
          window.setTimeout(() => void poll(), 1500);
        }
      } catch {
        if (!cancelled && attempts < 20) {
          attempts += 1;
          window.setTimeout(() => void poll(), 2000);
        } else if (!cancelled) {
          setStatus("failed");
        }
      }
    };

    void poll();
    return () => {
      cancelled = true;
    };
  }, [sessionId]);

  const body =
    status === "ready"
      ? t("subscription.successReady", {
          defaultValue:
            "Assinatura ativa. Defina a senha no e-mail do checkout (ou entre com a conta que já tinha).",
        })
      : status === "failed" || status === "invalid"
        ? t("subscription.successFailed", {
            defaultValue:
              "Não encontramos a confirmação ainda. Se o valor foi cobrado, aguarde o e-mail ou fale com o suporte.",
          })
        : t("subscription.successPending", {
            defaultValue: "Confirmando o pagamento… isso costuma levar alguns segundos.",
          });

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/40 px-4">
      <div className="w-full max-w-md space-y-6 rounded-lg border bg-card p-8 text-center shadow-sm">
        <h1 className="text-2xl font-semibold tracking-tight">
          {t("subscription.successTitle", { defaultValue: "Pagamento confirmado" })}
        </h1>
        <p className="text-sm text-muted-foreground">{body}</p>
        <div className="flex flex-col gap-2 sm:flex-row sm:justify-center">
          <Button asChild disabled={status === "pending"}>
            <Link to="/auth">
              {t("subscription.successCta", { defaultValue: "Ir para o login" })}
            </Link>
          </Button>
          <Button asChild variant="outline">
            <Link to="/">{t("subscription.backHome", { defaultValue: "Voltar ao início" })}</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
