const STORAGE_KEY = "som_calendar_view_mode_v1";

export type CalendarViewMode = "list" | "month";

function readMap(): Record<string, string> {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};

    const map: Record<string, string> = {};
    for (const [projectId, value] of Object.entries(parsed)) {
      if (typeof value === "string") map[projectId] = value;
    }
    return map;
  } catch {
    return {};
  }
}

export function readCalendarViewMode(projectId: string): CalendarViewMode {
  return readMap()[projectId] === "month" ? "month" : "list";
}

export function writeCalendarViewMode(projectId: string, mode: CalendarViewMode) {
  if (typeof window === "undefined") return;
  const map = readMap();
  map[projectId] = mode;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
}
