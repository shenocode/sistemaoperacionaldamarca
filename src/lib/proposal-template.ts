/** Structured commercial proposal template (Japiapé-inspired). */

export type ProposalBlockType = "paragraph" | "callout" | "bullets" | "table" | "steps";

export type ProposalBlock =
  | { id: string; type: "paragraph"; text: string }
  | { id: string; type: "callout"; label: string; text: string }
  | { id: string; type: "bullets"; items: string[] }
  | {
      id: string;
      type: "table";
      headers: string[];
      rows: string[][];
    }
  | { id: string; type: "steps"; items: string[] };

export type ProposalSection = {
  id: string;
  key: string;
  number: number;
  title: string;
  visible: boolean;
  blocks: ProposalBlock[];
};

export type InvestmentItem = {
  id: string;
  front: string;
  model: string;
  amount: string;
  note?: string;
};

export type CommercialTerms = {
  validityDays: string;
  payment: string;
  notes: string;
  nextSteps: string[];
  clientSignLabel: string;
  contractorSignLabel: string;
};

export type ProposalDraftFields = {
  title: string;
  subtitle: string;
  scope_summary: string;
  proposal_month: string;
  cover_image_url: string | null;
  sections: ProposalSection[];
  investment_items: InvestmentItem[];
  commercial_terms: CommercialTerms;
  status: "draft" | "ready";
};

function bid(prefix: string) {
  return `${prefix}-${crypto.randomUUID().slice(0, 8)}`;
}

export function createDefaultCommercialTerms(clientName = ""): CommercialTerms {
  return {
    validityDays: "15",
    payment: "",
    notes:
      "Taxas de plataformas de pagamento, domínio, hospedagem e ferramentas de terceiros não estão incluídas e deverão ser contratadas conforme a evolução do projeto.",
    nextSteps: [
      "Validar os escopos e priorizar as frentes de implantação.",
      "Definir investimento, condições comerciais e responsáveis por cada aprovação.",
      "Enviar logotipo, informações institucionais, fotos disponíveis e acessos necessários.",
      "Agendar reunião de início para organizar o conteúdo e o cronograma.",
      "Apresentar a plataforma SOM — Sistema Operacional da Marca para gestão e aprovação dos materiais.",
    ],
    clientSignLabel: clientName || "Cliente",
    contractorSignLabel: "Contratada",
  };
}

export function createDefaultInvestmentItems(): InvestmentItem[] {
  return [
    {
      id: bid("inv"),
      front: "Site institucional",
      model: "Projeto único",
      amount: "",
    },
    {
      id: bid("inv"),
      front: "Produção para Instagram",
      model: "Mensal",
      amount: "",
    },
    {
      id: bid("inv"),
      front: "Automação de WhatsApp",
      model: "Implantação",
      amount: "",
    },
  ];
}

