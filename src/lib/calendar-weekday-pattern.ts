/** 0 = domingo … 6 = sábado (mesmo contrato de Date#getDay). */
export type Weekday = 0 | 1 | 2 | 3 | 4 | 5 | 6;

type TimedItem = { scheduled_at: string | null };

const DEFAULT_TIME = { hours: 19, minutes: 30 };

export function parseScheduledDate(iso: string | null | undefined): Date | null {
  if (!iso) return null;
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? null : date;
}

function startOfLocalDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function addLocalDays(date: Date, days: number): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + days);
}

function withLocalTime(date: Date, hours: number, minutes: number): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), hours, minutes, 0, 0);
}

function sameLocalMinute(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate() &&
    a.getHours() === b.getHours() &&
    a.getMinutes() === b.getMinutes()
  );
}

function minDate(dates: Date[]): Date {
  return dates.reduce((earliest, date) => (date < earliest ? date : earliest));
}

export function mostCommonTime(dates: Date[]): { hours: number; minutes: number } {
  if (dates.length === 0) return DEFAULT_TIME;
  const counts = new Map<string, number>();
  for (const date of dates) {
    const key = `${date.getHours()}:${date.getMinutes()}`;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  let best = DEFAULT_TIME;
  let bestCount = 0;
  for (const [key, count] of counts) {
    if (count < bestCount) continue;
    const [hours, minutes] = key.split(":").map(Number);
    best = { hours, minutes };
    bestCount = count;
  }
  return best;
}

/**
 * Infere os dias da semana recorrentes no histórico (ex.: terça e quinta → [2, 4]).
 * Dias esporádicos (um sábado isolado) ficam de fora.
 */
export function inferWeekdayPattern(dates: Date[]): Weekday[] {
  if (dates.length === 0) return [];

  const counts = [0, 0, 0, 0, 0, 0, 0];
  for (const date of dates) counts[date.getDay()] += 1;

  const max = Math.max(...counts);
  const distinct = counts.filter((count) => count > 0).length;
  const threshold = dates.length <= 3 ? 1 : Math.max(1, Math.ceil(max * 0.35));

  const pattern: Weekday[] = [];
  for (let day = 0; day < 7; day++) {
    if (counts[day] >= threshold) pattern.push(day as Weekday);
  }

  // Publicação diluída em quase todos os dias: não há cadência semanal útil.
  if (distinct >= 5 && pattern.length >= 5) return [];
  return pattern;
}

export function nextPatternDateOnOrAfter(date: Date, pattern: Weekday[]): Date {
  if (pattern.length === 0) return startOfLocalDay(date);
  const weekdays = new Set(pattern);
  let cursor = startOfLocalDay(date);
  for (let step = 0; step < 8; step++) {
    if (weekdays.has(cursor.getDay() as Weekday)) return cursor;
    cursor = addLocalDays(cursor, 1);
  }
  return cursor;
}

export function generatePatternDates(anchor: Date, pattern: Weekday[], count: number): Date[] {
  if (count <= 0 || pattern.length === 0) return [];
  const weekdays = new Set(pattern);
  const dates: Date[] = [];
  let cursor = startOfLocalDay(anchor);
  const maxSteps = Math.max(count * 14, 366 * 3);
  for (let step = 0; step < maxSteps && dates.length < count; step++) {
    if (weekdays.has(cursor.getDay() as Weekday)) {
      dates.push(new Date(cursor));
    }
    cursor = addLocalDays(cursor, 1);
  }
  return dates;
}

function uniqueDayKey(date: Date): number {
  return startOfLocalDay(date).getTime();
}

function generateSlotsAfter(
  anchor: Date,
  pattern: Weekday[],
  count: number,
  defaultTime: { hours: number; minutes: number },
): string[] {
  const extra = generatePatternDates(addLocalDays(startOfLocalDay(anchor), 1), pattern, count);
  return extra.map((date) =>
    withLocalTime(date, defaultTime.hours, defaultTime.minutes).toISOString(),
  );
}

/**
 * Monta os horários do período na ordem cronológica, alinhados à cadência semanal.
 * Datas que já caem no padrão (ex. terça/quinta) são reaproveitadas; as demais são
 * encaixadas no próximo dia do padrão. Itens sem data ganham a continuação da cadência.
 */
function buildChronologicalSlots(
  items: TimedItem[],
  pattern: Weekday[],
  defaultTime: { hours: number; minutes: number },
  excludeIndexes: Set<number>,
  fallbackAnchor: Date | null,
): string[] {
  const dated = items
    .map((item, index) => {
      if (excludeIndexes.has(index)) return null;
      const date = parseScheduledDate(item.scheduled_at);
      return date && item.scheduled_at ? { iso: item.scheduled_at, date } : null;
    })
    .filter((entry): entry is { iso: string; date: Date } => entry !== null)
    .sort((a, b) => a.date.getTime() - b.date.getTime());

  if (dated.length === 0) {
    if (pattern.length > 0 && fallbackAnchor) {
      return generateSlotsAfter(fallbackAnchor, pattern, items.length, defaultTime);
    }
    return [];
  }

  const slots: string[] = [];
  const usedDays = new Set<number>();

  const pushSlot = (iso: string, date: Date) => {
    const key = uniqueDayKey(date);
    if (usedDays.has(key)) return false;
    usedDays.add(key);
    slots.push(iso);
    return true;
  };

  if (pattern.length === 0) {
    for (const entry of dated) pushSlot(entry.iso, entry.date);
  } else {
    const patternSet = new Set(pattern);
    for (const entry of dated) {
      if (patternSet.has(entry.date.getDay() as Weekday)) {
        pushSlot(entry.iso, entry.date);
        continue;
      }
      let cursor = nextPatternDateOnOrAfter(entry.date, pattern);
      while (usedDays.has(uniqueDayKey(cursor))) {
        cursor = nextPatternDateOnOrAfter(addLocalDays(cursor, 1), pattern);
      }
      const snapped = withLocalTime(cursor, entry.date.getHours(), entry.date.getMinutes());
      pushSlot(snapped.toISOString(), snapped);
    }
    slots.sort((a, b) => new Date(a).getTime() - new Date(b).getTime());
  }

  if (slots.length < items.length && pattern.length > 0) {
    const last =
      parseScheduledDate(slots[slots.length - 1]) ??
      minDate(dated.map((entry) => entry.date));
    for (const iso of generateSlotsAfter(last, pattern, items.length - slots.length, defaultTime)) {
      const date = parseScheduledDate(iso);
      if (date) pushSlot(iso, date);
    }
  }

  return slots;
}

export type RescheduleWeekdayOptions = {
  /** Índices cuja data atual não deve virar vaga (conteúdo que veio de outro período). */
  excludeIndexes?: number[];
  /** Quando o destino não tem data útil, continua a cadência depois deste instante. */
  fallbackAnchor?: Date | null;
};

/**
 * Redistribui as datas na nova ordem visual. A 1ª linha fica com o 1º horário da
 * cadência (ex. terça), a 2ª com o seguinte (quinta), e assim por diante.
 */
export function rescheduleItemsToWeekdayPattern<T extends TimedItem>(
  itemsInNewOrder: T[],
  historyIso: Array<string | null | undefined>,
  options?: RescheduleWeekdayOptions,
): T[] {
  if (itemsInNewOrder.length === 0) return itemsInNewOrder;

  const excludeIndexes = new Set(options?.excludeIndexes ?? []);
  const slotDates = itemsInNewOrder
    .map((item, index) => (excludeIndexes.has(index) ? null : parseScheduledDate(item.scheduled_at)))
    .filter((date): date is Date => date !== null);
  const itemDates = itemsInNewOrder
    .map((item) => parseScheduledDate(item.scheduled_at))
    .filter((date): date is Date => date !== null);
  if (slotDates.length === 0 && !options?.fallbackAnchor) return itemsInNewOrder;

  const historyDates = historyIso
    .map((iso) => parseScheduledDate(iso))
    .filter((date): date is Date => date !== null);

  const pattern = inferWeekdayPattern(
    historyDates.length >= 2 ? historyDates : slotDates.length > 0 ? slotDates : itemDates,
  );
  const defaultTime = mostCommonTime(slotDates.length > 0 ? slotDates : itemDates);
  const slots = buildChronologicalSlots(
    itemsInNewOrder,
    pattern,
    defaultTime,
    excludeIndexes,
    options?.fallbackAnchor ?? null,
  );
  if (slots.length === 0) return itemsInNewOrder;

  let slotIndex = 0;
  return itemsInNewOrder.map((item) => {
    const nextIso = slots[slotIndex++];
    if (!nextIso) return item;
    if (nextIso === item.scheduled_at) return item;
    const original = parseScheduledDate(item.scheduled_at);
    const next = parseScheduledDate(nextIso);
    if (original && next && sameLocalMinute(original, next)) return item;
    return { ...item, scheduled_at: nextIso };
  });
}

export function scheduledAtChanged<T extends TimedItem>(before: T[], after: T[]): boolean {
  if (before.length !== after.length) return true;
  return after.some((item, index) => item.scheduled_at !== before[index]?.scheduled_at);
}
