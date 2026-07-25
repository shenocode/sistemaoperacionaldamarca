export const WHATSAPP_COUNTRIES = [
  { iso: "BR", dial: "55", placeholder: "11999999999" },
  { iso: "US", dial: "1", placeholder: "2015550123" },
  { iso: "PT", dial: "351", placeholder: "912345678" },
  { iso: "ES", dial: "34", placeholder: "612345678" },
  { iso: "AR", dial: "54", placeholder: "91123456789" },
  { iso: "MX", dial: "52", placeholder: "5512345678" },
  { iso: "CO", dial: "57", placeholder: "3001234567" },
  { iso: "CL", dial: "56", placeholder: "912345678" },
  { iso: "PY", dial: "595", placeholder: "981123456" },
  { iso: "UY", dial: "598", placeholder: "99123456" },
] as const;

export type WhatsAppDial = (typeof WHATSAPP_COUNTRIES)[number]["dial"];

export function defaultDialByLanguage(language: string): WhatsAppDial {
  if (language.startsWith("pt")) return "55";
  if (language.startsWith("es")) return "34";
  return "1";
}

export function findWhatsAppCountry(dial: string) {
  return WHATSAPP_COUNTRIES.find((c) => c.dial === dial) ?? WHATSAPP_COUNTRIES[0];
}

/** Split a full E.164-ish digit string into dial + local number when possible. */
export function splitWhatsAppDigits(fullDigits: string): {
  dial: WhatsAppDial;
  local: string;
} {
  const digits = fullDigits.replace(/\D/g, "");
  const sorted = [...WHATSAPP_COUNTRIES].sort((a, b) => b.dial.length - a.dial.length);
  for (const country of sorted) {
    if (digits.startsWith(country.dial) && digits.length > country.dial.length) {
      return { dial: country.dial, local: digits.slice(country.dial.length) };
    }
  }
  return { dial: "55", local: digits };
}

export function composeWhatsAppDigits(dial: string, local: string): string {
  return `${dial}${local.replace(/\D/g, "")}`;
}

export function isValidWhatsAppLocal(local: string): boolean {
  return local.replace(/\D/g, "").length >= 6;
}
