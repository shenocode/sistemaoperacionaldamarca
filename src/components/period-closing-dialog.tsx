import { useEffect, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { AlertTriangle, ClipboardCopy, MessageCircle } from "lucide-react";
import { toast } from "sonner";
import {
  ClientBillingFields,
  billingFormFromInput,
  billingInputFromForm,
  emptyBillingForm,
  type ClientBillingFormState,
} from "@/components/client-billing-fields";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  buildWhatsAppNotifyUrl,
  resolveClientBilling,
  updateClientBilling,
  type Client,
  type ContentItem,
} from "@/lib/api";
import {
  composePeriodClosingMessage,
  countApprovedNotPublished,
  countPeriodClosingFormats,
  formatDateLabel,
  formatMoneyDisplay,
  parseMoneyInput,
  paymentDateFromDay,
  periodEndFromItems,
  toDateInputValue,
  type PeriodClosingScope,
} from "@/lib/calendar-period-closing";

export type PeriodClosingDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clientId: string;
  client: Client | null;
  blockTitle: string;
  items: ContentItem[];
  isPeriodFinished: boolean;
};

async function copyText(text: string) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }
  const el = document.createElement("textarea");
  el.value = text;
  el.setAttribute("readonly", "");
  el.style.position = "fixed";
  el.style.left = "-9999px";
  document.body.appendChild(el);
  el.select();
  document.execCommand("copy");
  document.body.removeChild(el);
}

