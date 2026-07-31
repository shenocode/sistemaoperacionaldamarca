import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

export type SharePreview = {
  client_id: string;
  client_name: string;
  logo_url: string | null;
  project_id: string;
  project_name: string;
};

const inputSchema = z.object({
  access: z.string().uuid(),
  clientId: z.string().uuid(),
  projectId: z.string().uuid(),
});

export const getSharePreviewFn = createServerFn({ method: "GET" })
  .inputValidator((data: unknown) => inputSchema.parse(data))
  .handler(async ({ data }): Promise<SharePreview | null> => {
    // Use the publishable client (not service role): get_share_preview is
    // SECURITY DEFINER and token-gated, and Netlify SSR often lacks
    // SUPABASE_SERVICE_ROLE_KEY — which previously forced the SOM fallback image.
    const { supabase } = await import("@/integrations/supabase/client");

    const { data: rows, error } = await supabase.rpc("get_share_preview", {
      _access_token: data.access,
      _client_id: data.clientId,
      _project_id: data.projectId,
    });

    if (error) {
      console.error("[share] get_share_preview failed:", error.message);
      return null;
    }

    const row = Array.isArray(rows) ? rows[0] : rows;
    if (!row?.client_id || !row?.project_id) return null;

    return {
      client_id: row.client_id,
      client_name: row.client_name,
      logo_url: row.logo_url ?? null,
      project_id: row.project_id,
      project_name: row.project_name,
    };
  });
