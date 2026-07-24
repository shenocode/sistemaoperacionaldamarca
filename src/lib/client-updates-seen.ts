const STORAGE_KEY = "som_client_updates_seen_v1";
const CHANGE_EVENT = "som-client-updates-seen";

function readSeenMap(): Record<string, string> {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    return parsed as Record<string, string>;
  } catch {
    return {};
  }
}

export function markClientUpdatesSeen(clientId: string) {
  if (typeof window === "undefined") return;
  const map = readSeenMap();
  map[clientId] = new Date().toISOString();
  localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

export function hasUnreadClientUpdates(
  clientId: string,
  clientUpdatesAt: string | null | undefined,
): boolean {
  if (!clientUpdatesAt) return false;
  const seenAt = readSeenMap()[clientId];
  if (!seenAt) return true;
  return new Date(clientUpdatesAt).getTime() > new Date(seenAt).getTime();
}

export function subscribeClientUpdatesSeen(onStoreChange: () => void) {
  if (typeof window === "undefined") return () => {};
  window.addEventListener(CHANGE_EVENT, onStoreChange);
  window.addEventListener("storage", onStoreChange);
  return () => {
    window.removeEventListener(CHANGE_EVENT, onStoreChange);
    window.removeEventListener("storage", onStoreChange);
  };
}
