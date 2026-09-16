export type VideoMeta = {
  url: string;
  title: string;
  description: string;
};

function fallback(url: string): VideoMeta {
  return { url, title: "", description: "" };
}

function hostOf(raw: string): string | null {
  try {
    return new URL(raw.trim()).hostname.replace(/^www\./, "");
  } catch {
    return null;
  }
}

export function extractYoutubeId(raw: string): string | null {
  try {
    const url = new URL(raw.trim());
    const host = url.hostname.replace(/^www\./, "");
    if (host === "youtu.be") {
      const id = url.pathname.split("/").filter(Boolean)[0];
      return id || null;
    }
    if (host === "youtube.com" || host === "m.youtube.com" || host === "music.youtube.com") {
      if (url.pathname === "/watch") return url.searchParams.get("v");
      const parts = url.pathname.split("/").filter(Boolean);
      if (parts[0] === "shorts" || parts[0] === "embed" || parts[0] === "live") {
        return parts[1] || null;
      }
    }
  } catch {
    return null;
  }
  return null;
}

export async function fetchYoutubeMeta(url: string): Promise<VideoMeta> {
  const id = extractYoutubeId(url);
  if (!id) return fallback(url);
  try {
    const oembedUrl = `https://www.youtube.com/oembed?url=${encodeURIComponent(`https://www.youtube.com/watch?v=${id}`)}&format=json`;
    const res = await fetch(oembedUrl);
    if (!res.ok) return fallback(url);
    const data = (await res.json()) as { title?: string; author_name?: string };
    return {
      url,
      title: data.title?.trim() || "",
      description: data.author_name ? `Canal: ${data.author_name}` : "",
    };
  } catch {
    return fallback(url);
  }
}

export function isInstagramUrl(raw: string): boolean {
  const host = hostOf(raw);
  return host === "instagram.com" || host === "instagr.am";
}

export async function fetchInstagramMeta(url: string): Promise<VideoMeta> {
  if (!isInstagramUrl(url)) return fallback(url);
  try {
    const oembedUrl = `https://graph.facebook.com/v25.0/instagram_oembed?url=${encodeURIComponent(url.trim())}`;
    const res = await fetch(oembedUrl);
    if (!res.ok) return fallback(url);
    const data = (await res.json()) as { title?: string; author_name?: string };
    return {
      url,
      title: data.title?.trim() || "",
      description: data.author_name ? `Autor: ${data.author_name}` : "",
    };
  } catch {
    return fallback(url);
  }
}

export function isTikTokUrl(raw: string): boolean {
  const host = hostOf(raw);
  return host === "tiktok.com" || host === "vm.tiktok.com" || host === "vt.tiktok.com";
}

export async function fetchTikTokMeta(url: string): Promise<VideoMeta> {
  if (!isTikTokUrl(url)) return fallback(url);
  try {
    const oembedUrl = `https://www.tiktok.com/oembed?url=${encodeURIComponent(url.trim())}`;
    const res = await fetch(oembedUrl);
    if (!res.ok) return fallback(url);
    const data = (await res.json()) as { title?: string; author_name?: string; author_url?: string };
    return {
      url,
      title: data.title?.trim() || "",
      description: [data.author_name ? `Autor: ${data.author_name}` : "", data.author_url]
        .filter(Boolean)
        .join(" · "),
    };
  } catch {
    return fallback(url);
  }
}

export function formatVideoMetasBlock(label: string, metas: VideoMeta[]): string | null {
  if (!metas.length) return null;
  return `${label}\n${metas
    .map((v, i) => `${i + 1}. ${v.url}\n   Título: ${v.title || "(indisponível)"}\n   ${v.description || ""}`)
    .join("\n")}`;
}

export async function fetchPublicProfileMeta(url: string): Promise<VideoMeta> {
  const trimmed = url.trim();
  if (!trimmed) return fallback(trimmed);
  if (extractYoutubeId(trimmed) || hostOf(trimmed)?.includes("youtube")) return fetchYoutubeMeta(trimmed);
  if (isInstagramUrl(trimmed)) return fetchInstagramMeta(trimmed);
  if (isTikTokUrl(trimmed)) return fetchTikTokMeta(trimmed);
  return fallback(trimmed);
}
