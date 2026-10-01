import type { BriefingTemplate } from "@/lib/brand-briefing-template";

/** Metadata template stored with project_site (UI uses the cliente-pro wizard). */
export const DEFAULT_SITE_BRIEFING_TEMPLATE: BriefingTemplate = {
  title: "Briefing do site",
  objective:
    "Respostas do formulário (cliente-pro) que alimentam o Prompt (PRD) para desenvolver o site no Lovable.",
  sections: [
    {
      id: "empresa",
      title: "Dados da empresa",
      questions: [
        { id: "nome", label: "Nome da empresa" },
        { id: "segmento", label: "Segmento" },
      ],
    },
    {
      id: "objetivo",
      title: "Objetivo do site",
      questions: [
        { id: "objetivos", label: "Objetivos" },
        { id: "ctas", label: "CTAs" },
      ],
    },
  ],
};

export function parseSiteBriefingTemplate(raw: unknown): BriefingTemplate {
  if (!raw || typeof raw !== "object") return DEFAULT_SITE_BRIEFING_TEMPLATE;
  const value = raw as Partial<BriefingTemplate>;
  if (!Array.isArray(value.sections) || value.sections.length === 0) {
    return DEFAULT_SITE_BRIEFING_TEMPLATE;
  }
  return {
    title: typeof value.title === "string" ? value.title : DEFAULT_SITE_BRIEFING_TEMPLATE.title,
    objective:
      typeof value.objective === "string"
        ? value.objective
        : DEFAULT_SITE_BRIEFING_TEMPLATE.objective,
    sections: value.sections as BriefingTemplate["sections"],
  };
}
