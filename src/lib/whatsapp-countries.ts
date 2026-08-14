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

/** Brazilian area codes (DDD). Used to detect national numbers stored without +55. */
const BR_DDDS = new Set([
  11, 12, 13, 14, 15, 16, 17, 18, 19, 21, 22, 24, 27, 28, 31, 32, 33, 34, 35, 37, 38, 41, 42, 43,
  44, 45, 46, 47, 48, 49, 51, 52, 53, 54, 55, 61, 62, 63, 64, 65, 66, 67, 68, 69, 71, 73, 74, 75,
  77, 79, 81, 82, 83, 84, 85, 86, 87, 88, 89, 91, 92, 93, 94, 95, 96, 97, 98, 99,
]);

export function defaultDialByLanguage(language: string): WhatsAppDial {
  if (language.startsWith("pt")) return "55";
  if (language.startsWith("es")) return "34";
  return "1";
}

export function findWhatsAppCountry(dial: string) {
  return WHATSAPP_COUNTRIES.find((c) => c.dial === dial) ?? WHATSAPP_COUNTRIES[0];
}

/** 10-digit landline or 11-digit mobile with a valid DDD, without country code. */
export function looksLikeBrazilNational(digits: string): boolean {
  if (digits.length !== 10 && digits.length !== 11) return false;
  const ddd = Number(digits.slice(0, 2));
  if (!BR_DDDS.has(ddd)) return false;
  if (digits.length === 11) return digits[2] === "9";
  return digits[2] !== "9";
}

/** Split a full E.164-ish digit string into dial + local number when possible. */
export function splitWhatsAppDigits(fullDigits: string): {
  dial: WhatsAppDial;
  local: string;
} {
  const digits = fullDigits.replace(/\D/g, "");
  const sorted = [...WHATSAPP_COUNTRIES].sort((a, b) => b.dial.length - a.dial.length);
  for (const country of sorted) {
    if (!digits.startsWith(country.dial) || digits.length <= country.dial.length) continue;
    // `1…` also matches US +1; prefer BR when the whole string is a national number.
    if (country.dial === "1" && looksLikeBrazilNational(digits)) continue;
    return { dial: country.dial, local: digits.slice(country.dial.length) };
  }
  if (looksLikeBrazilNational(digits)) {
    return { dial: "55", local: digits };
  }
  return { dial: "55", local: digits };
}

export function composeWhatsAppDigits(dial: string, local: string): string {
  return `${dial}${local.replace(/\D/g, "")}`;
}

export function isValidWhatsAppLocal(local: string): boolean {
  return local.replace(/\D/g, "").length >= 6;
}
