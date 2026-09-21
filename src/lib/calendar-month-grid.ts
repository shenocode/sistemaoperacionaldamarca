import { addDays, endOfWeek, startOfWeek } from "date-fns";
import type { Locale } from "date-fns";
import type { ContentItem } from "@/lib/api";
import { parseScheduledDate } from "@/lib/calendar-weekday-pattern";

export type CalendarDayItem = {
  item: ContentItem;
  index: number;
  prior?: boolean;
};

const MAX_WEEKS = 16;

export function previousBlockItems(
  blockKey: string,
  blocks: { id: string }[],
  itemsByBlock: Map<string, ContentItem[]>,
): ContentItem[] {
  if (blockKey === "__all__") return [];

  const previous: ContentItem[] = [];
  if (blockKey === "__unassigned__") {
    for (const block of blocks) {
      previous.push(...(itemsByBlock.get(block.id) ?? []));
    }
    return previous;
  }

  for (const block of blocks) {
    if (block.id === blockKey) break;
    previous.push(...(itemsByBlock.get(block.id) ?? []));
  }
  return previous;
}

export function itemsForCalendarDay(
  dayKey: string,
  currentByDay: Map<string, CalendarDayItem[]>,
  priorByDay: Map<string, CalendarDayItem[]>,
): CalendarDayItem[] {
  const prior = (priorByDay.get(dayKey) ?? []).map((entry) => ({ ...entry, prior: true }));
  const current = (currentByDay.get(dayKey) ?? []).map((entry) => ({ ...entry, prior: false }));
  return [...prior, ...current];
}

function weekStartsOnFromLocale(locale: Locale): 0 | 1 | 2 | 3 | 4 | 5 | 6 {
  return (locale.options?.weekStartsOn ?? 0) as 0 | 1 | 2 | 3 | 4 | 5 | 6;
}

function startOfLocalDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

export function localDayKey(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function groupItemsByDay(items: ContentItem[]): {
  byDay: Map<string, CalendarDayItem[]>;
  unscheduled: CalendarDayItem[];
} {
  const byDay = new Map<string, CalendarDayItem[]>();
  const unscheduled: CalendarDayItem[] = [];

  items.forEach((item, index) => {
    const date = parseScheduledDate(item.scheduled_at);
    if (!date) {
      unscheduled.push({ item, index });
      return;
    }
    const key = localDayKey(date);
    const list = byDay.get(key) ?? [];
    list.push({ item, index });
    byDay.set(key, list);
  });

  return { byDay, unscheduled };
}

export function scheduledDateRange(
  items: Array<{ scheduled_at: string | null }>,
): { start: Date; end: Date } | null {
  const dates = items
    .map((item) => parseScheduledDate(item.scheduled_at))
    .filter((date): date is Date => Boolean(date))
    .map(startOfLocalDay);
  if (dates.length === 0) return null;

  return {
    start: dates.reduce((earliest, date) => (date < earliest ? date : earliest)),
    end: dates.reduce((latest, date) => (date > latest ? date : latest)),
  };
}

export function isInScheduledRange(day: Date, range: { start: Date; end: Date } | null): boolean {
  if (!range) return false;
  const time = startOfLocalDay(day).getTime();
  return time >= range.start.getTime() && time <= range.end.getTime();
}

/** True when the last scheduled post of the period is before today. */
export function isCalendarPeriodFinished(
  items: ContentItem[],
  now: Date = new Date(),
): boolean {
  const range = scheduledDateRange(items);
  if (!range) return false;
  return range.end.getTime() < startOfLocalDay(now).getTime();
}

export function buildWeeksForRange(start: Date, end: Date, locale: Locale): Date[][] {
  const weekStartsOn = weekStartsOnFromLocale(locale);
  const rangeStart = startOfWeek(start, { locale, weekStartsOn });
  const rangeEnd = endOfWeek(end, { locale, weekStartsOn });
  const weeks: Date[][] = [];
  let week: Date[] = [];

  for (
    let cursor = rangeStart;
    cursor.getTime() <= rangeEnd.getTime() && weeks.length < MAX_WEEKS;
    cursor = addDays(cursor, 1)
  ) {
    week.push(cursor);
    if (week.length === 7) {
      weeks.push(week);
      week = [];
    }
  }

  return weeks;
}

export function weekdayHeaders(locale: Locale): Date[] {
  const weekStartsOn = weekStartsOnFromLocale(locale);
  const start = startOfWeek(new Date(2024, 0, 7), { locale, weekStartsOn });
  return Array.from({ length: 7 }, (_, index) => addDays(start, index));
}

export function buildCalendarMonthModel(items: ContentItem[], locale: Locale) {
  const { byDay, unscheduled } = groupItemsByDay(items);
  const range = scheduledDateRange(items);
  const weeks = range ? buildWeeksForRange(range.start, range.end, locale) : [];
  return {
    range,
    weeks,
    weekdays: weekdayHeaders(locale),
    byDay,
    unscheduled,
  };
}
