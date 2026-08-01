import { useEffect, useRef } from "react";
import {
  ensureFieldsTranslated,
  fieldsNeedLocaleBackfill,
  i18nBackfillImproved,
  normalizeAppLocale,
  parseRowI18n,
  type AppLocale,
  type RowI18n,
} from "@/lib/i18n-content";

type UseI18nBackfillOptions = {
  /** Skip when false (e.g. still loading / no write access). */
  enabled?: boolean;
  /** Stable key for this entity+locale snapshot — used to avoid repeat attempts. */
  entityKey: string;
  locale: string;
  i18n: unknown;
  fields: Record<string, string | null | undefined>;
  /** Persist translated i18n (and optionally canonical columns). */
  onPersist: (nextI18n: RowI18n) => Promise<void>;
  /** Optional local UI update after a successful persist. */
  onApplied?: (nextI18n: RowI18n) => void;
};

/**
 * When the UI locale is missing translations for the given fields, calls AI
 * translate and persists the result. Mirrors the project name/description
 * backfill pattern used in the project layout route.
 */
export function useI18nBackfill({
  enabled = true,
  entityKey,
  locale,
  i18n,
  fields,
  onPersist,
  onApplied,
}: UseI18nBackfillOptions) {
  const attemptedKeyRef = useRef<string | null>(null);
  const onPersistRef = useRef(onPersist);
  const onAppliedRef = useRef(onApplied);
  onPersistRef.current = onPersist;
  onAppliedRef.current = onApplied;

  useEffect(() => {
    if (!enabled) return;
    const loc = normalizeAppLocale(locale);
    if (!fieldsNeedLocaleBackfill(i18n, fields, loc)) return;

    const key = `${entityKey}:${loc}`;
    if (attemptedKeyRef.current === key) return;
    attemptedKeyRef.current = key;

    let cancelled = false;
    void (async () => {
      try {
        const current = parseRowI18n(i18n);
        const nextI18n = await ensureFieldsTranslated(current, fields);
        if (cancelled) return;
        if (!i18nBackfillImproved(current, nextI18n, fields, loc)) return;
        await onPersistRef.current(nextI18n);
        if (cancelled) return;
        onAppliedRef.current?.(nextI18n);
      } catch {
        // Allow a later retry (e.g. AI key restored).
        attemptedKeyRef.current = null;
      }
    })();

    return () => {
      cancelled = true;
    };
    // fields object identity changes every render — depend on a stable serialization.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- entityKey + locale gate retries
  }, [enabled, entityKey, locale, i18n]);
}

/** Fire-and-forget backfill for a list of rows (content titles, comments, assets). */
export async function backfillRowsForLocale<T>(input: {
  rows: T[];
  locale: AppLocale | string;
  getKey: (row: T) => string;
  getI18n: (row: T) => unknown;
  getFields: (row: T) => Record<string, string | null | undefined>;
  persist: (row: T, nextI18n: RowI18n) => Promise<void>;
  concurrency?: number;
}): Promise<number> {
  const loc = normalizeAppLocale(input.locale);
  const pending = input.rows.filter((row) =>
    fieldsNeedLocaleBackfill(input.getI18n(row), input.getFields(row), loc),
  );
  if (pending.length === 0) return 0;

  const concurrency = Math.max(1, input.concurrency ?? 2);
  let improved = 0;
  let index = 0;

  async function worker() {
    while (index < pending.length) {
      const row = pending[index++];
      const current = parseRowI18n(input.getI18n(row));
      const fields = input.getFields(row);
      try {
        const nextI18n = await ensureFieldsTranslated(current, fields);
        if (!i18nBackfillImproved(current, nextI18n, fields, loc)) continue;
        await input.persist(row, nextI18n);
        improved += 1;
      } catch {
        // Skip row; others continue.
      }
    }
  }

  await Promise.all(Array.from({ length: Math.min(concurrency, pending.length) }, () => worker()));
  return improved;
}
