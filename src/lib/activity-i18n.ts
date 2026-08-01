import type { TFunction } from "i18next";
import { getLocalizedText, normalizeAppLocale } from "@/lib/i18n-content";

type ActivityLike = {
  type: string;
  summary: string;
  i18n?: unknown;
};

type Pattern = {
  re: RegExp;
  key: string;
  /** Named capture groups mapped to i18n interpolation. */
  vars?: (match: RegExpMatchArray) => Record<string, string>;
};

/** Canonical Portuguese (and a few EN) prefixes used when logging activity. */
const SUMMARY_PATTERNS: Pattern[] = [
  {
    re: /^Comentário em\s+(.+)$/i,
    key: "activity.comment_added",
    vars: (m) => ({ subject: m[1].trim() }),
  },
  {
    re: /^Comment on\s+(.+)$/i,
    key: "activity.comment_added",
    vars: (m) => ({ subject: m[1].trim() }),
  },
  {
    re: /^Aprovado:\s*(.+)$/i,
    key: "activity.approved",
    vars: (m) => ({ subject: m[1].trim() }),
  },
  {
    re: /^Approved:\s*(.+)$/i,
    key: "activity.approved",
    vars: (m) => ({ subject: m[1].trim() }),
  },
  {
    re: /^Mudanças solicitadas:\s*(.+)$/i,
    key: "activity.changes_requested",
    vars: (m) => ({ subject: m[1].trim() }),
  },
  {
    re: /^Changes requested:\s*(.+)$/i,
    key: "activity.changes_requested",
    vars: (m) => ({ subject: m[1].trim() }),
  },
  {
    re: /^Ajustes concluídos:\s*(.+)$/i,
    key: "activity.changes_done",
    vars: (m) => ({ subject: m[1].trim() }),
  },
  {
    re: /^Adjustments completed:\s*(.+)$/i,
    key: "activity.changes_done",
    vars: (m) => ({ subject: m[1].trim() }),
  },
  {
    re: /^Enviado para revisão:\s*(.+)$/i,
    key: "activity.submitted_for_review",
    vars: (m) => ({ subject: m[1].trim() }),
  },
  {
    re: /^Submitted for review:\s*(.+)$/i,
    key: "activity.submitted_for_review",
    vars: (m) => ({ subject: m[1].trim() }),
  },
  {
    re: /^Publicado:\s*(.+)$/i,
    key: "activity.published",
    vars: (m) => ({ subject: m[1].trim() }),
  },
  {
    re: /^Published:\s*(.+)$/i,
    key: "activity.published",
    vars: (m) => ({ subject: m[1].trim() }),
  },
  {
    re: /^Conteúdo criado:\s*(.+)$/i,
    key: "activity.content_created",
    vars: (m) => ({ subject: m[1].trim() }),
  },
  {
    re: /^Content created:\s*(.+)$/i,
    key: "activity.content_created",
    vars: (m) => ({ subject: m[1].trim() }),
  },
  {
    re: /^Conteúdo duplicado:\s*(.+)$/i,
    key: "activity.content_duplicated",
    vars: (m) => ({ subject: m[1].trim() }),
  },
  {
    re: /^Content duplicated:\s*(.+)$/i,
    key: "activity.content_duplicated",
    vars: (m) => ({ subject: m[1].trim() }),
  },
  {
    re: /^Cliente criado:\s*(.+)$/i,
    key: "activity.client_created",
    vars: (m) => ({ subject: m[1].trim() }),
  },
  {
    re: /^Client created:\s*(.+)$/i,
    key: "activity.client_created",
    vars: (m) => ({ subject: m[1].trim() }),
  },
  {
    re: /^Projeto criado:\s*(.+)$/i,
    key: "activity.project_created",
    vars: (m) => ({ subject: m[1].trim() }),
  },
  {
    re: /^Project created:\s*(.+)$/i,
    key: "activity.project_created",
    vars: (m) => ({ subject: m[1].trim() }),
  },
  {
    re: /^Calendário duplicado:\s*(.+)$/i,
    key: "activity.calendar_duplicated",
    vars: (m) => ({ subject: m[1].trim() }),
  },
  {
    re: /^Calendar duplicated:\s*(.+)$/i,
    key: "activity.calendar_duplicated",
    vars: (m) => ({ subject: m[1].trim() }),
  },
  {
    re: /^(.+?)\s+[—–-]\s+v(\d+)$/i,
    key: "activity.version_created",
    vars: (m) => ({ subject: m[1].trim(), version: m[2] }),
  },
  { re: /^Pauta de reunião criada$/i, key: "activity.meeting_agenda_created" },
  { re: /^Meeting agenda created$/i, key: "activity.meeting_agenda_created" },
  { re: /^Pauta de reunião atualizada$/i, key: "activity.meeting_agenda_updated" },
  { re: /^Meeting agenda updated$/i, key: "activity.meeting_agenda_updated" },
  { re: /^Pauta de reunião removida$/i, key: "activity.meeting_agenda_deleted" },
  { re: /^Meeting agenda deleted$/i, key: "activity.meeting_agenda_deleted" },
];

/**
 * Localizes activity feed lines without waiting for AI backfill.
 * Prefers stored i18n; otherwise rebuilds from known summary templates.
 */
export function formatActivitySummary(
  event: ActivityLike,
  locale: string,
  t: TFunction,
): string {
  const loc = normalizeAppLocale(locale);
  const stored = getLocalizedText(event.i18n, "summary", "", loc).trim();
  if (stored) return stored;

  const summary = (event.summary ?? "").trim();
  if (!summary) return "";

  for (const pattern of SUMMARY_PATTERNS) {
    const match = summary.match(pattern.re);
    if (!match) continue;
    const vars = pattern.vars?.(match) ?? {};
    return t(pattern.key, { ...vars, defaultValue: summary });
  }

  return summary;
}