export function createDefaultProposalSections(clientName = "a cliente"): ProposalSection[] {
  const name = clientName.trim() || "a cliente";
  return [
    {
      id: "sec-apresentacao",
      key: "apresentacao",
      number: 1,
      title: "Apresentação",
      visible: true,
      blocks: [
        {
          id: bid("p"),
          type: "paragraph",
          text: `Esta proposta apresenta um plano de evolução digital para ${name}, unindo comunicação, atendimento e conversão em uma jornada progressiva.`,
        },
        {
          id: bid("c"),
          type: "callout",
          label: "Direção estratégica",
          text: "Transformar os diferenciais da marca em uma presença digital clara, inspiradora e orientada a resultados.",
        },
      ],
    },
    {
      id: "sec-sobre",
      key: "sobre",
      number: 2,
      title: "Sobre a cliente",
      visible: true,
      blocks: [
        {
          id: bid("p"),
          type: "paragraph",
          text: `Descreva o negócio de ${name}: segmento, tempo de mercado, principais serviços e públicos.`,
        },
        {
          id: bid("t"),
          type: "table",
          headers: ["Ativo", "Valor para a comunicação"],
          rows: [
            ["Tradição", ""],
            ["Experiências", ""],
            ["Públicos", ""],
            ["Diferenciais", ""],
          ],
        },
      ],
    },
    {
      id: "sec-diagnostico",
      key: "diagnostico",
      number: 3,
      title: "Diagnóstico digital atual",
      visible: true,
      blocks: [
        {
          id: bid("p"),
          type: "paragraph",
          text: "Descreva a presença digital atual (site, Instagram, WhatsApp) e os principais gargalos.",
        },
        {
          id: bid("b"),
          type: "bullets",
          items: [
            "Necessidade de banco de imagens profissional.",
            "Oportunidade de organizar serviços com chamadas claras para contato e reserva.",
            "Potencial de simplificar o atendimento inicial no WhatsApp.",
          ],
        },
      ],
    },
    {
      id: "sec-objetivos",
      key: "objetivos",
      number: 4,
      title: "Objetivos do projeto",
      visible: true,
      blocks: [
        {
          id: bid("t"),
          type: "table",
          headers: ["Objetivo", "Resultado esperado"],
          rows: [
            ["Fortalecer a presença institucional", "Apresentar a marca com clareza e apelo visual."],
            ["Organizar a comunicação", "Criar rotina editorial coerente e constante."],
            ["Qualificar o atendimento", "Automatizar dúvidas recorrentes e manter opção humana."],
            ["Preparar a venda online", "Criar caminho seguro para reservas e conversões."],
          ],
        },
      ],
    },
    {
      id: "sec-site",
      key: "site",
      number: 5,
      title: "Proposta — site institucional",
      visible: true,
      blocks: [
        {
          id: bid("p"),
          type: "paragraph",
          text: "Site institucional responsivo para apresentar a marca, valorizar experiências e gerar contatos qualificados.",
        },
        {
          id: bid("t"),
          type: "table",
          headers: ["Seção", "Conteúdo e função"],
          rows: [
            ["Home", "Mensagem principal, imagens de impacto e chamadas para ação."],
            ["Sobre", "História, posicionamento e diferenciais."],
            ["Serviços", "Ofertas organizadas com contato e reserva."],
            ["Galeria", "Fotos dos espaços, produtos e experiências."],
            ["Contato", "WhatsApp, formulário, mapa e redes sociais."],
          ],
        },
        {
          id: bid("b"),
          type: "bullets",
          items: [
            "Planejamento da arquitetura e organização do conteúdo.",
            "Design personalizado e versão responsiva.",
            "Botões de contato direcionados ao WhatsApp.",
            "Otimização básica para mecanismos de busca (SEO).",
          ],
        },
      ],
    },
    {
      id: "sec-reservas",
      key: "reservas",
      number: 6,
      title: "Evolução futura — reservas e pagamentos",
      visible: true,
      blocks: [
        {
          id: bid("p"),
          type: "paragraph",
          text: "Após a consolidação do site institucional, recomenda-se evoluir para reservas e pagamentos online nos produtos com demanda clara.",
        },
        {
          id: bid("s"),
          type: "steps",
          items: [
            "Visitante consulta informações e escolhe o produto/serviço.",
            "Seleciona data, quantidade e dados de contato.",
            "Confirma a solicitação de reserva.",
            "Realiza o pagamento por Pix e/ou cartão.",
            "Recebe confirmação automática e instruções.",
          ],
        },
      ],
    },
    {
      id: "sec-instagram",
      key: "instagram",
      number: 7,
      title: "Proposta — produção para Instagram",
      visible: true,
      blocks: [
        {
          id: bid("p"),
          type: "paragraph",
          text: "Gestão mensal para dar consistência à presença online, mostrar experiências e orientar o público para contato e conversão.",
        },
        {
          id: bid("c"),
          type: "callout",
          label: "Sugestão",
          text: "8 publicações/mês, 2 por semana.",
        },
        {
          id: bid("t"),
          type: "table",
          headers: ["Formato", "Qtd.", "Foco"],
          rows: [
            ["Carrosséis", "4", "Informativo, serviços, agenda e experiências."],
            ["Estáticos", "2", "Chamadas diretas e conteúdos institucionais."],
            ["Reels", "2", "Vídeos curtos de bastidores e experiências."],
          ],
        },
      ],
    },
    {
      id: "sec-whatsapp",
      key: "whatsapp",
      number: 8,
      title: "Proposta — automação de WhatsApp",
      visible: true,
      blocks: [
        {
          id: bid("p"),
          type: "paragraph",
          text: "Automação simples para organizar a primeira resposta, reduzir dúvidas repetitivas e encaminhar ao atendimento humano quando necessário.",
        },
        {
          id: bid("t"),
          type: "table",
          headers: ["Etapa", "Experiência do visitante"],
          rows: [
            ["Boas-vindas", "Mensagem de recepção e apresentação da marca."],
            ["Menu inicial", "Opções de interesse por serviço."],
            ["Triagem", "Respostas rápidas, links e opção “fale com um humano”."],
            ["Handoff", "Encaminhamento claro para a equipe."],
          ],
        },
      ],
    },
    {
      id: "sec-cronograma",
      key: "cronograma",
      number: 9,
      title: "Cronograma sugerido",
      visible: true,
      blocks: [
        {
          id: bid("t"),
          type: "table",
          headers: ["Fase", "Prazo estimado", "Principais entregas"],
          rows: [
            ["1. Preparação", "Semana 1", "Reunião de início e levantamento de materiais."],
            ["2. Site institucional", "Semanas 2 a 5", "Arquitetura, design, conteúdo e publicação."],
            ["3. Instagram", "A partir da Semana 5", "Planejamento editorial e rotina de publicações."],
            ["4. WhatsApp", "Semana 5", "Fluxo, configuração e testes da automação."],
            ["5. Reservas", "Fase posterior", "Implantação após validação do site."],
          ],
        },
        {
          id: bid("p"),
          type: "paragraph",
          text: "Os prazos dependem do envio e da aprovação dos materiais pela cliente.",
        },
      ],
    },
    {
      id: "sec-investimento",
      key: "investimento",
      number: 10,
      title: "Investimento",
      visible: true,
      blocks: [
        {
          id: bid("p"),
          type: "paragraph",
          text: "Os valores detalhados estão na tabela de investimento abaixo. Ajuste as frentes conforme o escopo contratado.",
        },
      ],
    },
    {
      id: "sec-proximos",
      key: "proximos",
      number: 11,
      title: "Próximos passos",
      visible: true,
      blocks: [
        {
          id: bid("p"),
          type: "paragraph",
          text: "Os próximos passos estão listados nas condições comerciais ao final desta proposta.",
        },
      ],
    },
    {
      id: "sec-assinatura",
      key: "assinatura",
      number: 12,
      title: "Assinatura",
      visible: true,
      blocks: [
        {
          id: bid("p"),
          type: "paragraph",
          text: "Ao aprovar esta proposta, as partes reconhecem o escopo inicial descrito e seguem para a formalização das condições comerciais, cronograma e contratação.",
        },
      ],
    },
  ];
}

