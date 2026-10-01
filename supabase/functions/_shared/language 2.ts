export function languageInstruction(locale?: string, mode: "copy" | "speak" = "copy"): string {
  const lower = (locale ?? "pt-BR").toLowerCase();
  if (mode === "speak") {
    if (lower.startsWith("en")) return "Speak in English (US).";
    if (lower.startsWith("es")) return "Habla en español.";
    return "Fale em português do Brasil.";
  }
  if (lower.startsWith("en")) return "Generate all copy in English (US).";
  if (lower.startsWith("es")) return "Genera todos los textos en español.";
  return "Gere textos em português do Brasil.";
}
