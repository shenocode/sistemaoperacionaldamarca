import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { WhatsAppPhoneField } from "@/components/whatsapp-phone-field";
import {
  buildWhatsAppNotifyUrl,
  submitContactLead,
  type ContactLeadIntent,
  type ContactLeadNiche,
} from "@/lib/api";
import { CONTACT_WHATSAPP } from "@/lib/company";
import { isValidWhatsAppLocal, splitWhatsAppDigits } from "@/lib/whatsapp-countries";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export const CONTACT_LEAD_SESSION_KEY = "som-contact-lead-submitted";

type ContactFormProps = {
  idPrefix?: string;
  className?: string;
  onSubmitted?: () => void;
};

export function ContactForm({
  idPrefix = "contact",
  className,
  onSubmitted,
}: ContactFormProps) {
  const { t, i18n } = useTranslation();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [niche, setNiche] = useState<ContactLeadNiche | "">("");
  const [intent, setIntent] = useState<ContactLeadIntent | "">("");
  const [submitting, setSubmitting] = useState(false);

  const nicheLabel = (value: ContactLeadNiche) => {
    if (value === "agency") return t("landing.contactNicheAgency");
    if (value === "social_media") return t("landing.contactNicheSocialMedia");
    return t("landing.contactNicheBrandOwner");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!niche) {
      toast.error(t("landing.contactNicheRequired"));
      return;
    }
    if (!intent) {
      toast.error(t("landing.contactIntentRequired"));
      return;
    }
    const { local } = splitWhatsAppDigits(whatsapp);
    if (!isValidWhatsAppLocal(local)) return;

    const trimmedName = name.trim();
    const trimmedEmail = email.trim();
    const fullWhatsapp = whatsapp.replace(/\D/g, "");
    const bodyKey =
      intent === "trial"
        ? "landing.contactWhatsAppBodyTrial"
        : "landing.contactWhatsAppBodyHuman";
    const body = t(bodyKey, {
      name: trimmedName,
      email: trimmedEmail,
      whatsapp: fullWhatsapp,
      niche: nicheLabel(niche),
    });
    const url = buildWhatsAppNotifyUrl(CONTACT_WHATSAPP, body);
    if (!url) return;

    setSubmitting(true);
    try {
      await submitContactLead({
        name: trimmedName,
        email: trimmedEmail,
        whatsapp: fullWhatsapp,
        intent,
        niche,
        locale: i18n.language,
      });
    } catch {
      toast.error(t("landing.contactLeadSaveFailed"));
    } finally {
      setSubmitting(false);
    }

    try {
      sessionStorage.setItem(CONTACT_LEAD_SESSION_KEY, "1");
    } catch {
      /* ignore */
    }
    onSubmitted?.();
    window.open(url, "_blank", "noopener,noreferrer");
  };

  return (
    <form onSubmit={handleSubmit} className={cn("mx-auto max-w-lg space-y-4", className)}>
      <div className="space-y-1.5">
        <Label htmlFor={`${idPrefix}-name`}>{t("landing.contactName")}</Label>
        <Input
          id={`${idPrefix}-name`}
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          className="bg-white/80"
          autoComplete="name"
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor={`${idPrefix}-email`}>{t("landing.contactEmail")}</Label>
        <Input
          id={`${idPrefix}-email`}
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          className="bg-white/80"
          autoComplete="email"
        />
      </div>
      <WhatsAppPhoneField
        idPrefix={idPrefix}
        value={whatsapp}
        onChange={setWhatsapp}
        label={t("landing.contactWhatsapp")}
        countryLabel={t("landing.contactCountry")}
        hint={t("landing.contactWhatsappHint")}
        required
        inputClassName="bg-white/80"
      />
      <fieldset className="space-y-3">
        <legend className="text-sm font-medium leading-none">
          {t("landing.contactNicheLabel")}
        </legend>
        <RadioGroup
          value={niche}
          onValueChange={(value) => setNiche(value as ContactLeadNiche)}
          className="gap-3"
          required
        >
          {(
            [
              { value: "agency" as const, labelKey: "landing.contactNicheAgency" },
              { value: "social_media" as const, labelKey: "landing.contactNicheSocialMedia" },
              { value: "brand_owner" as const, labelKey: "landing.contactNicheBrandOwner" },
            ] as const
          ).map((option) => (
            <label
              key={option.value}
              htmlFor={`${idPrefix}-niche-${option.value}`}
              className={cn(
                "flex cursor-pointer items-start gap-3 rounded-md border border-neutral-900/10 bg-white/80 px-3 py-3 text-sm transition-colors",
                niche === option.value && "border-neutral-900/40 bg-white",
              )}
            >
              <RadioGroupItem
                id={`${idPrefix}-niche-${option.value}`}
                value={option.value}
                className="mt-0.5"
              />
              <span>{t(option.labelKey)}</span>
            </label>
          ))}
        </RadioGroup>
      </fieldset>
      <fieldset className="space-y-3">
        <legend className="text-sm font-medium leading-none">
          {t("landing.contactIntentLabel")}
        </legend>
        <RadioGroup
          value={intent}
          onValueChange={(value) => setIntent(value as ContactLeadIntent)}
          className="gap-3"
          required
        >
          {(
            [
              { value: "trial" as const, labelKey: "landing.contactIntentTrial" },
              { value: "human" as const, labelKey: "landing.contactIntentHuman" },
            ] as const
          ).map((option) => (
            <label
              key={option.value}
              htmlFor={`${idPrefix}-intent-${option.value}`}
              className={cn(
                "flex cursor-pointer items-start gap-3 rounded-md border border-neutral-900/10 bg-white/80 px-3 py-3 text-sm transition-colors",
                intent === option.value && "border-neutral-900/40 bg-white",
              )}
            >
              <RadioGroupItem
                id={`${idPrefix}-intent-${option.value}`}
                value={option.value}
                className="mt-0.5"
              />
              <span>{t(option.labelKey)}</span>
            </label>
          ))}
        </RadioGroup>
      </fieldset>
      <Button type="submit" size="lg" className="w-full sm:w-auto" disabled={submitting}>
        {t("landing.contactSubmit")}
      </Button>
    </form>
  );
}
