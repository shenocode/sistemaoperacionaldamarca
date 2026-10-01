import { CONTENT_FORMATS, type ContentFormat } from "@/lib/api";
import { scheduledDateRange } from "@/lib/calendar-month-grid";

export type PeriodClosingScope = "published" | "delivered";

export type FormatCount = {
  format: ContentFormat;
  count: number;
};

export function matchesPeriodClosingScope(
  status: string | null | undefined,
  scope: PeriodClosingScope,
): boolean {
  if (status === "published") return true;
  return scope === "delivered" && status === "approved";
}

export function countPeriodClosingFormats(
  items: Array<{ format: ContentFormat; status: string }>,
  scope: PeriodClosingScope,
): { total: number; byFormat: FormatCount[] } {
  const included = items.filter((item) => matchesPeriodClosingScope(item.status, scope));
  const counts = new Map<ContentFormat, number>();
  for (const item of included) {
    counts.set(item.format, (counts.get(item.format) ?? 0) + 1);
  }

  const byFormat: FormatCount[] = CONTENT_FORMATS.filter((format) => (counts.get(format) ?? 0) > 0).map(
    (format) => ({ format, count: counts.get(format) ?? 0 }),
  );

  for (const [format, count] of counts) {
    if (count > 0 && !byFormat.some((row) => row.format === format)) {
      byFormat.push({ format, count });
    }
  }

  return { total: included.length, byFormat };
}

export function countApprovedNotPublished(
  items: Array<{ status: string | null | undefined }>,
): number {
  return items.filter((item) => item.status === "approved").length;
}

export function paymentDateFromDay(
  periodEnd: Date | null,
  paymentDay: number,
  now: Date = new Date(),
): Date {
  const day = Math.min(31, Math.max(1, Math.round(paymentDay)));
  const base = periodEnd ?? now;
  const startBase = new Date(base.getFullYear(), base.getMonth(), base.getDate());
  let year = startBase.getFullYear();
  let month = startBase.getMonth();
  const lastDay = new Date(year, month + 1, 0).getDate();
  let candidate = new Date(year, month, Math.min(day, lastDay));
  if (candidate.getTime() < startBase.getTime()) {
    month += 1;
    if (month > 11) {
      month = 0;
      year += 1;
    }
    const nextLastDay = new Date(year, month + 1, 0).getDate();
    candidate = new Date(year, month, Math.min(day, nextLastDay));
  }
  return candidate;
}

export function periodEndFromItems(
  items: Array<{ scheduled_at: string | null }>,
): Date | null {
  return scheduledDateRange(items)?.end ?? null;
}

export function toDateInputValue(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function formatDateLabel(isoDate: string, locale: string): string {
  const [year, month, day] = isoDate.split("-").map(Number);
  if (!year || !month || !day) return isoDate;
  return new Intl.DateTimeFormat(locale, {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date(year, month - 1, day));
}

export function parseMoneyInput(raw: string): number | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const cleaned = trimmed.replace(/[^\d,.-]/g, "");
  if (!cleaned) return null;
  const n = cleaned.includes(",")
    ? Number(cleaned.replace(/\./g, "").replace(",", "."))
    : Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

export function formatMoneyInput(value: number): string {
  return new Intl.NumberFormat("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

export function formatMoneyDisplay(value: number, locale: string): string {
  return new Intl.NumberFormat(locale, { style: "currency", currency: "BRL" }).format(value);
}

export function composePeriodClosingMessage(input: {
  greeting: string;
  totalLine: string;
  formatLines: string[];
  amountLine?: string;
  paymentLine?: string;
  pixLine?: string;
  notes?: string;
  closing: string;
}): string {
  const lines: string[] = [input.greeting, "", input.totalLine];
  if (input.formatLines.length > 0) {
    lines.push(...input.formatLines);
  }

  const paymentLines = [input.amountLine, input.paymentLine, input.pixLine].filter(
    (line): line is string => Boolean(line?.trim()),
  );
  if (paymentLines.length > 0) {
    lines.push("");
    lines.push(...paymentLines);
  }

  const notes = input.notes?.trim();
  if (notes) {
    lines.push("");
    lines.push(notes);
  }

  lines.push("");
  lines.push(input.closing);
  return lines.join("\n");
}
