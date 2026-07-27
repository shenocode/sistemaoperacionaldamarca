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

  async function commit() {
    const next = draft.trimEnd();
    if (next === lastCommitted.current) return;
    setTranslating(true);
    try {
      let block: LocalizedField;
      try {
        block = await translateTextField({ text: next });
      } catch {
        block = buildLocalizedFieldFromSource(next, locale);
      }
      const merged = setLocalizedField(props.i18n, props.field, block);
      const display = getLocalizedText(merged, props.field, next, locale);
      const canonical = block.values[block.source] ?? next;
      lastCommitted.current = display;
      setDraft(display);
      await props.onI18nCommit({
        field: props.field,
        display,
        canonical,
        block,
        i18n: merged,
      });
    } finally {
      setTranslating(false);
    }
  }

  return {
    draft,
    setDraft,
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
  const { draft, setDraft, commit, translating, translatingLabel } = useLocalizedDraft({
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
        onChange={(e) => setDraft(e.target.value)}
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
  const { draft, setDraft, commit, translating, translatingLabel } = useLocalizedDraft({
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
        onChange={(e) => setDraft(e.target.value)}
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
