const STORAGE_KEY = "som_calendar_block_collapsed_v1";

function readMap(): Record<string, string[]> {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};

    const map: Record<string, string[]> = {};
    for (const [projectId, value] of Object.entries(parsed)) {
      if (!Array.isArray(value)) continue;
      map[projectId] = value.filter((id): id is string => typeof id === "string");
    }
    return map;
  } catch {
    return {};
  }
}

export function readCollapsedCalendarBlockIds(projectId: string): Set<string> {
  return new Set(readMap()[projectId] ?? []);
}

export function writeCollapsedCalendarBlockIds(
  projectId: string,
  collapsedIds: Set<string>,
) {
  if (typeof window === "undefined") return;
  const map = readMap();
  map[projectId] = [...collapsedIds];
  localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
}
