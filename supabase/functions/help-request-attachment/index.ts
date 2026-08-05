// deno-lint-ignore-file no-explicit-any
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { corsHeaders, jsonResponse } from "../_shared/cors.ts";
import { isAdminMasterEmail } from "../_shared/admin-master.ts";

const BUCKET = "help-attachments";
const EXPIRES_IN = 60 * 10;

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

    const body = (await req.json().catch(() => ({}))) as { requestId?: string };
    const requestId = body.requestId?.trim();
    if (!requestId) return jsonResponse({ error: "requestId é obrigatório" }, 400);

    const { data: row, error: rowError } = await admin
      .from("help_requests")
      .select(
        "id, kind, sender_user_id, recipient_user_id, attachment_storage_path, attachment_file_name",
      )
      .eq("id", requestId)
      .maybeSingle();
    if (rowError) return jsonResponse({ error: rowError.message }, 400);
    if (!row) return jsonResponse({ error: "Pedido não encontrado" }, 404);

    const record = row as any;
    const isMaster = isAdminMasterEmail(user.email);
    const allowed =
      record.recipient_user_id === user.id ||
      record.sender_user_id === user.id ||
      (isMaster && record.kind === "gestor_platform");
    if (!allowed) return jsonResponse({ error: "Sem permissão" }, 403);

    if (!record.attachment_storage_path) {
      return jsonResponse({ error: "Este pedido não possui anexo." }, 404);
    }

    const { data: signed, error: signError } = await admin.storage
      .from(BUCKET)
      .createSignedUrl(record.attachment_storage_path, EXPIRES_IN, {
        download: record.attachment_file_name ?? undefined,
      });
    if (signError || !signed?.signedUrl) {
      return jsonResponse({ error: signError?.message ?? "Falha ao gerar link" }, 400);
    }

    return jsonResponse({
      data: {
        url: signed.signedUrl,
        fileName: record.attachment_file_name,
        expiresIn: EXPIRES_IN,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro interno";
    console.error("help-request-attachment:", message);
    return jsonResponse({ error: message }, 400);
  }
});
