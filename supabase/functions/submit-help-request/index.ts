// deno-lint-ignore-file no-explicit-any
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { corsHeaders, jsonResponse } from "../_shared/cors.ts";
import { isAdminMasterEmail, ADMIN_MASTER_EMAIL } from "../_shared/admin-master.ts";

const BUCKET = "help-attachments";
const MAX_BYTES = 5 * 1024 * 1024;

type Body = {
  message?: string;
  clientId?: string;
  locale?: string;
  attachment?: {
    fileName?: string;
    contentType?: string;
    base64?: string;
  } | null;
};

function sanitizeFileName(name: string) {
  return name.replace(/[^\w.\-()+ ]+/g, "_").replace(/\s+/g, "-").slice(0, 120);
}

function decodeBase64(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

async function findAdminMasterId(admin: any): Promise<string | null> {
  let page = 1;
  for (;;) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw new Error(error.message);
    const match = data.users.find(
      (u: any) => isAdminMasterEmail(u.email),
    );
    if (match?.id) return match.id;
    const lastPage = (data as any).lastPage ?? page;
    if (page >= lastPage || data.users.length === 0) return null;
    page += 1;
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse({ error: "Method not allowed" }, 405);

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !anonKey || !serviceRoleKey) {
      return jsonResponse({ error: "Supabase env missing" }, 500);
    }

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return jsonResponse({ error: "Não autenticado" }, 401);

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data: userData, error: userError } = await userClient.auth.getUser();
    const user = userData?.user;
    if (userError || !user) return jsonResponse({ error: "Não autenticado" }, 401);

    const body = (await req.json().catch(() => ({}))) as Body;
    const message = (body.message ?? "").trim();
    const locale = body.locale?.trim().slice(0, 32) || null;
    if (!message || message.length > 5000) {
      return jsonResponse({ error: "Mensagem inválida" }, 400);
    }

    const { data: isAdmin, error: roleError } = await userClient.rpc("has_role", {
      _user_id: user.id,
      _role: "admin",
    });
    if (roleError) return jsonResponse({ error: roleError.message }, 400);

    let kind: "gestor_platform" | "client_gestor";
    let recipientUserId: string | null = null;
    let clientId: string | null = null;

    if (isAdmin) {
      kind = "gestor_platform";
      if (isAdminMasterEmail(user.email)) {
        return jsonResponse({ error: "O admin master não pode abrir chamado para si mesmo." }, 400);
      }
      recipientUserId = await findAdminMasterId(admin);
      if (!recipientUserId) {
        return jsonResponse({ error: `Admin master (${ADMIN_MASTER_EMAIL}) não encontrado.` }, 400);
      }
    } else {
      kind = "client_gestor";
      clientId = body.clientId?.trim() || null;
      if (!clientId) return jsonResponse({ error: "clientId é obrigatório" }, 400);

      const { data: canAccess, error: accessError } = await userClient.rpc("can_access_client", {
        _client_id: clientId,
      });
      if (accessError) return jsonResponse({ error: accessError.message }, 400);
      if (!canAccess) return jsonResponse({ error: "Sem permissão para este cliente" }, 403);

      const { data: client, error: clientError } = await admin
        .from("clients")
        .select("id, created_by")
        .eq("id", clientId)
        .maybeSingle();
      if (clientError) return jsonResponse({ error: clientError.message }, 400);
      if (!client) return jsonResponse({ error: "Cliente não encontrado" }, 404);

      recipientUserId = (client as any).created_by ?? null;
      if (!recipientUserId) {
        const { data: owner } = await admin
          .from("client_members")
          .select("user_id")
          .eq("client_id", clientId)
          .eq("role", "owner")
          .order("created_at", { ascending: true })
          .limit(1)
          .maybeSingle();
        recipientUserId = (owner as any)?.user_id ?? null;
      }
      if (!recipientUserId) {
        return jsonResponse({ error: "Nenhum gestor vinculado a este cliente." }, 400);
      }
    }

    // Optional attachment
    let attachmentPath: string | null = null;
    let attachmentName: string | null = null;
    let attachmentMime: string | null = null;

    const att = body.attachment;
    if (att?.base64) {
      const base64 = att.base64.replace(/^data:[^;]+;base64,/, "").trim();
      const bytes = decodeBase64(base64);
      if (bytes.byteLength > MAX_BYTES) {
        return jsonResponse({ error: "O anexo deve ter no máximo 5 MB." }, 400);
      }
      attachmentName = sanitizeFileName(att.fileName || "anexo");
      attachmentMime = (att.contentType || "application/octet-stream").trim();
      attachmentPath = `${user.id}/${crypto.randomUUID()}-${attachmentName}`;
      const { error: uploadError } = await admin.storage
        .from(BUCKET)
        .upload(attachmentPath, bytes, {
          contentType: attachmentMime,
          upsert: false,
        });
      if (uploadError) return jsonResponse({ error: uploadError.message }, 400);
    }

    const { data: inserted, error: insertError } = await admin
      .from("help_requests")
      .insert({
        kind,
        sender_user_id: user.id,
        sender_email: user.email ?? "",
        recipient_user_id: recipientUserId,
        client_id: clientId,
        message,
        locale,
        attachment_storage_path: attachmentPath,
        attachment_file_name: attachmentName,
        attachment_mime_type: attachmentMime,
      })
      .select("id")
      .single();

    if (insertError) {
      if (attachmentPath) await admin.storage.from(BUCKET).remove([attachmentPath]);
      return jsonResponse({ error: insertError.message }, 400);
    }

    return jsonResponse({ data: { id: (inserted as any).id } });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro interno";
    console.error("submit-help-request:", message);
    return jsonResponse({ error: message }, 400);
  }
});
