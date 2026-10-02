import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import type { AnyClient } from "../_shared/admin-clients.ts";

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const BUCKET = "client-logos";
const MAX_BYTES = 2 * 1024 * 1024;
const ALLOWED_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
  "image/svg+xml",
]);

type UploadBody = {
  clientId?: string;
  fileName?: string;
  contentType?: string;
  base64?: string;
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function sanitizeFileName(name: string) {
  return name.replace(/[^\w.\-()+ ]+/g, "_").replace(/\s+/g, "-").slice(0, 120);
}

function decodeBase64(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

async function ensureBucket(
  admin: AnyClient,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const { data: buckets, error: listError } = await admin.storage.listBuckets();
  if (listError) return { ok: false, message: listError.message };

  const exists = (buckets ?? []).some((bucket) => bucket.id === BUCKET || bucket.name === BUCKET);
  if (exists) {
    await admin.storage.updateBucket(BUCKET, {
      public: true,
      fileSizeLimit: MAX_BYTES,
      allowedMimeTypes: [...ALLOWED_TYPES],
    });
    return { ok: true };
  }

  const { error: createError } = await admin.storage.createBucket(BUCKET, {
    public: true,
    fileSizeLimit: MAX_BYTES,
    allowedMimeTypes: [...ALLOWED_TYPES],
  });
  if (createError && !/already exists|duplicate/i.test(createError.message)) {
    return { ok: false, message: createError.message };
  }
  return { ok: true };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !supabaseAnonKey || !serviceRoleKey) {
      return jsonResponse({ error: "Supabase env missing" }, 500);
    }

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return jsonResponse({ error: "Não autenticado" }, 401);
    }

    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const admin = createClient(supabaseUrl, serviceRoleKey);

    const {
      data: { user },
      error: userError,
    } = await userClient.auth.getUser();
    if (userError || !user) {
      return jsonResponse({ error: "Não autenticado" }, 401);
    }

    const body = (await req.json()) as UploadBody;
    const clientId = body.clientId?.trim();
    const contentType = (body.contentType || "image/png").trim();
    const fileName = sanitizeFileName(body.fileName || "logo.png");
    const base64 = body.base64?.replace(/^data:[^;]+;base64,/, "").trim();

    if (!clientId || !base64) {
      return jsonResponse({ error: "Parâmetros inválidos" }, 400);
    }
    if (!ALLOWED_TYPES.has(contentType) && !contentType.startsWith("image/")) {
      return jsonResponse({ error: "Envie uma imagem (PNG, JPG, WebP ou SVG)." }, 400);
    }

    const { data: canAccess, error: accessError } = await userClient.rpc("can_access_client", {
      _client_id: clientId,
    });
    if (accessError) {
      return jsonResponse({ error: accessError.message }, 400);
    }
    if (!canAccess) {
      return jsonResponse({ error: "Sem permissão para este cliente" }, 403);
    }

    const bytes = decodeBase64(base64);
    if (bytes.byteLength > MAX_BYTES) {
      return jsonResponse({ error: "O logo deve ter no máximo 2 MB." }, 400);
    }

    const bucketReady = await ensureBucket(admin);
    if (!bucketReady.ok) {
      return jsonResponse({ error: `Não foi possível preparar o armazenamento: ${bucketReady.message}` }, 500);
    }

    const storagePath = `${clientId}/${crypto.randomUUID()}-${fileName}`;
    const { error: uploadError } = await admin.storage.from(BUCKET).upload(storagePath, bytes, {
      contentType,
      cacheControl: "3600",
      upsert: false,
    });
    if (uploadError) {
      return jsonResponse({ error: uploadError.message }, 400);
    }

    const { data: publicData } = admin.storage.from(BUCKET).getPublicUrl(storagePath);
    const logoUrl = publicData.publicUrl;

    const { error: updateError } = await admin
      .from("clients")
      .update({ logo_url: logoUrl, updated_at: new Date().toISOString() })
      .eq("id", clientId);
    if (updateError) {
      await admin.storage.from(BUCKET).remove([storagePath]);
      return jsonResponse({ error: updateError.message }, 400);
    }

    return jsonResponse({ logoUrl });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro ao enviar logo";
    return jsonResponse({ error: message }, 500);
  }
});
