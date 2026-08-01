import { getRequest } from "@tanstack/react-start/server";

/**
 * Calls a privileged Edge Function on Lovable Cloud using the caller's JWT.
 * Keeps the service role key out of the hosting environment (e.g. Netlify).
 */
export async function callAdminEdge<T>(
  functionName: "admin-team" | "admin-assinantes",
  action: string,
  payload?: unknown,
): Promise<T> {
  const supabaseUrl = process.env["SUPABASE_URL"];
  const publishableKey = process.env["SUPABASE_PUBLISHABLE_KEY"];
  if (!supabaseUrl || !publishableKey) {
    throw new Error("Configuração do backend ausente (SUPABASE_URL / chave pública).");
  }

  const authHeader = getRequest()?.headers?.get("authorization");
  if (!authHeader) throw new Error("Não autenticado");

  const response = await fetch(`${supabaseUrl}/functions/v1/${functionName}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: publishableKey,
      Authorization: authHeader,
    },
    body: JSON.stringify({ action, payload: payload ?? {} }),
  });

  const body = (await response.json().catch(() => null)) as
    | { data?: T; error?: string }
    | null;

  if (!response.ok || body?.error) {
    throw new Error(body?.error ?? `Falha na operação (${response.status}).`);
  }

  return body?.data as T;
}
