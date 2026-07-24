import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Database } from "@/integrations/supabase/types";

type ContentComment = Database["public"]["Tables"]["content_comments"]["Row"];
type ProfileName = Pick<
  Database["public"]["Tables"]["profiles"]["Row"],
  "full_name" | "avatar_url"
>;

type CommentWithAuthorRow = ContentComment & {
  profiles: ProfileName | null;
};

function resolveDisplayName(input: {
  fullName?: string | null;
  metaName?: string | null;
  email?: string | null;
}): string | null {
  const fromProfile = input.fullName?.trim();
  if (fromProfile) return fromProfile;
  const fromMeta = input.metaName?.trim();
  if (fromMeta) return fromMeta;
  const fromEmail = input.email?.split("@")[0]?.trim();
  return fromEmail || null;
}

export const listCommentsFn = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .validator(z.object({ contentId: z.string().uuid() }))
  .handler(async ({ data, context }): Promise<CommentWithAuthorRow[]> => {
    const { data: canAccess, error: accessError } = await context.supabase.rpc(
      "can_access_content",
      { _content_id: data.contentId },
    );
    if (accessError) throw new Error(accessError.message);
    if (!canAccess) throw new Error("Sem permissão para ver estes comentários.");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rows, error } = await supabaseAdmin
      .from("content_comments")
      .select("*, profiles!content_comments_user_id_fkey(full_name, avatar_url)")
      .eq("content_id", data.contentId)
      .order("created_at", { ascending: true });
    if (error) throw new Error(error.message);

    const comments = (rows ?? []) as CommentWithAuthorRow[];
    const missingNameIds = [
      ...new Set(
        comments
          .filter((comment) => !comment.profiles?.full_name?.trim())
          .map((comment) => comment.user_id),
      ),
    ];

    if (missingNameIds.length === 0) return comments;

    const nameByUserId = new Map<string, string>();
    await Promise.all(
      missingNameIds.map(async (userId) => {
        const { data: userData } = await supabaseAdmin.auth.admin.getUserById(userId);
        const user = userData.user;
        const name = resolveDisplayName({
          fullName: null,
          metaName:
            (user?.user_metadata?.full_name as string | undefined) ??
            (user?.user_metadata?.name as string | undefined) ??
            null,
          email: user?.email ?? null,
        });
        if (name) nameByUserId.set(userId, name);
      }),
    );

    return comments.map((comment) => {
      const existing = comment.profiles?.full_name?.trim();
      if (existing) {
        return {
          ...comment,
          profiles: {
            full_name: existing,
            avatar_url: comment.profiles?.avatar_url ?? null,
          },
        };
      }
      const resolved = nameByUserId.get(comment.user_id) ?? null;
      return {
        ...comment,
        profiles: {
          full_name: resolved,
          avatar_url: comment.profiles?.avatar_url ?? null,
        },
      };
    });
  });
