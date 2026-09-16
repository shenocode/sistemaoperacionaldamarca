export type WebSource = {
  title: string;
  url: string;
  snippet: string;
};

function truncate(value: string, max: number): string {
  const trimmed = value.trim();
  if (trimmed.length <= max) return trimmed;
  return `${trimmed.slice(0, max - 1).trim()}…`;
}

async function searchTavily(query: string, apiKey: string): Promise<WebSource[]> {
  const res = await fetch("https://api.tavily.com/search", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      api_key: apiKey,
      query,
      max_results: 5,
      search_depth: "basic",
      include_answer: false,
    }),
  });
  if (!res.ok) return [];
  const data = (await res.json()) as {
    results?: Array<{ title?: string; url?: string; content?: string }>;
  };
  return (data.results ?? [])
    .map((item) => ({
      title: (item.title ?? "").trim() || item.url || "",
      url: (item.url ?? "").trim(),
      snippet: truncate(item.content ?? "", 280),
    }))
    .filter((item) => item.url)
    .slice(0, 5);
}

function collectDdgTopics(raw: unknown, out: WebSource[]) {
  if (!Array.isArray(raw) || out.length >= 5) return;
  for (const item of raw) {
    if (out.length >= 5) return;
    if (!item || typeof item !== "object") continue;
    const row = item as { FirstURL?: string; Text?: string; Topics?: unknown };
    if (row.Topics) collectDdgTopics(row.Topics, out);
    const url = typeof row.FirstURL === "string" ? row.FirstURL.trim() : "";
    const text = typeof row.Text === "string" ? row.Text.trim() : "";
    if (!url) continue;
    out.push({
      title: text.split(" - ")[0] || url,
      url,
      snippet: truncate(text, 280),
    });
  }
}

async function searchDuckDuckGo(query: string): Promise<WebSource[]> {
  const url = `https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_html=1&skip_disambig=1`;
  const res = await fetch(url, { headers: { Accept: "application/json" } });
  if (!res.ok) return [];
  const data = (await res.json()) as {
    Abstract?: string;
    AbstractURL?: string;
    Heading?: string;
    RelatedTopics?: unknown;
    Results?: Array<{ FirstURL?: string; Text?: string }>;
  };
  const sources: WebSource[] = [];
  if (data.AbstractURL && (data.Abstract || data.Heading)) {
    sources.push({
      title: (data.Heading || data.AbstractURL).trim(),
      url: data.AbstractURL.trim(),
      snippet: truncate(data.Abstract ?? "", 280),
    });
  }
  for (const item of data.Results ?? []) {
    if (sources.length >= 5) break;
    const itemUrl = item.FirstURL?.trim();
    if (!itemUrl) continue;
    sources.push({
      title: (item.Text ?? itemUrl).split(" - ")[0],
      url: itemUrl,
      snippet: truncate(item.Text ?? "", 280),
    });
  }
  collectDdgTopics(data.RelatedTopics, sources);
  return sources.slice(0, 5);
}

export async function searchWeb(query: string): Promise<{ sources: WebSource[]; unavailable: boolean }> {
  const trimmed = query.trim();
  if (!trimmed) return { sources: [], unavailable: true };

  const tavilyKey = Deno.env.get("TAVILY_API_KEY")?.trim();
  if (tavilyKey) {
    try {
      const sources = await searchTavily(trimmed, tavilyKey);
      if (sources.length) return { sources, unavailable: false };
    } catch {
      // fall through
    }
  }

  try {
    const sources = await searchDuckDuckGo(trimmed);
    if (sources.length) return { sources, unavailable: false };
  } catch {
    // fall through
  }

  return { sources: [], unavailable: true };
}

export function formatWebSourcesBlock(sources: WebSource[]): string | null {
  if (!sources.length) return null;
  return `Fontes da pesquisa web (cite só o que estiver aqui; não invente números):\n${sources
    .map((source, index) => `${index + 1}. ${source.title}\n   ${source.url}\n   ${source.snippet}`)
    .join("\n")}`;
}
