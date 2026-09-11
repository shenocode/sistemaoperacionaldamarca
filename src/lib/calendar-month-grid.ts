import {
  addDays,
  addMonths,
  endOfMonth,
  endOfWeek,
  startOfMonth,
  startOfWeek,
} from "date-fns";
import type { Locale } from "date-fns";
import type { ContentItem } from "@/lib/api";
import { parseScheduledDate } from "@/lib/calendar-weekday-pattern";

export type CalendarDayItem = {
  item: ContentItem;
  index: number;
};

function weekStartsOnFromLocale(locale: Locale): 0 | 1 | 2 | 3 | 4 | 5 | 6 {
  return (locale.options?.weekStartsOn ?? 0) as 0 | 1 | 2 | 3 | 4 | 5 | 6;
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

export function monthsCoveringItems(items: ContentItem[], maxMonths = 12): Date[] {
  const dates = items
    .map((item) => parseScheduledDate(item.scheduled_at))
    .filter((date): date is Date => Boolean(date));
  if (dates.length === 0) return [];

  let cursor = startOfMonth(dates.reduce((earliest, date) => (date < earliest ? date : earliest)));
  const last = startOfMonth(dates.reduce((latest, date) => (date > latest ? date : latest)));
  const months: Date[] = [];

  while (cursor.getTime() <= last.getTime() && months.length < maxMonths) {
    months.push(cursor);
    cursor = addMonths(cursor, 1);
  }

  return months;
}

export function buildWeeksForMonth(month: Date, locale: Locale): Date[][] {
  const weekStartsOn = weekStartsOnFromLocale(locale);
  const start = startOfWeek(startOfMonth(month), { locale, weekStartsOn });
  const end = endOfWeek(endOfMonth(month), { locale, weekStartsOn });
  const weeks: Date[][] = [];
  let week: Date[] = [];

  for (let cursor = start; cursor.getTime() <= end.getTime(); cursor = addDays(cursor, 1)) {
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
  const months = monthsCoveringItems(items).map((month) => ({
    month,
    weeks: buildWeeksForMonth(month, locale),
  }));
  return {
    months,
    weekdays: weekdayHeaders(locale),
    byDay,
    unscheduled,
  };
}
