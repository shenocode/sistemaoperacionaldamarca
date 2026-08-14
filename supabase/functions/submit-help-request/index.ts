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

/** App-level failures as HTTP 200 so supabase-js keeps the body in `data`. */
function fail(error: string) {
  return jsonResponse({ ok: false, error }, 200);
}

function sanitizeFileName(name: string) {
  return name.replace(/[^\w.\-()+ ]+/g, "_").replace(/\s+/g, "-").slice(0, 120);
}

function resolveContentType(fileName: string, contentType?: string): string {
  const ct = (contentType || "").trim().toLowerCase();
  if (ct && ct !== "application/octet-stream") return ct;
  const ext = fileName.split(".").pop()?.toLowerCase() ?? "";
  const byExt: Record<string, string> = {
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    png: "image/png",
    gif: "image/gif",
    webp: "image/webp",
    heic: "image/heic",
    heif: "image/heif",
    pdf: "application/pdf",
    doc: "application/msword",
    docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    txt: "text/plain",
  };
  return byExt[ext] || ct || "application/octet-stream";
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
  admin: ReturnType<typeof createClient>,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const { data: buckets, error: listError } = await admin.storage.listBuckets();
  if (listError) return { ok: false, message: listError.message };

  const exists = (buckets ?? []).some((bucket) => bucket.id === BUCKET || bucket.name === BUCKET);
  if (exists) {
    await admin.storage.updateBucket(BUCKET, {
      public: false,
      fileSizeLimit: MAX_BYTES,
      allowedMimeTypes: [...ALLOWED_TYPES],
    });
    return { ok: true };
  }

  const { error: createError } = await admin.storage.createBucket(BUCKET, {
    public: false,
    fileSizeLimit: MAX_BYTES,
    allowedMimeTypes: [...ALLOWED_TYPES],
  });
  if (createError && !/already exists|duplicate/i.test(createError.message)) {
    return { ok: false, message: createError.message };
  }
  return { ok: true };
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
    return fail("Method not allowed");
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !supabaseAnonKey || !serviceRoleKey) {
      return fail("Supabase não configurado");
    }

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return fail("Não autenticado");
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
      return fail("Não autenticado");
    }

    const body = (await req.json().catch(() => ({}))) as RequestBody;
    const message = body.message?.trim() ?? "";
    const locale = body.locale?.trim().slice(0, 32) || null;
    const clientId = body.clientId?.trim() || null;

    if (message.length < MIN_MESSAGE || message.length > MAX_MESSAGE) {
      return fail("Descreva o problema (mínimo 10 caracteres).");
    }

    const isAdmin = await userIsAdmin(userClient, user.id);
    let kind: "gestor_platform" | "client_gestor";
    let recipientUserId: string;
    let resolvedClientId: string | null = null;

    if (isAdmin) {
      kind = "gestor_platform";
      recipientUserId = await resolveAdminMasterUserId(admin);
      if (recipientUserId === user.id) {
        return fail("Use outro canal para falar consigo mesmo.");
      }
    } else {
      if (!clientId) {
        return fail("Selecione a marca.");
      }
      const { data: canAccess, error: accessError } = await userClient.rpc("can_access_client", {
        _client_id: clientId,
      });
      if (accessError) {
        return fail(accessError.message);
      }
      if (!canAccess) {
        return fail("Sem permissão para esta marca.");
      }
      kind = "client_gestor";
      recipientUserId = await resolveClientGestorUserId(admin, clientId);
      if (recipientUserId === user.id) {
        return fail("Não é possível enviar o pedido para a própria conta.");
      }
      resolvedClientId = clientId;
    }

    const senderEmail = (user.email ?? "").trim().toLowerCase();
    if (!senderEmail) {
      return fail("E-mail da conta não encontrado.");
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
      const detail = insertError?.message ?? "";
      const missingTable = /relation .*help_requests.* does not exist|Could not find the table/i.test(
        detail,
      );
      if (missingTable) {
        return fail(
          "Tabela de ajuda ainda não existe. Execute a migration help_requests no Cloud (SQL Editor).",
        );
      }
      return fail(detail ? `Falha ao enviar o pedido: ${detail}` : "Falha ao enviar o pedido.");
    }

    const requestId = inserted.id as string;

    const attachment = body.attachment;
    const base64 = attachment?.base64?.replace(/^data:[^;]+;base64,/, "").trim();
    if (base64) {
      const fileName = sanitizeFileName(attachment?.fileName || "anexo");
      const contentType = resolveContentType(fileName, attachment?.contentType);
      if (!ALLOWED_TYPES.has(contentType)) {
        await admin.from("help_requests").delete().eq("id", requestId);
        return fail("Formato não permitido. Envie imagem, PDF ou documento de texto.");
      }
      const bytes = decodeBase64(base64);
      if (bytes.byteLength > MAX_BYTES) {
        await admin.from("help_requests").delete().eq("id", requestId);
        return fail("O anexo deve ter no máximo 10 MB.");
      }

      const bucketReady = await ensureBucket(admin);
      if (!bucketReady.ok) {
        await admin.from("help_requests").delete().eq("id", requestId);
        return fail(
          "Armazenamento de anexos ainda não configurado. Execute a migration de help_requests no Cloud.",
        );
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
        const bucketMissing = /bucket not found/i.test(uploadError.message);
        return fail(
          bucketMissing
            ? "Armazenamento de anexos ainda não configurado. Execute a migration de help_requests no Cloud."
            : `Falha no anexo: ${uploadError.message}`,
        );
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
        return fail(`Falha ao salvar anexo: ${updateError.message}`);
      }
    }

    return jsonResponse({ ok: true, id: requestId });
  } catch (err) {
    console.error("submit-help-request:", err);
    const msg = err instanceof Error ? err.message : "Erro interno";
    return fail(msg);
  }
});
