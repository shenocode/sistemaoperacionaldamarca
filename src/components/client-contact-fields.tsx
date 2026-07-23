import { useTranslation } from "react-i18next";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { ClientContactInput } from "@/lib/api";

export function ClientContactFields({
  form,
  onChange,
  nameRequired = false,
  autoFocusName = false,
  idPrefix = "client",
}: {
  form: ClientContactInput;
  onChange: (next: ClientContactInput) => void;
  nameRequired?: boolean;
  autoFocusName?: boolean;
  idPrefix?: string;
}) {
  const { t } = useTranslation();

  function setField<K extends keyof ClientContactInput>(key: K, value: ClientContactInput[K]) {
    onChange({ ...form, [key]: value });
  }

  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor={`${idPrefix}-name`}>{t("clients.name")}</Label>
        <Input
          id={`${idPrefix}-name`}
          value={form.name}
          onChange={(e) => setField("name", e.target.value)}
          required={nameRequired}
          autoFocus={autoFocusName}
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor={`${idPrefix}-email`}>{t("clients.email")}</Label>
        <Input
          id={`${idPrefix}-email`}
          type="email"
          value={form.email ?? ""}
          onChange={(e) => setField("email", e.target.value)}
          placeholder="cliente@email.com"
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor={`${idPrefix}-phone`}>{t("clients.phone")}</Label>
        <Input
          id={`${idPrefix}-phone`}
          type="tel"
          value={form.phone ?? ""}
          onChange={(e) => setField("phone", e.target.value)}
          placeholder="+55 11 99999-9999"
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor={`${idPrefix}-whatsapp`}>{t("clients.whatsapp")}</Label>
        <Input
          id={`${idPrefix}-whatsapp`}
          type="tel"
          value={form.whatsapp ?? ""}
          onChange={(e) => setField("whatsapp", e.target.value)}
          placeholder="5511999999999"
        />
        <p className="text-xs text-muted-foreground">{t("clients.whatsappHint")}</p>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor={`${idPrefix}-instagram`}>{t("clients.instagram")}</Label>
        <Input
          id={`${idPrefix}-instagram`}
          value={form.instagram ?? ""}
          onChange={(e) => setField("instagram", e.target.value)}
          placeholder="@cliente ou https://instagram.com/cliente"
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor={`${idPrefix}-notes`}>{t("clients.notes")}</Label>
        <Textarea
          id={`${idPrefix}-notes`}
          value={form.notes ?? ""}
          onChange={(e) => setField("notes", e.target.value)}
          rows={3}
        />
      </div>
    </div>
  );
}
