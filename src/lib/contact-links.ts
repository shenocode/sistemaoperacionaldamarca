/** Public support links for WhatsApp bot / admin copy-paste. */

function readEnvUrl(key: string): string {
  const raw = (import.meta.env[key] as string | undefined)?.trim() ?? "";
  if (!raw) return "";
  try {
    const url = new URL(raw);
    if (url.protocol !== "https:" && url.protocol !== "http:") return "";
    return url.toString();
  } catch {
    return "";
  }
}

export const CONTACT_CALENDAR_URL = readEnvUrl("VITE_CONTACT_CALENDAR_URL");
export const CONTACT_VIDEO_URL = readEnvUrl("VITE_CONTACT_VIDEO_URL");
