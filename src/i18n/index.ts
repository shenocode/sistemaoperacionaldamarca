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

if (!i18n.isInitialized) {
  i18n
    .use(LanguageDetector)
    .use(initReactI18next)
    .init({
      resources: {
        "pt-BR": { translation: ptBR },
        "en-US": { translation: enUS },
        "es-ES": { translation: esES },
      },
      fallbackLng: "pt-BR",
      supportedLngs: SUPPORTED_LANGUAGES.map((l) => l.code),
      interpolation: { escapeValue: false },
      detection: {
        order: ["localStorage", "navigator"],
        lookupLocalStorage: "som.lang",
        caches: ["localStorage"],
      },
    });
}

export default i18n;
