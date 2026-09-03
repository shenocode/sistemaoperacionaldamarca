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

const resources = {
  "pt-BR": { translation: ptBR },
  "en-US": { translation: enUS },
  "es-ES": { translation: esES },
} as const;

if (!i18n.isInitialized) {
  i18n.use(LanguageDetector).use(initReactI18next).init({
    resources,
    fallbackLng: "pt-BR",
    supportedLngs: SUPPORTED_LANGUAGES.map((l) => l.code),
    nonExplicitSupportedLngs: true,
    initAsync: false,
    interpolation: { escapeValue: false },
    react: { useSuspense: false },
    detection: {
      order: ["localStorage", "navigator"],
      lookupLocalStorage: "som.lang",
      caches: ["localStorage"],
    },
  });
}

for (const [lng, bundle] of Object.entries(resources)) {
  i18n.addResourceBundle(lng, "translation", bundle.translation, true, true);
}

export default i18n;
