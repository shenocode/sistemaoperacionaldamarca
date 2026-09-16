export type LocucaoParts = {
  hook: string;
  body: string;
  cta: string;
};

export function formatLocucaoScript(parts: LocucaoParts): string {
  const hook = parts.hook.trim();
  const body = parts.body.trim();
  const cta = parts.cta.trim();
  if (!hook && !body && !cta) return "";
  if (!hook && !cta) return body;
  return [`HOOK\n${hook}`, `CORPO\n${body}`, `CTA\n${cta}`].join("\n\n").trim();
}

export function locucaoFromSuggestionFields(raw: Record<string, unknown>, locucaoFallback: string): string {
  const hook = typeof raw.locucao_hook === "string" ? raw.locucao_hook.trim() : "";
  const body = typeof raw.locucao_body === "string" ? raw.locucao_body.trim() : "";
  const cta = typeof raw.locucao_cta === "string" ? raw.locucao_cta.trim() : "";
  if (hook || body || cta) return formatLocucaoScript({ hook, body, cta });
  return locucaoFallback.trim();
}
