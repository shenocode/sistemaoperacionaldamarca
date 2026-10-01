import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import {
  buildLocalizedFieldFromSource,
  getLocalizedText,
  normalizeAppLocale,
  setLocalizedField,
  translateTextField,
  type LocalizedField,
  type RowI18n,
} from "@/lib/i18n-content";

type CommitPayload = {
  field: string;
  display: string;
  canonical: string;
  block: LocalizedField;
  i18n: RowI18n;
};

type SharedProps = {
  field: string;
  i18n: RowI18n;
  fallback?: string | null;
  disabled?: boolean;
  className?: string;
  id?: string;
  placeholder?: string;
  onI18nCommit: (payload: CommitPayload) => void | Promise<void>;
};

function useLocalizedDraft(props: SharedProps) {
  const { i18n: i18next, t } = useTranslation();
  const locale = normalizeAppLocale(i18next.resolvedLanguage ?? i18next.language);
  const displayFromStore = getLocalizedText(props.i18n, props.field, props.fallback ?? "", locale);
  const [draft, setDraft] = useState(displayFromStore);
  const [translating, setTranslating] = useState(false);
  const lastCommitted = useRef(displayFromStore);
  const localeRef = useRef(locale);
  const i18nRef = useRef(props.i18n);
  const onCommitRef = useRef(props.onI18nCommit);
  const commitSeq = useRef(0);

  i18nRef.current = props.i18n;
  onCommitRef.current = props.onI18nCommit;

  useEffect(() => {
    if (localeRef.current !== locale) {
      localeRef.current = locale;
      const next = getLocalizedText(props.i18n, props.field, props.fallback ?? "", locale);
      setDraft(next);
      lastCommitted.current = next;
      return;
    }
    // External store update (e.g. AI apply) when not dirty
    if (draft === lastCommitted.current && displayFromStore !== draft) {
      setDraft(displayFromStore);
      lastCommitted.current = displayFromStore;
    }
  }, [locale, displayFromStore, props.i18n, props.field, props.fallback, draft]);

  function pushToParent(next: string, block: LocalizedField) {
    const merged = setLocalizedField(i18nRef.current, props.field, block);
    i18nRef.current = merged;
    // Always show what the user typed for the active UI locale — never let a
    // mis-detected translation rewrite the visible field after blur/save.
    const display = next;
    const canonical = block.values[block.source] ?? next;
    void onCommitRef.current({
      field: props.field,
      display,
      canonical,
      block,
      i18n: merged,
    });
    return { display, canonical, merged };
  }

  /** Keep parent form state in sync while typing (save/dirty must not wait for blur). */
  function syncDraft(next: string) {
    setDraft(next);
    const block = buildLocalizedFieldFromSource(next, locale);
    pushToParent(next, block);
  }

  async function commit() {
    const next = draft.trimEnd();
    if (next === lastCommitted.current) {
      if (next !== draft) setDraft(next);
      return;
    }

    const seq = ++commitSeq.current;

    // Push provisional value synchronously before any await so submit-after-blur
    // (or click Save while focused) never races past an in-flight translation.
    const provisional = buildLocalizedFieldFromSource(next, locale);
    const pushed = pushToParent(next, provisional);
    lastCommitted.current = pushed.display;
    setDraft(pushed.display);

    setTranslating(true);
    try {
      let block: LocalizedField;
      try {
        block = await translateTextField({ text: next, sourceLocale: locale });
      } catch {
        block = provisional;
      }
      if (seq !== commitSeq.current) return;
      // Pin typed text under the UI locale even if the translator rewrote it.
      block = {
        ...block,
        source: locale,
        values: { ...block.values, [locale]: next },
      };
      const merged = setLocalizedField(i18nRef.current, props.field, block);
      i18nRef.current = merged;
      const display = next;
      const canonical = block.values[block.source] ?? next;
      lastCommitted.current = display;
      setDraft(display);
      await onCommitRef.current({
        field: props.field,
        display,
        canonical,
        block,
        i18n: merged,
      });
    } finally {
      if (seq === commitSeq.current) setTranslating(false);
    }
  }

  return {
    draft,
    syncDraft,
    commit,
    translating,
    translatingLabel: t("common.translating"),
  };
}

export function LocalizedTextInput({
  field,
  i18n,
  fallback,
  disabled,
  className,
  id,
  placeholder,
  onI18nCommit,
}: SharedProps) {
  const { draft, syncDraft, commit, translating, translatingLabel } = useLocalizedDraft({
    field,
    i18n,
    fallback,
    disabled,
    className,
    id,
    placeholder,
    onI18nCommit,
  });

  return (
    <div className="relative">
      <Input
        id={id}
        className={className}
        value={draft}
        disabled={disabled || translating}
        placeholder={placeholder}
        onChange={(e) => syncDraft(e.target.value)}
        onBlur={() => void commit()}
      />
      {translating ? (
        <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground">
          {translatingLabel}
        </span>
      ) : null}
    </div>
  );
}

export function LocalizedTextarea({
  field,
  i18n,
  fallback,
  disabled,
  className,
  id,
  placeholder,
  rows,
  autoResize,
  onI18nCommit,
}: SharedProps & { rows?: number; autoResize?: boolean }) {
  const { draft, syncDraft, commit, translating, translatingLabel } = useLocalizedDraft({
    field,
    i18n,
    fallback,
    disabled,
    className,
    id,
    placeholder,
    onI18nCommit,
  });
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (!autoResize) return;
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [autoResize, draft]);

  return (
    <div className="relative">
      <Textarea
        ref={textareaRef}
        id={id}
        rows={rows}
        className={cn(autoResize && "resize-none overflow-hidden", className)}
        value={draft}
        disabled={disabled || translating}
        placeholder={placeholder}
        onChange={(e) => syncDraft(e.target.value)}
        onBlur={() => void commit()}
      />
      {translating ? (
        <span className="pointer-events-none absolute bottom-2 right-2 text-[10px] text-muted-foreground">
          {translatingLabel}
        </span>
      ) : null}
    </div>
  );
}
