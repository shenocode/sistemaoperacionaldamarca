import type { VideoMeta } from "./video-meta.ts";

export type ReferenceCreator = {
  name: string;
  url: string;
  notes: string;
  pattern_summary: string;
};

export type WinningPost = {
  title: string;
  format: string;
  funnel_stage: string | null;
  performance_reach: string;
  performance_retention: string;
  performance_note: string;
};

type LooseClient = {
  from: (table: string) => {
    select: (columns: string) => {
      eq: (column: string, value: string | boolean) => unknown;
    };
  };
};

function isMissing(message: string, name: string): boolean {
  return new RegExp(name, "i").test(message) && /(does not exist|schema cache|not find)/i.test(message);
}

export async function loadReferenceCreators(
  supabase: LooseClient,
  clientId: string,
): Promise<ReferenceCreator[]> {
  try {
    const query = supabase.from("brand_reference_creators").select("name, url, notes, pattern_summary") as unknown as {
      eq: (column: string, value: string) => {
        order: (column: string, opts: { ascending: boolean }) => {
          limit: (n: number) => Promise<{ data: unknown[] | null; error: { message: string } | null }>;
        };
      };
    };
    const { data, error } = await query.eq("client_id", clientId).order("sort_order", { ascending: true }).limit(8);
    if (error) {
      if (isMissing(error.message, "brand_reference_creators")) return [];
      return [];
    }
    return (data ?? [])
      .map((row) => {
        const item = row as Record<string, unknown>;
        return {
          name: typeof item.name === "string" ? item.name.trim() : "",
          url: typeof item.url === "string" ? item.url.trim() : "",
          notes: typeof item.notes === "string" ? item.notes.trim() : "",
          pattern_summary: typeof item.pattern_summary === "string" ? item.pattern_summary.trim() : "",
        };
      })
      .filter((row) => row.name || row.url || row.pattern_summary);
  } catch {
    return [];
  }
}

export async function loadWinningPosts(
  supabase: LooseClient,
  projectId: string,
): Promise<WinningPost[]> {
  try {
    const query = supabase
      .from("content_items")
      .select("title, format, funnel_stage, performance_reach, performance_retention, performance_note") as unknown as {
        eq: (column: string, value: string | boolean) => {
          eq: (column: string, value: boolean) => {
            order: (column: string, opts: { ascending: boolean }) => {
              limit: (n: number) => Promise<{ data: unknown[] | null; error: { message: string } | null }>;
            };
          };
        };
      };
    const { data, error } = await query
      .eq("project_id", projectId)
      .eq("repeat_format", true)
      .order("updated_at", { ascending: false })
      .limit(8);
    if (error) return [];
    return (data ?? []).map((row) => {
      const item = row as Record<string, unknown>;
      return {
        title: typeof item.title === "string" ? item.title : "",
        format: typeof item.format === "string" ? item.format : "",
        funnel_stage: typeof item.funnel_stage === "string" ? item.funnel_stage : null,
        performance_reach: typeof item.performance_reach === "string" ? item.performance_reach : "",
        performance_retention: typeof item.performance_retention === "string" ? item.performance_retention : "",
        performance_note: typeof item.performance_note === "string" ? item.performance_note : "",
      };
    });
  } catch {
    return [];
  }
}

export function formatReferenceCreatorsBlock(creators: ReferenceCreator[]): string | null {
  if (!creators.length) return null;
  return `Criadores de referência da marca:\n${creators
    .map((creator, index) => {
      const lines = [
        `${index + 1}. ${creator.name || creator.url || "Sem nome"}`,
        creator.url ? `   URL: ${creator.url}` : null,
        creator.notes ? `   Notas: ${creator.notes}` : null,
        creator.pattern_summary ? `   Padrões: ${creator.pattern_summary}` : null,
      ];
      return lines.filter(Boolean).join("\n");
    })
    .join("\n")}`;
}

export function formatWinningPostsBlock(posts: WinningPost[]): string | null {
  if (!posts.length) return null;
  return `Formatos vencedores marcados para repetir neste projeto:\n${posts
    .map((post, index) => {
      const lines = [
        `${index + 1}. ${post.title || "(sem título)"} · ${post.format}${post.funnel_stage ? ` · ${post.funnel_stage.toUpperCase()}` : ""}`,
        post.performance_reach ? `   Alcance: ${post.performance_reach}` : null,
        post.performance_retention ? `   Retenção: ${post.performance_retention}` : null,
        post.performance_note ? `   Nota: ${post.performance_note}` : null,
      ];
      return lines.filter(Boolean).join("\n");
    })
    .join("\n")}`;
}

export function formatProfileMetasBlock(label: string, metas: VideoMeta[]): string | null {
  if (!metas.length) return null;
  return `${label}\n${metas
    .map((v, i) => `${i + 1}. ${v.url}\n   Título: ${v.title || "(indisponível)"}\n   ${v.description || ""}`)
    .join("\n")}`;
}
