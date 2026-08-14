import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Paperclip, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { submitHelpRequest } from "@/lib/api";
import { getLocalizedText, normalizeAppLocale } from "@/lib/i18n-content";

const HELP_ATTACHMENT_ACCEPT =
  "image/jpeg,image/png,image/gif,image/webp,image/heic,image/heif,application/pdf,.pdf,.doc,.docx,text/plain";
const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024;
const MIN_MESSAGE_LENGTH = 10;

type HelpClientOption = {
  id: string;
  name: string;
  i18n?: unknown;
};

type HelpFormProps = {
  idPrefix?: string;
  /** Gestor: message to platform admin. Client: requires clientId. */
  audience: "gestor" | "client";
  clientId?: string;
  clients?: HelpClientOption[];
  onClientIdChange?: (clientId: string) => void;
  /** When false, page header owns title/hint (dedicated /help route). */
  showIntro?: boolean;
};

function resolveAttachmentContentType(file: File): string {
  const ct = (file.type || "").trim().toLowerCase();
  if (ct && ct !== "application/octet-stream") return ct;
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
  const byExt: Record<string, string> = {
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    png: "image/png",
    gif: "image/gif",
    webp: "image/webp",
    heic: "image/heic",
    heif: "image/heif",
    pdf: "application/pdf",
    doc: "application/msword",
    docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    txt: "text/plain",
  };
  return byExt[ext] || ct || "application/octet-stream";
}

async function fileToAttachment(file: File) {
  if (file.size > MAX_ATTACHMENT_BYTES) {
    throw new Error("MAX_SIZE");
  }
  const buffer = await file.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.length; i += 1) {
    binary += String.fromCharCode(bytes[i]);
  }
  return {
    fileName: file.name,
    contentType: resolveAttachmentContentType(file),
    base64: btoa(binary),
  };
}

export function HelpForm({
  idPrefix = "help",
  audience,
  clientId,
  clients,
  onClientIdChange,
  showIntro = true,
}: HelpFormProps) {
  const { t, i18n } = useTranslation();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [message, setMessage] = useState("");
  const [attachment, setAttachment] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const uiLocale = normalizeAppLocale(i18n.resolvedLanguage ?? i18n.language);

  const resolvedClientId =
    audience === "client"
      ? clientId ?? (clients?.length === 1 ? clients[0].id : "")
      : undefined;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = message.trim();
    if (trimmed.length < MIN_MESSAGE_LENGTH) {
      toast.error(t("help.messageTooShort"));
      return;
    }
    if (audience === "client" && !resolvedClientId) {
      toast.error(t("help.clientRequired"));
      return;
    }

    setSubmitting(true);
    try {
      let attachmentPayload: { fileName: string; contentType: string; base64: string } | undefined;
      if (attachment) {
        try {
          attachmentPayload = await fileToAttachment(attachment);
        } catch (err) {
          if (err instanceof Error && err.message === "MAX_SIZE") {
            toast.error(t("help.attachmentTooLarge"));
            return;
          }
          throw err;
        }
      }

      await submitHelpRequest({
        message: trimmed,
        clientId: resolvedClientId,
        locale: uiLocale,
        attachment: attachmentPayload,
      });

      setMessage("");
      setAttachment(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
      toast.success(t("help.sent"));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("help.sendError"));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form className="space-y-4" onSubmit={(e) => void handleSubmit(e)}>
      {showIntro ? (
        <div className="space-y-1">
          <p className="text-sm font-medium">{t("help.sectionTitle")}</p>
          <p className="text-xs text-muted-foreground">
            {audience === "gestor" ? t("help.gestorHint") : t("help.clientHint")}
          </p>
        </div>
      ) : null}

      {audience === "client" && clients && clients.length > 1 ? (
        <div className="space-y-1.5">
          <Label htmlFor={`${idPrefix}-client`}>{t("help.clientLabel")}</Label>
          <Select value={resolvedClientId} onValueChange={onClientIdChange}>
            <SelectTrigger id={`${idPrefix}-client`}>
              <SelectValue placeholder={t("help.clientPlaceholder")} />
            </SelectTrigger>
            <SelectContent>
              {clients.map((client) => (
                <SelectItem key={client.id} value={client.id}>
                  {getLocalizedText(client.i18n, "name", client.name, uiLocale)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      ) : null}

      <div className="space-y-1.5">
        <Label htmlFor={`${idPrefix}-message`}>{t("help.messageLabel")}</Label>
        <Textarea
          id={`${idPrefix}-message`}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder={t("help.messagePlaceholder")}
          rows={5}
          maxLength={5000}
          required
        />
      </div>

      <div className="space-y-2">
        <Label>{t("help.attachmentLabel")}</Label>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="secondary"
            size="sm"
            disabled={submitting}
            onClick={() => fileInputRef.current?.click()}
          >
            <Paperclip className="mr-1.5 h-4 w-4" aria-hidden="true" />
            {t("help.attachmentChoose")}
          </Button>
          {attachment ? (
            <span className="inline-flex max-w-full items-center gap-1 rounded-md border bg-muted/40 px-2 py-1 text-xs">
              <span className="truncate">{attachment.name}</span>
              <button
                type="button"
                className="rounded p-0.5 hover:bg-muted"
                aria-label={t("help.attachmentRemove")}
                onClick={() => {
                  setAttachment(null);
                  if (fileInputRef.current) fileInputRef.current.value = "";
                }}
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </span>
          ) : null}
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept={HELP_ATTACHMENT_ACCEPT}
          className="sr-only"
          aria-label={t("help.attachmentChoose")}
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (!file) return;
            if (file.size > MAX_ATTACHMENT_BYTES) {
              toast.error(t("help.attachmentTooLarge"));
              e.target.value = "";
              return;
            }
            setAttachment(file);
          }}
        />
        <p className="text-xs text-muted-foreground">{t("help.attachmentHint")}</p>
      </div>

      <Button type="submit" disabled={submitting}>
        {submitting ? t("help.sending") : t("help.submit")}
      </Button>
    </form>
  );
}
