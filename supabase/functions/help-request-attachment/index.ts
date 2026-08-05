import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { corsHeaders, jsonResponse } from "../_shared/cors.ts";
import { isAdminMasterEmail } from "../_shared/admin-master.ts";

const BUCKET = "help-attachments";
const SIGNED_SECONDS = 3600;

type RequestBody = {
  requestId?: string;
};

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
    const requestId = body.requestId?.trim();
    if (!requestId) {
      return jsonResponse({ error: "Pedido inválido." }, 400);
    }

    const { data: row, error: rowError } = await admin
      .from("help_requests")
      .select(
        "id, kind, sender_user_id, recipient_user_id, attachment_storage_path, attachment_file_name",
      )
      .eq("id", requestId)
      .maybeSingle();

    if (rowError) return jsonResponse({ error: rowError.message }, 400);
    if (!row?.attachment_storage_path) {
      return jsonResponse({ error: "Este pedido não tem anexo." }, 404);
    }

    const isRecipient = row.recipient_user_id === user.id;
    const isSender = row.sender_user_id === user.id;
    const isMasterForPlatform =
      row.kind === "gestor_platform" && isAdminMasterEmail(user.email);

    if (!isRecipient && !isSender && !isMasterForPlatform) {
      return jsonResponse({ error: "Sem permissão." }, 403);
    }

    const { data: signed, error: signError } = await admin.storage
      .from(BUCKET)
      .createSignedUrl(row.attachment_storage_path, SIGNED_SECONDS);

    if (signError || !signed?.signedUrl) {
      return jsonResponse({ error: signError?.message ?? "Não foi possível gerar o link." }, 500);
    }

    return jsonResponse({
      url: signed.signedUrl,
      fileName: row.attachment_file_name ?? "anexo",
    });
  } catch (err) {
    console.error("help-request-attachment:", err);
    return jsonResponse({ error: "Erro interno" }, 500);
  }
});
