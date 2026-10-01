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

const PAGE_META_MAX_BYTES = 512_000;
const PAGE_EXCERPT_MAX = 2500;

function decodeHtmlEntities(value: string): string {
  return value
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&nbsp;/gi, " ")
    .replace(/&#(\d+);/g, (_, code) => {
      const n = Number(code);
      return Number.isFinite(n) ? String.fromCharCode(n) : "";
    })
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => {
      const n = Number.parseInt(hex, 16);
      return Number.isFinite(n) ? String.fromCharCode(n) : "";
    });
}

function metaContent(html: string, propertyOrName: string): string {
  const escaped = propertyOrName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const patterns = [
    new RegExp(
      `<meta[^>]+(?:property|name)=["']${escaped}["'][^>]+content=["']([^"']*)["'][^>]*>`,
      "i",
    ),
    new RegExp(
      `<meta[^>]+content=["']([^"']*)["'][^>]+(?:property|name)=["']${escaped}["'][^>]*>`,
      "i",
    ),
  ];
  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (match?.[1]?.trim()) return decodeHtmlEntities(match[1].trim());
  }
  return "";
}

function titleTag(html: string): string {
  const match = html.match(/<title[^>]*>([^<]*)<\/title>/i);
  return match?.[1] ? decodeHtmlEntities(match[1].trim()) : "";
}

function bodyExcerpt(html: string): string {
  const withoutNoise = html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ");
  const mainMatch =
    withoutNoise.match(/<article[\s\S]*?<\/article>/i) ||
    withoutNoise.match(/<main[\s\S]*?<\/main>/i);
  const chunk = mainMatch?.[0] ?? withoutNoise;
  const text = decodeHtmlEntities(
    chunk
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<\/(p|div|h[1-6]|li|tr)>/gi, "\n")
      .replace(/<[^>]+>/g, " ")
      .replace(/[ \t]+\n/g, "\n")
      .replace(/\n{3,}/g, "\n\n")
      .replace(/[ \t]{2,}/g, " ")
      .trim(),
  );
  if (text.length <= PAGE_EXCERPT_MAX) return text;
  return `${text.slice(0, PAGE_EXCERPT_MAX - 1).trim()}…`;
}

/** Fetch public page title, description and a short text excerpt for non-social URLs. */
export async function fetchHtmlPageMeta(url: string): Promise<VideoMeta> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8000);
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        Accept: "text/html,application/xhtml+xml;q=0.9,*/*;q=0.8",
        "User-Agent": "BrandOSContentAssistant/1.0",
      },
      redirect: "follow",
    });
    clearTimeout(timer);
    if (!res.ok) return fallback(url);
    const contentType = (res.headers.get("content-type") || "").toLowerCase();
    if (!contentType.includes("html") && !contentType.includes("text/plain") && contentType) {
      return fallback(url);
    }
    const length = Number(res.headers.get("content-length") || "0");
    if (length > PAGE_META_MAX_BYTES) return fallback(url);
    const buffer = new Uint8Array(await res.arrayBuffer());
    if (buffer.byteLength > PAGE_META_MAX_BYTES) return fallback(url);
    const html = new TextDecoder("utf-8", { fatal: false }).decode(buffer);
    const title =
      metaContent(html, "og:title") ||
      metaContent(html, "twitter:title") ||
      titleTag(html);
    const description =
      metaContent(html, "og:description") ||
      metaContent(html, "twitter:description") ||
      metaContent(html, "description");
    const excerpt = bodyExcerpt(html);
    const descriptionParts = [description, excerpt && excerpt !== description ? excerpt : null]
      .filter(Boolean)
      .join("\n\n");
    if (!title && !descriptionParts) return fallback(url);
    return {
      url,
      title: title.slice(0, 300),
      description: descriptionParts.slice(0, PAGE_EXCERPT_MAX + 400),
    };
  } catch {
    return fallback(url);
  }
}

export async function fetchPublicProfileMeta(url: string): Promise<VideoMeta> {
  const trimmed = url.trim();
  if (!trimmed) return fallback(trimmed);
  if (extractYoutubeId(trimmed) || hostOf(trimmed)?.includes("youtube")) return fetchYoutubeMeta(trimmed);
  if (isInstagramUrl(trimmed)) return fetchInstagramMeta(trimmed);
  if (isTikTokUrl(trimmed)) return fetchTikTokMeta(trimmed);
  return fetchHtmlPageMeta(trimmed);
}
