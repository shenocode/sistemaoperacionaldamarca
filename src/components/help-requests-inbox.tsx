import { useMutation } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { EmptyState } from "@/components/empty-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  getHelpRequestAttachmentUrl,
  type HelpRequest,
  type HelpRequestKind,
} from "@/lib/api";

type HelpRequestsInboxProps = {
  title: string;
  description?: string;
  requests: HelpRequest[] | undefined;
  loading: boolean;
  error: boolean;
  kind: HelpRequestKind;
};

export function HelpRequestsInbox({
  title,
  description,
  requests,
  loading,
  error,
  kind,
}: HelpRequestsInboxProps) {
  const { t, i18n } = useTranslation();

  const attachmentMutation = useMutation({
    mutationFn: (requestId: string) => getHelpRequestAttachmentUrl(requestId),
    onSuccess: ({ url }) => {
      window.open(url, "_blank", "noopener,noreferrer");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const formatDate = (iso: string) => {
    try {
      return new Intl.DateTimeFormat(i18n.language, {
        dateStyle: "short",
        timeStyle: "short",
      }).format(new Date(iso));
    } catch {
      return iso;
    }
  };

  const senderLabel = (row: HelpRequest) => {
    if (row.senderName) return row.senderName;
    return row.senderEmail;
  };

  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-base font-semibold tracking-tight">{title}</h2>
        {description ? <p className="mt-1 text-sm text-muted-foreground">{description}</p> : null}
      </div>

      {error ? <p className="text-sm text-destructive">{t("helpInbox.loadError")}</p> : null}

      {loading ? (
        <p className="text-sm text-muted-foreground">{t("common.loading")}</p>
      ) : !requests?.length ? (
        <EmptyState title={t("helpInbox.empty")} />
      ) : (
        <div className="space-y-3">
          {requests.map((row) => (
            <article key={row.id} className="rounded-md border bg-card/40 p-4 text-sm">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="space-y-0.5">
                  <p className="font-medium">{senderLabel(row)}</p>
                  <p className="text-xs text-muted-foreground">
                    <a className="underline-offset-2 hover:underline" href={`mailto:${row.senderEmail}`}>
                      {row.senderEmail}
                    </a>
                    {" · "}
                    {formatDate(row.createdAt)}
                  </p>
                </div>
                <Badge variant="outline">
                  {kind === "client_gestor" ? t("helpInbox.badgeClient") : t("helpInbox.badgeGestor")}
                </Badge>
              </div>

              {kind === "client_gestor" && row.clientName ? (
                <p className="mt-2 text-xs text-muted-foreground">
                  {t("helpInbox.client")}: <span className="text-foreground">{row.clientName}</span>
                </p>
              ) : null}

              <p className="mt-3 whitespace-pre-wrap">{row.message}</p>

              {row.hasAttachment ? (
                <Button
                  type="button"
                  variant="link"
                  className="mt-2 h-auto p-0 text-sm"
                  disabled={attachmentMutation.isPending}
                  onClick={() => attachmentMutation.mutate(row.id)}
                >
                  {t("helpInbox.openAttachment", {
                    name: row.attachmentFileName ?? t("helpInbox.attachmentFallback"),
                  })}
                </Button>
              ) : null}
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
