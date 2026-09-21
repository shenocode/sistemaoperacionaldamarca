import { useTranslation } from "react-i18next";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { ClientBillingInput } from "@/lib/api";
import { formatMoneyInput, parseMoneyInput } from "@/lib/calendar-period-closing";

export type ClientBillingFormState = {
  feeText: string;
  paymentDay: string;
  pixKey: string;
  pixHolder: string;
};

export const emptyBillingForm: ClientBillingFormState = {
  feeText: "",
  paymentDay: "",
  pixKey: "",
  pixHolder: "",
};

export function billingFormFromInput(billing: ClientBillingInput): ClientBillingFormState {
  return {
    feeText: billing.monthlyFee != null ? formatMoneyInput(billing.monthlyFee) : "",
    paymentDay: billing.paymentDay != null ? String(billing.paymentDay) : "",
    pixKey: billing.pixKey,
    pixHolder: billing.pixHolder,
  };
}

export function billingInputFromForm(form: ClientBillingFormState): ClientBillingInput {
  const dayRaw = form.paymentDay.trim();
  const day = dayRaw ? Number(dayRaw) : NaN;
  return {
    monthlyFee: parseMoneyInput(form.feeText),
    paymentDay: Number.isFinite(day) && day >= 1 && day <= 31 ? Math.round(day) : null,
    pixKey: form.pixKey,
    pixHolder: form.pixHolder,
  };
}

export function ClientBillingFields({
  value,
  onChange,
  idPrefix,
}: {
  value: ClientBillingFormState;
  onChange: (next: ClientBillingFormState) => void;
  idPrefix: string;
}) {
  const { t } = useTranslation();

  function setField<K extends keyof ClientBillingFormState>(key: K, next: ClientBillingFormState[K]) {
    onChange({ ...value, [key]: next });
  }

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor={`${idPrefix}-fee`}>{t("clients.billing.monthlyFee")}</Label>
          <Input
            id={`${idPrefix}-fee`}
            inputMode="decimal"
            value={value.feeText}
            onChange={(e) => setField("feeText", e.target.value)}
            placeholder="1.200,00"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={`${idPrefix}-day`}>{t("clients.billing.paymentDay")}</Label>
          <Input
            id={`${idPrefix}-day`}
            type="number"
            min={1}
            max={31}
            value={value.paymentDay}
            onChange={(e) => setField("paymentDay", e.target.value)}
            placeholder="20"
          />
          <p className="text-xs text-muted-foreground">{t("clients.billing.paymentDayHint")}</p>
        </div>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor={`${idPrefix}-holder`}>{t("clients.billing.pixHolder")}</Label>
        <Input
          id={`${idPrefix}-holder`}
          value={value.pixHolder}
          onChange={(e) => setField("pixHolder", e.target.value)}
          placeholder={t("clients.billing.pixHolderPlaceholder")}
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor={`${idPrefix}-pix`}>{t("clients.billing.pixKey")}</Label>
        <Input
          id={`${idPrefix}-pix`}
          value={value.pixKey}
          onChange={(e) => setField("pixKey", e.target.value)}
          placeholder={t("clients.billing.pixKeyPlaceholder")}
        />
      </div>
    </div>
  );
}
