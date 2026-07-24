export type BriefingQuestion = {
  id: string;
  label: string;
  helper?: string;
};

export type BriefingSection = {
  id: string;
  title: string;
  questions: BriefingQuestion[];
};

export type BriefingTemplate = {
  title: string;
  objective: string;
  sections: BriefingSection[];
};

/** Default strategic briefing (Marina Mazon model). Used when ensuring a client briefing. */
export const DEFAULT_BRAND_BRIEFING_TEMPLATE: BriefingTemplate = {
  title: "Briefing Estratégico – Conhecimento da Marca",
  objective:
    "Compreender profundamente a identidade, visão, prática e comunicação da marca para construir um sistema de produção de conteúdo fiel a ela.",
  sections: [
    {
      id: "identidade",
      title: "1. Identidade e Propósito",
      questions: [
        { id: "s1_q1", label: "Como você se apresenta profissionalmente em uma frase?" },
        { id: "s1_q2", label: "Qual é a missão do seu trabalho?" },
        { id: "s1_q3", label: "Que transformação deseja proporcionar às pessoas?" },
        { id: "s1_q4", label: "Quais valores são inegociáveis na sua atuação?" },
        { id: "s1_q5", label: "O que você nunca faria ou diria em sua prática?" },
      ],
    },
    {
      id: "trajetoria",
      title: "2. Trajetória",
      questions: [
        { id: "s2_q1", label: "Quais experiências mais marcaram sua formação?" },
        { id: "s2_q2", label: "Quais autores e abordagens influenciam sua prática?" },
        {
          id: "s2_q3",
          label: "Existe alguma história pessoal que explique sua escolha profissional?",
        },
      ],
    },
    {
      id: "gestalt",
      title: "3. Gestalt-terapia",
      questions: [
        { id: "s3_q1", label: "Como você define Gestalt-terapia em linguagem simples?" },
        { id: "s3_q2", label: "Quais conceitos utiliza com maior frequência?" },
        { id: "s3_q3", label: "Quais equívocos sobre Gestalt gostaria de combater?" },
      ],
    },
    {
      id: "publico",
      title: "4. Público",
      questions: [
        { id: "s4_q1", label: "Quem é seu cliente ideal?" },
        { id: "s4_q2", label: "Quais dores, dúvidas e desejos aparecem com mais frequência?" },
        { id: "s4_q3", label: "Quais temas são mais difíceis de abordar?" },
      ],
    },
    {
      id: "posicionamento",
      title: "5. Posicionamento",
      questions: [
        { id: "s5_q1", label: "Como você deseja ser percebida?" },
        {
          id: "s5_q2",
          label: "Quais perfis ou profissionais admira pela comunicação? Por quê?",
          helper: "Pode incluir perfis já enviados e acrescentar outros.",
        },
        { id: "s5_q3", label: "Quais perfis não representam sua forma de comunicar?" },
      ],
    },
    {
      id: "voz",
      title: "6. Voz da Marca",
      questions: [
        { id: "s6_q1", label: "Se sua comunicação fosse uma pessoa, como ela seria?" },
        { id: "s6_q2", label: "Quais palavras ou expressões usa com frequência?" },
        { id: "s6_q3", label: "Quais palavras ou clichês deseja evitar?" },
      ],
    },
    {
      id: "conteudo",
      title: "7. Conteúdo",
      questions: [
        { id: "s7_q1", label: "Quais são seus principais pilares de conteúdo?" },
        {
          id: "s7_q2",
          label: "Quais formatos prefere (carrossel, reels, stories, lives, textos)?",
        },
        { id: "s7_q3", label: "Quais assuntos gostaria de explorar mais?" },
      ],
    },
    {
      id: "etica",
      title: "8. Experiência Clínica e Ética",
      questions: [
        {
          id: "s8_q1",
          label: "Há temas que exigem maior cuidado ou contexto antes de publicar?",
        },
        { id: "s8_q2", label: "Quais limites éticos devem orientar qualquer conteúdo?" },
      ],
    },
    {
      id: "visual",
      title: "9. Identidade Visual",
      questions: [
        { id: "s9_q1", label: "O que seu guia de marca transmite emocionalmente?" },
        { id: "s9_q2", label: "Há referências visuais fora da psicologia que a inspiram?" },
      ],
    },
    {
      id: "objetivos",
      title: "10. Objetivos",
      questions: [
        { id: "s10_q1", label: "O que espera conquistar com o Instagram nos próximos 12 meses?" },
        { id: "s10_q2", label: "Como saberemos que a estratégia foi um sucesso?" },
      ],
    },
    {
      id: "ia",
      title: "11. IA Personalizada",
      questions: [
        {
          id: "s11_q1",
          label: "Se uma IA pudesse falar por você, o que ela jamais poderia esquecer?",
        },
        { id: "s11_q2", label: "Quais respostas ela nunca deveria dar?" },
        {
          id: "s11_q3",
          label: "Que livros, artigos, vídeos e materiais autorais devemos usar para treiná-la?",
        },
      ],
    },
    {
      id: "reflexivas",
      title: "12. Perguntas Reflexivas",
      questions: [
        {
          id: "s12_q1",
          label: "Qual crença profissional mais mudou ao longo da sua carreira?",
        },
        {
          id: "s12_q2",
          label: "Que mensagem você gostaria que alguém lembrasse cinco anos após conhecê-la?",
        },
        {
          id: "s12_q3",
          label:
            "Se pudesse deixar apenas um conteúdo publicado para representar seu trabalho, qual seria e por quê?",
        },
      ],
    },
  ],
};

export function countBriefingQuestions(template: BriefingTemplate): number {
  return template.sections.reduce((sum, section) => sum + section.questions.length, 0);
}

export function countAnsweredQuestions(
  template: BriefingTemplate,
  answers: Record<string, string>,
): number {
  let count = 0;
  for (const section of template.sections) {
    for (const question of section.questions) {
      if (answers[question.id]?.trim()) count += 1;
    }
  }
  return count;
}

export function parseBriefingTemplate(raw: unknown): BriefingTemplate {
  if (!raw || typeof raw !== "object") return DEFAULT_BRAND_BRIEFING_TEMPLATE;
  const value = raw as Partial<BriefingTemplate>;
  if (!Array.isArray(value.sections) || value.sections.length === 0) {
    return DEFAULT_BRAND_BRIEFING_TEMPLATE;
  }
  return {
    title: typeof value.title === "string" ? value.title : DEFAULT_BRAND_BRIEFING_TEMPLATE.title,
    objective:
      typeof value.objective === "string"
        ? value.objective
        : DEFAULT_BRAND_BRIEFING_TEMPLATE.objective,
    sections: value.sections as BriefingSection[],
  };
}

export function parseBriefingAnswers(raw: unknown): Record<string, string> {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    if (typeof value === "string") {
      out[key] = value;
    } else if (value && typeof value === "object" && "value" in value) {
      const nested = (value as { value?: unknown }).value;
      if (typeof nested === "string") out[key] = nested;
    }
  }
  return out;
}
