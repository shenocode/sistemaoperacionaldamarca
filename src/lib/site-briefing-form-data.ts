/** Site briefing form — adapted from smartsiteforall `cliente-pro` wizard. */

export type SiteBriefingFormData = {
  nome: string;
  nomeFantasia: string;
  segmento: string;
  descricao: string;
  historia: string;
  missao: string;
  valores: string;
  diferenciais: string;
  produtos: string;
  servicos: string;
  publicoAlvo: string;
  cidade: string;
  estado: string;
  pais: string;
  horario: string;
  ddi: string;
  whatsapp: string;
  telefone: string;
  email: string;
  endereco: string;
  maps: string;
  instagram: string;
  facebook: string;
  linkedin: string;
  tiktok: string;
  youtube: string;
  pinterest: string;
  videos: string[];
  estilo: string;
  tom: string;
  objetivos: string[];
  cta: string;
  ctas: string[];
};

export const emptySiteBriefingForm: SiteBriefingFormData = {
  nome: "",
  nomeFantasia: "",
  segmento: "",
  descricao: "",
  historia: "",
  missao: "",
  valores: "",
  diferenciais: "",
  produtos: "",
  servicos: "",
  publicoAlvo: "",
  cidade: "",
  estado: "",
  pais: "Brasil",
  horario: "",
  ddi: "+55",
  whatsapp: "",
  telefone: "",
  email: "",
  endereco: "",
  maps: "",
  instagram: "",
  facebook: "",
  linkedin: "",
  tiktok: "",
  youtube: "",
  pinterest: "",
  videos: [],
  estilo: "",
  tom: "",
  objetivos: [],
  cta: "",
  ctas: [],
};

export const SITE_BRIEFING_STEPS = [
  { id: "empresa", title: "Dados da empresa", hint: "Conte quem você é e o que faz" },
  {
    id: "identidade",
    title: "Identidade visual",
    hint: "Organize os materiais da sua marca",
  },
  { id: "contatos", title: "Contatos e redes", hint: "Como seus clientes falam com você" },
  { id: "preferencias", title: "Preferências", hint: "Estilo visual e tom de voz" },
  { id: "objetivo", title: "Objetivo do site", hint: "O que o site precisa alcançar" },
  { id: "revisao", title: "Revisão", hint: "Confira antes de enviar" },
] as const;

export const SEGMENTOS = [
  "Psicologia",
  "Clínica / Saúde",
  "Odontologia",
  "Advocacia",
  "Arquitetura",
  "Design",
  "Fotografia",
  "Restaurante",
  "Cafeteria",
  "Academia",
  "Barbearia",
  "Salão de beleza",
  "Hotel / Pousada",
  "Prestador de serviços",
  "Outro",
];

export const ESTILOS = [
  "Minimalista",
  "Elegante",
  "Corporativo",
  "Moderno",
  "Escuro",
  "Claro",
  "Criativo",
  "Luxuoso",
  "Natural",
];

export const TONS = ["Formal", "Amigável", "Premium", "Inspirador", "Técnico", "Descontraído"];

export const OBJETIVOS = [
  "Gerar contatos",
  "Solicitar orçamento",
  "Agendamentos",
  "Mostrar portfólio",
  "Captar clientes",
  "Apresentação institucional",
];

export const CTAS = [
  "Falar no WhatsApp",
  "Solicitar orçamento",
  "Agendar consulta",
  "Reservar horário",
  "Conhecer serviços",
];

export const DDIS = [
  { code: "+55", label: "🇧🇷 +55" },
  { code: "+351", label: "🇵🇹 +351" },
  { code: "+1", label: "🇺🇸 +1" },
  { code: "+34", label: "🇪🇸 +34" },
  { code: "+44", label: "🇬🇧 +44" },
  { code: "+49", label: "🇩🇪 +49" },
];

export const PRODUTOS_SERVICOS_HINT =
  "Escreva detalhadamente o que a sua empresa oferece, tudo o que poderá ficar visível no site (se preferir, pode enviar por e-mail algum material que já tenha essas informações).";

/** Fields counted for progress (cliente-pro). */
const TRACKED_STRING_FIELDS: Array<keyof SiteBriefingFormData> = [
  "nome",
  "nomeFantasia",
  "segmento",
  "descricao",
  "historia",
  "missao",
  "valores",
  "diferenciais",
  "produtos",
  "servicos",
  "publicoAlvo",
  "cidade",
  "estado",
  "pais",
  "horario",
  "whatsapp",
  "telefone",
  "email",
  "endereco",
  "maps",
  "instagram",
  "facebook",
  "linkedin",
  "tiktok",
  "youtube",
  "pinterest",
  "estilo",
  "tom",
];

const FIELD_LABELS: Record<string, string> = {
  nome: "Nome da empresa",
  nomeFantasia: "Nome fantasia",
  segmento: "Segmento",
  descricao: "Descrição do negócio",
  historia: "História da empresa",
  missao: "Missão",
  valores: "Valores",
  diferenciais: "Diferenciais",
  produtos: "Produtos",
  servicos: "Serviços",
  publicoAlvo: "Público-alvo",
  cidade: "Cidade",
  estado: "Estado",
  pais: "País",
  horario: "Horário de funcionamento",
  ddi: "DDI",
  whatsapp: "WhatsApp",
  telefone: "Telefone",
  email: "E-mail",
  endereco: "Endereço",
  maps: "Google Maps",
  instagram: "Instagram",
  facebook: "Facebook",
  linkedin: "LinkedIn",
  tiktok: "TikTok",
  youtube: "YouTube",
  pinterest: "Pinterest",
  videos: "Vídeos",
  estilo: "Estilo visual",
  tom: "Tom da marca",
  objetivos: "Objetivos do site",
  ctas: "Chamadas principais (CTA)",
  cta: "CTA",
};

