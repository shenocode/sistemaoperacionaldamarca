import { supabase } from "@/integrations/supabase/client";

export const APP_LOCALES = ["pt-BR", "en-US", "es-ES"] as const;
export type AppLocale = (typeof APP_LOCALES)[number];

export type LocalizedField = {
  source: AppLocale;
  values: Partial<Record<AppLocale, string>>;
};

/** Per-row i18n map: field name → LocalizedField (or nested maps for answers / preset arrays). */
export type RowI18n = Record<string, unknown>;

export function isAppLocale(value: string | null | undefined): value is AppLocale {
  return !!value && (APP_LOCALES as readonly string[]).includes(value);
}

export function normalizeAppLocale(locale: string | null | undefined): AppLocale {
  if (isAppLocale(locale)) return locale;
  if (!locale) return "pt-BR";
  const lower = locale.toLowerCase();
  if (lower.startsWith("en")) return "en-US";
  if (lower.startsWith("es")) return "es-ES";
  if (lower.startsWith("pt")) return "pt-BR";
  return "pt-BR";
}

export function isLocalizedField(value: unknown): value is LocalizedField {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const obj = value as Record<string, unknown>;
  return isAppLocale(typeof obj.source === "string" ? obj.source : null) && typeof obj.values === "object";
}

export function parseRowI18n(raw: unknown): RowI18n {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  return raw as RowI18n;
}

export function getLocalizedField(i18n: RowI18n | null | undefined | unknown, field: string): LocalizedField | null {
  const row = parseRowI18n(i18n);
  const value = row[field];
  return isLocalizedField(value) ? value : null;
}

export function getLocalizedText(
  i18n: RowI18n | null | undefined | unknown,
  field: string,
  fallback: string | null | undefined,
  locale: string,
): string {
  const loc = normalizeAppLocale(locale);
  const block = getLocalizedField(i18n, field);
  if (!block) return fallback ?? "";
  const direct = block.values[loc];
  if (typeof direct === "string" && direct.length > 0) return direct;
  const sourceVal = block.values[block.source];
  if (typeof sourceVal === "string" && sourceVal.length > 0) return sourceVal;
  const pt = block.values["pt-BR"];
  if (typeof pt === "string" && pt.length > 0) return pt;
  return fallback ?? "";
}

export function setLocalizedField(i18n: RowI18n | null | undefined, field: string, block: LocalizedField): RowI18n {
  return { ...parseRowI18n(i18n), [field]: block };
}

export function mergeRowI18n(base: RowI18n | null | undefined, patch: RowI18n): RowI18n {
  return { ...parseRowI18n(base), ...patch };
}

export function buildLocalizedFieldFromSource(
  text: string,
  sourceLocale: string,
  extraValues?: Partial<Record<AppLocale, string>>,
): LocalizedField {
  const source = normalizeAppLocale(sourceLocale);
  return {
    source,
    values: {
      [source]: text,
      ...extraValues,
    },
  };
}

export async function translateTextField(input: {
  text: string;
  sourceLocale?: AppLocale;
  targetLocales?: AppLocale[];
}): Promise<LocalizedField> {
  const text = input.text.trim();
  if (!text) {
    const source = input.sourceLocale ?? "pt-BR";
    return { source, values: { [source]: "" } };
  }

  const { data, error } = await supabase.functions.invoke("translate-text", {
    body: {
      text,
      sourceLocale: input.sourceLocale,
      targetLocales: input.targetLocales ?? [...APP_LOCALES],
    },
  });

  if (error) {
    throw new Error(error.message || "Falha ao traduzir");
  }

  const payload = data as LocalizedField & { error?: string };
  if (payload?.error) {
    throw new Error(payload.error);
  }
  if (!isLocalizedField(payload)) {
    // Offline / AI failure fallback: keep typed text as source only
    const source = input.sourceLocale ?? "pt-BR";
    return { source, values: { [source]: text } };
  }
  payload.values[payload.source] = text;
  return payload;
}

export function getCanonicalText(
  i18n: RowI18n | null | undefined | unknown,
  field: string,
  fallback: string | null | undefined,
): string {
  const block = getLocalizedField(i18n, field);
  if (!block) return fallback ?? "";
  const sourceVal = block.values[block.source];
  if (typeof sourceVal === "string") return sourceVal;
  return fallback ?? "";
}

export async function translateManyFields(
  fields: Record<string, string>,
): Promise<RowI18n> {
  const entries = Object.entries(fields).filter(([, v]) => v.trim().length > 0);
  const result: RowI18n = {};
  await Promise.all(
    entries.map(async ([key, text]) => {
      try {
        result[key] = await translateTextField({ text });
      } catch {
        result[key] = buildLocalizedFieldFromSource(text, "pt-BR");
      }
    }),
  );
  for (const [key, text] of Object.entries(fields)) {
    if (!result[key]) {
      result[key] = buildLocalizedFieldFromSource(text, "pt-BR");
    }
  }
  return result;
}

/** answers map: questionId → LocalizedField */
export function getLocalizedAnswer(
  i18n: RowI18n | null | undefined | unknown,
  questionId: string,
  fallback: string,
  locale: string,
): string {
  const answers = parseRowI18n(i18n).answers;
  if (!answers || typeof answers !== "object" || Array.isArray(answers)) return fallback;
  const block = (answers as Record<string, unknown>)[questionId];
  if (!isLocalizedField(block)) return fallback;
  return getLocalizedText({ [questionId]: block }, questionId, fallback, locale);
}

export function setLocalizedAnswer(
  i18n: RowI18n | null | undefined,
  questionId: string,
  block: LocalizedField,
): RowI18n {
  const current = parseRowI18n(i18n);
  const answers =
    current.answers && typeof current.answers === "object" && !Array.isArray(current.answers)
      ? { ...(current.answers as Record<string, unknown>) }
      : {};
  answers[questionId] = block;
  return { ...current, answers };
}

/** Preset arrays stored as LocalizedField[] under i18n.cta_presets etc. */
export function getLocalizedPresetList(
  i18n: RowI18n | null | undefined | unknown,
  field: string,
  fallback: string[],
  locale: string,
): string[] {
  const raw = parseRowI18n(i18n)[field];
  if (!Array.isArray(raw) || raw.length === 0) return fallback;
  return raw.map((item, index) => {
    if (isLocalizedField(item)) {
      return getLocalizedText({ x: item }, "x", fallback[index] ?? "", locale);
    }
    return typeof item === "string" ? item : fallback[index] ?? "";
  });
}

export function setLocalizedPresetList(
  i18n: RowI18n | null | undefined,
  field: string,
  items: LocalizedField[],
): RowI18n {
  return { ...parseRowI18n(i18n), [field]: items };
}
