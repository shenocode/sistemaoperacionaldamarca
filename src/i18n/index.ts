import i18n from "i18next";
import LanguageDetector from "i18next-browser-languagedetector";
import { initReactI18next } from "react-i18next";

import ptBR from "./locales/pt-BR.json";
import enUS from "./locales/en-US.json";
import esES from "./locales/es-ES.json";

export const SUPPORTED_LANGUAGES = [
  { code: "pt-BR", label: "Português (BR)" },
  { code: "en-US", label: "English (US)" },
  { code: "es-ES", label: "Español (ES)" },
] as const;

export type LanguageCode = (typeof SUPPORTED_LANGUAGES)[number]["code"];

const LANGUAGE_CODES: LanguageCode[] = SUPPORTED_LANGUAGES.map((l) => l.code);
const isBrowser = typeof window !== "undefined";

const resources = {
  "pt-BR": { translation: ptBR },
  "en-US": { translation: enUS },
  "es-ES": { translation: esES },
} as const;

export function normalizeLanguage(lng: string | undefined | null): LanguageCode {
  if (!lng) return "pt-BR";
  const exact = LANGUAGE_CODES.find((code) => code === lng);
  if (exact) return exact;
  const lower = lng.toLowerCase();
  if (lower.startsWith("en")) return "en-US";
  if (lower.startsWith("es")) return "es-ES";
  if (lower.startsWith("pt")) return "pt-BR";
  return "pt-BR";
}

export function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string");
}

if (!i18n.isInitialized) {
  if (isBrowser) {
    i18n.use(LanguageDetector);
  }
  i18n.use(initReactI18next).init({
    resources,
    lng: isBrowser ? undefined : "pt-BR",
    fallbackLng: "pt-BR",
    supportedLngs: LANGUAGE_CODES,
    nonExplicitSupportedLngs: false,
    load: "currentOnly",
    initAsync: false,
    interpolation: { escapeValue: false },
    react: { useSuspense: false },
    detection: {
      order: ["localStorage", "navigator"],
      lookupLocalStorage: "som.lang",
      caches: ["localStorage"],
      convertDetectedLanguage: (lng) => normalizeLanguage(lng),
    },
  });
}

for (const [lng, bundle] of Object.entries(resources)) {
  i18n.addResourceBundle(lng, "translation", bundle.translation, true, true);
}

if (!LANGUAGE_CODES.includes((i18n.resolvedLanguage ?? i18n.language) as LanguageCode)) {
  void i18n.changeLanguage("pt-BR");
}

export default i18n;