export function createBlankProposalDraft(clientName = ""): ProposalDraftFields {
  const month = new Intl.DateTimeFormat("pt-BR", {
    month: "long",
    year: "numeric",
  }).format(new Date());
  return {
    title: "PROPOSTA COMERCIAL",
    subtitle: "Presença digital, relacionamento e vendas online",
    scope_summary:
      "Escopo da proposta. Site institucional, produção para Instagram e automação de WhatsApp.",
    proposal_month: month.charAt(0).toUpperCase() + month.slice(1),
    cover_image_url: null,
    sections: createDefaultProposalSections(clientName),
    investment_items: createDefaultInvestmentItems(),
    commercial_terms: createDefaultCommercialTerms(clientName),
    status: "draft",
  };
}

export function parseProposalSections(value: unknown): ProposalSection[] {
  if (!Array.isArray(value)) return createDefaultProposalSections();
  return value as ProposalSection[];
}

export function parseInvestmentItems(value: unknown): InvestmentItem[] {
  if (!Array.isArray(value)) return [];
  return value as InvestmentItem[];
}

export function parseCommercialTerms(value: unknown, clientName = ""): CommercialTerms {
  if (!value || typeof value !== "object") return createDefaultCommercialTerms(clientName);
  const v = value as Partial<CommercialTerms>;
  const defaults = createDefaultCommercialTerms(clientName);
  return {
    validityDays: typeof v.validityDays === "string" ? v.validityDays : defaults.validityDays,
    payment: typeof v.payment === "string" ? v.payment : defaults.payment,
    notes: typeof v.notes === "string" ? v.notes : defaults.notes,
    nextSteps: Array.isArray(v.nextSteps)
      ? v.nextSteps.filter((x): x is string => typeof x === "string")
      : defaults.nextSteps,
    clientSignLabel:
      typeof v.clientSignLabel === "string" ? v.clientSignLabel : defaults.clientSignLabel,
    contractorSignLabel:
      typeof v.contractorSignLabel === "string"
        ? v.contractorSignLabel
        : defaults.contractorSignLabel,
  };
}