export function PeriodClosingDialog({
  open,
  onOpenChange,
  clientId,
  client,
  blockTitle,
  items,
  isPeriodFinished,
}: PeriodClosingDialogProps) {
  const { t, i18n } = useTranslation();
  const queryClient = useQueryClient();
  const locale = i18n.resolvedLanguage ?? i18n.language ?? "pt-BR";
  const [billingForm, setBillingForm] = useState<ClientBillingFormState>(emptyBillingForm);
  const [paymentDate, setPaymentDate] = useState("");
  const [notes, setNotes] = useState("");
  const [scope, setScope] = useState<PeriodClosingScope>("published");
  const [saveAsDefault, setSaveAsDefault] = useState(true);
  const [editedMessage, setEditedMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    const billing = resolveClientBilling(clientId, client);
    setBillingForm(billingFormFromInput(billing));
    setNotes("");
    setScope("published");
    setSaveAsDefault(true);
    setEditedMessage(null);
    const periodEnd = periodEndFromItems(items);
    if (billing.paymentDay) {
      setPaymentDate(toDateInputValue(paymentDateFromDay(periodEnd, billing.paymentDay)));
    } else {
      setPaymentDate("");
    }
    // Reset only when the dialog opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  function handleBillingChange(next: ClientBillingFormState) {
    const dayChanged = next.paymentDay !== billingForm.paymentDay;
    setBillingForm(next);
    setEditedMessage(null);
    if (!dayChanged) return;
    const day = Number(next.paymentDay);
    if (!Number.isFinite(day) || day < 1 || day > 31) return;
    setPaymentDate(toDateInputValue(paymentDateFromDay(periodEndFromItems(items), day)));
  }

  const counts = useMemo(() => countPeriodClosingFormats(items, scope), [items, scope]);
  const approvedPending = useMemo(() => countApprovedNotPublished(items), [items]);
  const periodLabel = blockTitle.trim() || t("project.calendar.untitledPeriod");
  const clientName = client?.name?.trim() || t("clients.name");
  const amount = parseMoneyInput(billingForm.feeText);
  const scopeLabel = t(`project.calendar.periodClosing.scope.${scope}`);

  const composedMessage = useMemo(() => {
    const formatLines = counts.byFormat.map((row) =>
      t("project.calendar.periodClosing.formatLine", {
        count: row.count,
        format: t(`project.detail.formats.${row.format}`),
      }),
    );
    const pixKey = billingForm.pixKey.trim();
    const pixHolder = billingForm.pixHolder.trim();
    return composePeriodClosingMessage({
      greeting: t("project.calendar.periodClosing.greeting", {
        client: clientName,
        period: periodLabel,
      }),
      totalLine: t(
        counts.total === 1
          ? "project.calendar.periodClosing.totalLineOne"
          : "project.calendar.periodClosing.totalLineOther",
        { count: counts.total, scope: scopeLabel },
      ),
      formatLines,
      amountLine:
        amount != null
          ? t("project.calendar.periodClosing.amountLine", {
              amount: formatMoneyDisplay(amount, locale),
            })
          : undefined,
      paymentLine: paymentDate
        ? t("project.calendar.periodClosing.paymentLine", {
            date: formatDateLabel(paymentDate, locale),
          })
        : undefined,
      pixLine: pixKey
        ? t(
            pixHolder
              ? "project.calendar.periodClosing.pixLineWithHolder"
              : "project.calendar.periodClosing.pixLine",
            { key: pixKey, holder: pixHolder },
          )
        : undefined,
      notes,
      closing: t("project.calendar.periodClosing.closing"),
    });
  }, [
    amount,
    billingForm.pixHolder,
    billingForm.pixKey,
    clientName,
    counts.byFormat,
    counts.total,
    locale,
    notes,
    paymentDate,
    periodLabel,
    scopeLabel,
    t,
  ]);

  const message = editedMessage ?? composedMessage;

  async function persistDefaultsIfNeeded() {
    if (!saveAsDefault) return;
    await updateClientBilling(clientId, billingInputFromForm(billingForm));
    void queryClient.invalidateQueries({ queryKey: ["clients", clientId] });
    void queryClient.invalidateQueries({ queryKey: ["clients"] });
  }

  async function handleCopy() {
    setBusy(true);
    try {
      await persistDefaultsIfNeeded();
      await copyText(message);
      toast.success(t("project.calendar.periodClosing.copied"));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("project.calendar.periodClosing.copyFailed"));
    } finally {
      setBusy(false);
    }
  }

  async function handleWhatsApp() {
    const url = buildWhatsAppNotifyUrl(client?.whatsapp, message);
    if (!url) {
      toast.error(t("clients.whatsappMissing"));
      return;
    }
    setBusy(true);
    try {
      await persistDefaultsIfNeeded();
      const opened = window.open(url, "_blank", "noopener,noreferrer");
      if (!opened) {
        toast.error(t("clients.whatsappBlocked"));
        return;
      }
      toast.success(t("clients.whatsappOpened"));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("common.error"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>{t("project.calendar.periodClosing.title")}</DialogTitle>
          <DialogDescription>
            {t("project.calendar.periodClosing.description", { period: periodLabel })}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {!isPeriodFinished ? (
            <Alert>
              <AlertTriangle className="h-4 w-4" aria-hidden="true" />
              <AlertDescription>{t("project.calendar.periodClosing.periodActiveHint")}</AlertDescription>
            </Alert>
          ) : null}
          {scope === "published" && approvedPending > 0 ? (
            <Alert>
              <AlertTriangle className="h-4 w-4" aria-hidden="true" />
              <AlertDescription>
                {t("project.calendar.periodClosing.approvedPendingHint", { count: approvedPending })}
              </AlertDescription>
            </Alert>
          ) : null}

          <div className="space-y-1.5">
            <Label>{t("project.calendar.periodClosing.scopeLabel")}</Label>
            <Select
              value={scope}
              onValueChange={(value) => {
                setScope(value as PeriodClosingScope);
                setEditedMessage(null);
              }}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="published">
                  {t("project.calendar.periodClosing.scope.published")}
                </SelectItem>
                <SelectItem value="delivered">
                  {t("project.calendar.periodClosing.scope.delivered")}
                </SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              {t("project.calendar.periodClosing.totalPreview", { count: counts.total })}
            </p>
          </div>

          <ClientBillingFields
            idPrefix="period-closing"
            value={billingForm}
            onChange={handleBillingChange}
          />

          <div className="space-y-1.5">
            <Label htmlFor="period-closing-date">{t("project.calendar.periodClosing.paymentDate")}</Label>
            <Input
              id="period-closing-date"
              type="date"
              value={paymentDate}
              onChange={(e) => {
                setPaymentDate(e.target.value);
                setEditedMessage(null);
              }}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="period-closing-notes">{t("project.calendar.periodClosing.notes")}</Label>
            <Textarea
              id="period-closing-notes"
              value={notes}
              onChange={(e) => {
                setNotes(e.target.value);
                setEditedMessage(null);
              }}
              placeholder={t("project.calendar.periodClosing.notesPlaceholder")}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="period-closing-message">{t("project.calendar.periodClosing.preview")}</Label>
            <Textarea
              id="period-closing-message"
              className="min-h-[180px] font-mono text-sm"
              value={message}
              onChange={(e) => setEditedMessage(e.target.value)}
            />
          </div>

          <label className="flex items-start gap-2 text-sm">
            <Checkbox
              checked={saveAsDefault}
              onCheckedChange={(checked) => setSaveAsDefault(checked === true)}
              className="mt-0.5"
            />
            <span>{t("project.calendar.periodClosing.saveAsDefault")}</span>
          </label>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>
            {t("common.cancel")}
          </Button>
          <Button type="button" variant="outline" onClick={() => void handleCopy()} disabled={busy}>
            <ClipboardCopy className="mr-1.5 h-4 w-4" aria-hidden="true" />
            {t("project.calendar.periodClosing.copy")}
          </Button>
          <Button type="button" onClick={() => void handleWhatsApp()} disabled={busy}>
            <MessageCircle className="mr-1.5 h-4 w-4" aria-hidden="true" />
            {t("project.calendar.periodClosing.openWhatsApp")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