export function ctaPrincipal(form: Pick<SiteBriefingFormData, "cta" | "ctas">): string {
  if (form.ctas?.length) return form.ctas.join(", ");
  return form.cta || "";
}

export function estruturaSugerida(segmento: string): string[] {
  const base = ["Hero", "Sobre", "Serviços", "Galeria", "Contato"];
  const mapa: Record<string, string[]> = {
    Psicologia: ["Hero", "Sobre", "Especialidades", "Como funciona", "Benefícios", "FAQ", "Contato"],
    "Clínica / Saúde": ["Hero", "Sobre", "Especialidades", "Equipe", "Convênios", "FAQ", "Contato"],
    Odontologia: ["Hero", "Sobre", "Tratamentos", "Antes e depois", "FAQ", "Contato"],
    Advocacia: ["Hero", "Sobre", "Áreas de atuação", "Diferenciais", "Perguntas frequentes", "Contato"],
    Arquitetura: ["Hero", "Sobre", "Projetos", "Serviços", "Diferenciais", "Depoimentos", "Contato"],
    Design: ["Hero", "Sobre", "Portfólio", "Processo", "Serviços", "Contato"],
    Fotografia: ["Hero", "Portfólio", "Sobre", "Pacotes", "Depoimentos", "Contato"],
    Restaurante: ["Hero", "Cardápio", "Pratos", "Delivery", "Reservas", "Galeria", "Contato"],
    Cafeteria: ["Hero", "Cardápio", "Ambiente", "Galeria", "Horários", "Contato"],
    Academia: ["Hero", "Modalidades", "Estrutura", "Planos", "Equipe", "Contato"],
    Barbearia: ["Hero", "Serviços", "Galeria", "Equipe", "Horários", "Agendamento"],
    "Salão de beleza": ["Hero", "Serviços", "Galeria", "Equipe", "Agendamento", "Contato"],
    "Hotel / Pousada": ["Hero", "Acomodações", "Estrutura", "Galeria", "Localização", "Reservas"],
  };
  return mapa[segmento] ?? base;
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string");
}

export function parseSiteBriefingForm(raw: unknown): SiteBriefingFormData {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return { ...emptySiteBriefingForm };
  }
  const value = raw as Record<string, unknown>;
  // Legacy placeholder answers (site_purpose etc.) → empty form
  if ("site_purpose" in value && !("nome" in value) && !("segmento" in value)) {
    return { ...emptySiteBriefingForm };
  }

  const str = (key: keyof SiteBriefingFormData, fallback = "") =>
    typeof value[key] === "string" ? (value[key] as string) : fallback;

  return {
    ...emptySiteBriefingForm,
    nome: str("nome"),
    nomeFantasia: str("nomeFantasia"),
    segmento: str("segmento"),
    descricao: str("descricao"),
    historia: str("historia"),
    missao: str("missao"),
    valores: str("valores"),
    diferenciais: str("diferenciais"),
    produtos: str("produtos"),
    servicos: str("servicos"),
    publicoAlvo: str("publicoAlvo"),
    cidade: str("cidade"),
    estado: str("estado"),
    pais: str("pais", "Brasil"),
    horario: str("horario"),
    ddi: str("ddi", "+55"),
    whatsapp: str("whatsapp"),
    telefone: str("telefone"),
    email: str("email"),
    endereco: str("endereco"),
    maps: str("maps"),
    instagram: str("instagram"),
    facebook: str("facebook"),
    linkedin: str("linkedin"),
    tiktok: str("tiktok"),
    youtube: str("youtube"),
    pinterest: str("pinterest"),
    videos: asStringArray(value.videos),
    estilo: str("estilo"),
    tom: str("tom"),
    objetivos: asStringArray(value.objetivos),
    cta: str("cta"),
    ctas: asStringArray(value.ctas),
  };
}

export function countSiteBriefingProgress(form: SiteBriefingFormData): {
  answered: number;
  total: number;
} {
  let answered = 0;
  const total = TRACKED_STRING_FIELDS.length + 3; // + objetivos, ctas, videos

  for (const key of TRACKED_STRING_FIELDS) {
    const value = form[key];
    if (typeof value === "string" && value.trim()) answered += 1;
  }
  if (form.objetivos.length > 0) answered += 1;
  if (form.ctas.length > 0 || form.cta.trim()) answered += 1;
  if (form.videos.length > 0) answered += 1;

  return { answered, total };
}

export function isSiteBriefingFormFilled(form: SiteBriefingFormData): boolean {
  return countSiteBriefingProgress(form).answered > 0;
}

export function siteBriefingFormToQaText(form: SiteBriefingFormData): string {
  const lines: string[] = [];
  const push = (key: string, value: string) => {
    if (!value.trim()) return;
    lines.push(`P: ${FIELD_LABELS[key] ?? key}`);
    lines.push(`R: ${value.trim()}`);
    lines.push("");
  };

  for (const key of TRACKED_STRING_FIELDS) {
    if (key === "whatsapp") continue;
    const value = form[key];
    if (typeof value === "string") push(key, value);
  }
  if (form.whatsapp.trim()) {
    push("whatsapp", `${form.ddi} ${form.whatsapp}`.trim());
  }
  push("objetivos", form.objetivos.join(", "));
  push("ctas", ctaPrincipal(form));
  push("videos", form.videos.join("\n"));

  const estrutura = estruturaSugerida(form.segmento);
  if (form.segmento) {
    lines.push("P: Estrutura sugerida para o segmento");
    lines.push(`R: ${estrutura.join(", ")}`);
    lines.push("");
  }

  return lines.join("\n").trim();
}
