export type LocucaoParts = {
  hook: string;
  body: string;
  cta: string;
};

const SECTION =
  /^(HOOK|GANCHO|CORPO|BODY|CTA)\s*[:\-]?\s*$/i;

export function formatLocucaoScript(parts: LocucaoParts): string {
  const hook = parts.hook.trim();
  const body = parts.body.trim();
  const cta = parts.cta.trim();
  if (!hook && !body && !cta) return "";
  if (!hook && !cta) return body;
  return [`HOOK\n${hook}`, `CORPO\n${body}`, `CTA\n${cta}`].join("\n\n").trim();
}

export function parseLocucaoScript(text: string): LocucaoParts {
  const raw = (text ?? "").replace(/\r\n/g, "\n").trim();
  if (!raw) return { hook: "", body: "", cta: "" };

  const lines = raw.split("\n");
  const buckets: Record<"hook" | "body" | "cta", string[]> = {
    hook: [],
    body: [],
    cta: [],
  };
  let current: keyof typeof buckets | null = null;
  let sawHeading = false;

  for (const line of lines) {
    const heading = line.trim().match(SECTION);
    if (heading) {
      sawHeading = true;
      const key = heading[1].toUpperCase();
      current = key === "HOOK" || key === "GANCHO" ? "hook" : key === "CTA" ? "cta" : "body";
      continue;
    }
    if (current) buckets[current].push(line);
  }

  if (!sawHeading) return { hook: "", body: raw, cta: "" };

  return {
    hook: buckets.hook.join("\n").trim(),
    body: buckets.body.join("\n").trim(),
    cta: buckets.cta.join("\n").trim(),
  };
}

export function locucaoPartsFromSuggestion(input: {
  locucao?: string;
  locucaoHook?: string;
  locucaoBody?: string;
  locucaoCta?: string;
}): LocucaoParts {
  const hook = input.locucaoHook?.trim() ?? "";
  const body = input.locucaoBody?.trim() ?? "";
  const cta = input.locucaoCta?.trim() ?? "";
  if (hook || body || cta) return { hook, body, cta };
  return parseLocucaoScript(input.locucao ?? "");
}
