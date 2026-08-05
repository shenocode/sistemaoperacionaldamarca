import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { corsHeaders, jsonResponse } from "../_shared/cors.ts";
import { ADMIN_MASTER_EMAIL } from "../_shared/admin-master.ts";

const BUCKET = "help-attachments";
const MAX_MESSAGE = 5000;
const MIN_MESSAGE = 10;
const MAX_BYTES = 10 * 1024 * 1024;

const ALLOWED_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
  "image/heic",
  "image/heif",
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "text/plain",
]);

type AttachmentBody = {
  fileName?: string;
  contentType?: string;
  base64?: string;
};

type RequestBody = {
  message?: string;
  clientId?: string;
  locale?: string;
  attachment?: AttachmentBody;
};

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

async function userIsAdmin(userClient: ReturnType<typeof createClient>, userId: string): Promise<boolean> {
  const { data, error } = await userClient
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "admin")
    .maybeSingle();
  if (error) return false;
  return Boolean(data);
}

async function resolveAdminMasterUserId(admin: ReturnType<typeof createClient>): Promise<string> {
  const { data, error } = await admin.auth.admin.listUsers({ perPage: 1000 });
  if (error) throw new Error(error.message);
  const match = (data.users ?? []).find(
    (u) => (u.email ?? "").trim().toLowerCase() === ADMIN_MASTER_EMAIL,
  );
  if (!match?.id) throw new Error("Administrador da plataforma não encontrado.");
  return match.id;
}

async function resolveClientGestorUserId(
  admin: ReturnType<typeof createClient>,
  clientId: string,
): Promise<string> {
  const { data: client, error: clientError } = await admin
    .from("clients")
    .select("created_by")
    .eq("id", clientId)
    .maybeSingle();
  if (clientError) throw new Error(clientError.message);
  if (!client) throw new Error("Cliente não encontrado.");

  const { data: owners, error: ownersError } = await admin
    .from("client_members")
    .select("user_id")
    .eq("client_id", clientId)
    .eq("role", "owner");
  if (ownersError) throw new Error(ownersError.message);

  const ownerIds = (owners ?? []).map((row) => row.user_id as string);
  const preferredId =
    (client.created_by && ownerIds.includes(client.created_by) ? client.created_by : null) ??
    client.created_by ??
    ownerIds[0] ??
    null;

  if (!preferredId) throw new Error("Gestor deste cliente não encontrado.");
  return preferredId;
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
      return jsonResponse({ error: "Supabase não configurado" }, 500);
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

    const body = (await req.json().catch(() => ({}))) as RequestBody;
    const message = body.message?.trim() ?? "";
    const locale = body.locale?.trim().slice(0, 32) || null;
    const clientId = body.clientId?.trim() || null;

    if (message.length < MIN_MESSAGE || message.length > MAX_MESSAGE) {
      return jsonResponse({ error: "Descreva o problema (mínimo 10 caracteres)." }, 400);
    }

    const isAdmin = await userIsAdmin(userClient, user.id);
    let kind: "gestor_platform" | "client_gestor";
    let recipientUserId: string;
    let resolvedClientId: string | null = null;

    if (isAdmin) {
      kind = "gestor_platform";
      recipientUserId = await resolveAdminMasterUserId(admin);
      if (recipientUserId === user.id) {
        return jsonResponse({ error: "Use outro canal para falar consigo mesmo." }, 400);
      }
    } else {
      if (!clientId) {
        return jsonResponse({ error: "Selecione a marca." }, 400);
      }
      const { data: canAccess, error: accessError } = await userClient.rpc("can_access_client", {
        _client_id: clientId,
      });
      if (accessError) {
        return jsonResponse({ error: accessError.message }, 400);
      }
      if (!canAccess) {
        return jsonResponse({ error: "Sem permissão para esta marca." }, 403);
      }
      kind = "client_gestor";
      recipientUserId = await resolveClientGestorUserId(admin, clientId);
      resolvedClientId = clientId;
    }

    const senderEmail = (user.email ?? "").trim().toLowerCase();
    if (!senderEmail) {
      return jsonResponse({ error: "E-mail da conta não encontrado." }, 400);
    }

    const { data: inserted, error: insertError } = await admin
      .from("help_requests")
      .insert({
        kind,
        sender_user_id: user.id,
        sender_email: senderEmail,
        recipient_user_id: recipientUserId,
        client_id: resolvedClientId,
        message,
        locale,
      })
      .select("id")
      .single();

    if (insertError || !inserted) {
      console.error("help_requests insert:", insertError?.message);
      return jsonResponse({ error: "Falha ao enviar o pedido." }, 500);
    }

    const requestId = inserted.id as string;

    const attachment = body.attachment;
    const base64 = attachment?.base64?.replace(/^data:[^;]+;base64,/, "").trim();
    if (base64) {
      const contentType = (attachment?.contentType || "application/octet-stream").trim();
      const fileName = sanitizeFileName(attachment?.fileName || "anexo");
      if (!ALLOWED_TYPES.has(contentType)) {
        await admin.from("help_requests").delete().eq("id", requestId);
        return jsonResponse(
          { error: "Formato não permitido. Envie imagem, PDF ou documento de texto." },
          400,
        );
      }
      const bytes = decodeBase64(base64);
      if (bytes.byteLength > MAX_BYTES) {
        await admin.from("help_requests").delete().eq("id", requestId);
        return jsonResponse({ error: "O anexo deve ter no máximo 10 MB." }, 400);
      }

      const attachmentStoragePath = `${requestId}/${crypto.randomUUID()}-${fileName}`;
      const { error: uploadError } = await admin.storage
        .from(BUCKET)
        .upload(attachmentStoragePath, bytes, {
          contentType,
          upsert: false,
        });
      if (uploadError) {
        await admin.from("help_requests").delete().eq("id", requestId);
        return jsonResponse({ error: uploadError.message }, 400);
      }

      const { error: updateError } = await admin
        .from("help_requests")
        .update({
          attachment_storage_path: attachmentStoragePath,
          attachment_file_name: fileName,
          attachment_mime_type: contentType,
        })
        .eq("id", requestId);
      if (updateError) {
        await admin.storage.from(BUCKET).remove([attachmentStoragePath]);
        await admin.from("help_requests").delete().eq("id", requestId);
        return jsonResponse({ error: updateError.message }, 500);
      }
    }

    return jsonResponse({ ok: true, id: requestId });
  } catch (err) {
    console.error("submit-help-request:", err);
    const msg = err instanceof Error ? err.message : "Erro interno";
    return jsonResponse({ error: msg }, 500);
  }
});
