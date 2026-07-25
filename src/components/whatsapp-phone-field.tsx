import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  WHATSAPP_COUNTRIES,
  composeWhatsAppDigits,
  defaultDialByLanguage,
  findWhatsAppCountry,
  splitWhatsAppDigits,
  type WhatsAppDial,
} from "@/lib/whatsapp-countries";
import { cn } from "@/lib/utils";

type WhatsAppPhoneFieldProps = {
  idPrefix: string;
  /** Full digits including country dial (e.g. 5511999999999). Empty string clears the field. */
  value: string;
  onChange: (fullDigits: string) => void;
  label: string;
  countryLabel: string;
  hint?: string;
  required?: boolean;
  className?: string;
  inputClassName?: string;
};

export function WhatsAppPhoneField({
  idPrefix,
  value,
  onChange,
  label,
  countryLabel,
  hint,
  required,
  className,
  inputClassName,
}: WhatsAppPhoneFieldProps) {
  const { i18n } = useTranslation();
  const initial = value.trim() ? splitWhatsAppDigits(value) : null;
  const [countryDial, setCountryDial] = useState<WhatsAppDial>(
    () => initial?.dial ?? defaultDialByLanguage(i18n.language),
  );
  const [localNumber, setLocalNumber] = useState(() => initial?.local ?? "");

  useEffect(() => {
    if (value.trim()) return;
    setLocalNumber("");
    setCountryDial(defaultDialByLanguage(i18n.language));
  }, [value, i18n.language]);

  const selectedCountry = findWhatsAppCountry(countryDial);

  function emit(dial: WhatsAppDial, local: string) {
    const digits = local.replace(/\D/g, "");
    onChange(digits ? composeWhatsAppDigits(dial, digits) : "");
  }

  return (
    <div className={cn("space-y-1.5", className)}>
      <Label htmlFor={`${idPrefix}-whatsapp`}>{label}</Label>
      <div className="flex gap-2">
        <Select
          value={countryDial}
          onValueChange={(next) => {
            const dial = next as WhatsAppDial;
            setCountryDial(dial);
            emit(dial, localNumber);
          }}
        >
          <SelectTrigger
            aria-label={countryLabel}
            className={cn("w-[7.5rem] shrink-0", inputClassName)}
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {WHATSAPP_COUNTRIES.map((country) => (
              <SelectItem key={country.iso} value={country.dial}>
                {country.iso} +{country.dial}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Input
          id={`${idPrefix}-whatsapp`}
          type="tel"
          inputMode="numeric"
          value={localNumber}
          onChange={(e) => {
            const next = e.target.value;
            setLocalNumber(next);
            emit(countryDial, next);
          }}
          required={required}
          className={cn("min-w-0 flex-1", inputClassName)}
          placeholder={selectedCountry.placeholder}
          autoComplete="tel-national"
        />
      </div>
      {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}
