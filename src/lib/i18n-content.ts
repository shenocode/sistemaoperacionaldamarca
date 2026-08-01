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

/** True when the field has no block, or is missing a value for `locale` (or any app locale). */
export function localizedFieldNeedsTranslation(
  block: LocalizedField | null | undefined,
  locale?: AppLocale,
): boolean {
  if (!block) return true;
  const locales = locale ? [locale] : [...APP_LOCALES];
  return locales.some((loc) => {
    const value = block.values[loc];
    return typeof value !== "string" || value.length === 0;
  });
}

/**
 * Ensures each field has translations for all app locales.
 * Reuses existing blocks that are already complete; otherwise calls AI translate.
 * If `fields` provides text that differs from the stored source, retranslates.
 */
export async function ensureFieldsTranslated(
  i18n: RowI18n | null | undefined,
  fields: Record<string, string | null | undefined>,
): Promise<RowI18n> {
  const base = parseRowI18n(i18n);
  const results = await Promise.all(
    Object.entries(fields).map(async ([field, rawText]) => {
      const existing = getLocalizedField(base, field);
      const raw = (rawText ?? "").trim();
      const existingSource = (existing?.values[existing.source] ?? "").trim();
      const textChanged = raw.length > 0 && raw !== existingSource;
      const sourceText = textChanged ? raw : existingSource || raw;
      if (!sourceText) {
        return [
          field,
          existing ?? buildLocalizedFieldFromSource("", "pt-BR"),
        ] as const;
      }
      if (!textChanged && !localizedFieldNeedsTranslation(existing)) {
        return [field, existing!] as const;
      }
      try {
        const block = await translateTextField({
          text: sourceText,
          sourceLocale: textChanged ? undefined : existing?.source,
        });
        return [field, block] as const;
      } catch {
        return [
          field,
          buildLocalizedFieldFromSource(sourceText, existing?.source ?? "pt-BR"),
        ] as const;
      }
    }),
  );

  let next = base;
  for (const [field, block] of results) {
    next = setLocalizedField(next, field, block);
  }
  return next;
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

/** True when any non-empty field is missing a value for `locale`. */
export function fieldsNeedLocaleBackfill(
  i18n: RowI18n | null | undefined | unknown,
  fields: Record<string, string | null | undefined>,
  locale: string,
): boolean {
  const loc = normalizeAppLocale(locale);
  const row = parseRowI18n(i18n);
  return Object.entries(fields).some(([field, raw]) => {
    const text = (raw ?? "").trim();
    if (!text) return false;
    return localizedFieldNeedsTranslation(getLocalizedField(row, field), loc);
  });
}

/**
 * Returns true when `next` filled at least one previously missing locale value
 * for the given fields (used to avoid rewrite loops when AI is unavailable).
 */
export function i18nBackfillImproved(
  before: RowI18n | null | undefined | unknown,
  after: RowI18n | null | undefined | unknown,
  fields: Record<string, string | null | undefined>,
  locale: string,
): boolean {
  const loc = normalizeAppLocale(locale);
  const prev = parseRowI18n(before);
  const next = parseRowI18n(after);
  return Object.entries(fields).some(([field, raw]) => {
    const text = (raw ?? "").trim();
    if (!text) return false;
    const needed = localizedFieldNeedsTranslation(getLocalizedField(prev, field), loc);
    if (!needed) return false;
    return !localizedFieldNeedsTranslation(getLocalizedField(next, field), loc);
  });
}

/** Ensures briefing answers have translations for all app locales. */
export async function ensureAnswersTranslated(
  i18n: RowI18n | null | undefined,
  answers: Record<string, string | null | undefined>,
): Promise<RowI18n> {
  const base = parseRowI18n(i18n);
  const existingAnswers =
    base.answers && typeof base.answers === "object" && !Array.isArray(base.answers)
      ? (base.answers as Record<string, unknown>)
      : {};

  const entries = Object.entries(answers).filter(([, v]) => (v ?? "").trim().length > 0);
  const results = await Promise.all(
    entries.map(async ([questionId, rawText]) => {
      const existing = isLocalizedField(existingAnswers[questionId])
        ? (existingAnswers[questionId] as LocalizedField)
        : null;
      const raw = (rawText ?? "").trim();
      const existingSource = (existing?.values[existing.source] ?? "").trim();
      const textChanged = raw.length > 0 && raw !== existingSource;
      const sourceText = textChanged ? raw : existingSource || raw;
      if (!sourceText) {
        return [questionId, existing ?? buildLocalizedFieldFromSource("", "pt-BR")] as const;
      }
      if (!textChanged && !localizedFieldNeedsTranslation(existing)) {
        return [questionId, existing!] as const;
      }
      try {
        const block = await translateTextField({
          text: sourceText,
          sourceLocale: textChanged ? undefined : existing?.source,
        });
        return [questionId, block] as const;
      } catch {
        return [
          questionId,
          buildLocalizedFieldFromSource(sourceText, existing?.source ?? "pt-BR"),
        ] as const;
      }
    }),
  );

  let next = base;
  for (const [questionId, block] of results) {
    next = setLocalizedAnswer(next, questionId, block);
  }
  return next;
}

export function answersNeedLocaleBackfill(
  i18n: RowI18n | null | undefined | unknown,
  answers: Record<string, string | null | undefined>,
  locale: string,
): boolean {
  const loc = normalizeAppLocale(locale);
  const answersI18n = parseRowI18n(i18n).answers;
  const blocks =
    answersI18n && typeof answersI18n === "object" && !Array.isArray(answersI18n)
      ? (answersI18n as Record<string, unknown>)
      : {};
  return Object.entries(answers).some(([questionId, raw]) => {
    const text = (raw ?? "").trim();
    if (!text) return false;
    const block = isLocalizedField(blocks[questionId])
      ? (blocks[questionId] as LocalizedField)
      : null;
    return localizedFieldNeedsTranslation(block, loc);
  });
}

/** Ensures a preset string list has LocalizedField translations for all locales. */
export async function ensurePresetListTranslated(
  i18n: RowI18n | null | undefined,
  field: string,
  items: string[],
): Promise<{ i18n: RowI18n; blocks: LocalizedField[] }> {
  const base = parseRowI18n(i18n);
  const raw = base[field];
  const existing = Array.isArray(raw) ? raw : [];
  const blocks = await Promise.all(
    items.map(async (text, index) => {
      const trimmed = text.trim();
      const prev = isLocalizedField(existing[index]) ? (existing[index] as LocalizedField) : null;
      if (!trimmed) {
        return prev ?? buildLocalizedFieldFromSource("", "pt-BR");
      }
      const existingSource = (prev?.values[prev.source] ?? "").trim();
      const textChanged = trimmed !== existingSource;
      if (!textChanged && !localizedFieldNeedsTranslation(prev)) {
        return prev!;
      }
      try {
        return await translateTextField({
          text: trimmed,
          sourceLocale: textChanged ? undefined : prev?.source,
        });
      } catch {
        return buildLocalizedFieldFromSource(trimmed, prev?.source ?? "pt-BR");
      }
    }),
  );
  return { i18n: setLocalizedPresetList(base, field, blocks), blocks };
}

export function presetListNeedsLocaleBackfill(
  i18n: RowI18n | null | undefined | unknown,
  field: string,
  items: string[],
  locale: string,
): boolean {
  const loc = normalizeAppLocale(locale);
  const raw = parseRowI18n(i18n)[field];
  const existing = Array.isArray(raw) ? raw : [];
  return items.some((text, index) => {
    if (!text.trim()) return false;
    const block = isLocalizedField(existing[index]) ? (existing[index] as LocalizedField) : null;
    return localizedFieldNeedsTranslation(block, loc);
  });
}
