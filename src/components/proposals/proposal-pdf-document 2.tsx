import { Document, Image, Link, Page, StyleSheet, Text, View } from "@react-pdf/renderer";
import type {
  CommercialTerms,
  InvestmentItem,
  ProposalBlock,
  ProposalSection,
} from "@/lib/proposal-template";

const colors = {
  ink: "#1a1523",
  muted: "#5c5668",
  line: "#ddd6e8",
  soft: "#f4f0f8",
  accent: "#6b3fa0",
  white: "#ffffff",
};

const styles = StyleSheet.create({
  page: {
    fontFamily: "Helvetica",
    fontSize: 10,
    color: colors.ink,
    paddingTop: 48,
    paddingBottom: 56,
    paddingHorizontal: 48,
    backgroundColor: colors.white,
  },
  coverPage: {
    fontFamily: "Helvetica",
    color: colors.ink,
    padding: 0,
    backgroundColor: colors.white,
  },
  header: {
    flexDirection: "row",
    justifyContent: "flex-start",
    alignItems: "center",
    marginBottom: 28,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
    minHeight: 34,
  },
  headerLogo: {
    height: 34,
    objectFit: "contain",
  },
  coverLogo: {
    height: 31,
    objectFit: "contain",
  },
  footer: {
    position: "absolute",
    left: 48,
    right: 48,
    bottom: 24,
    borderTopWidth: 1,
    borderTopColor: colors.line,
    paddingTop: 8,
  },
  footerText: {
    fontSize: 7.5,
    color: colors.muted,
    textAlign: "center",
    lineHeight: 1.4,
  },
  footerLink: {
    fontSize: 7.5,
    color: colors.accent,
    textDecoration: "underline",
  },
  coverHero: {
    height: 320,
    width: "100%",
    objectFit: "cover",
  },
  coverHeroFallback: {
    height: 320,
    width: "100%",
    backgroundColor: colors.soft,
  },
  coverBody: {
    paddingHorizontal: 48,
    paddingTop: 36,
    paddingBottom: 40,
    flexGrow: 1,
  },
  coverTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 28,
  },
  coverEyebrow: {
    fontFamily: "Helvetica-Bold",
    fontSize: 11,
    letterSpacing: 2,
    color: colors.accent,
    marginBottom: 8,
  },
  coverTitle: {
    fontFamily: "Helvetica-Bold",
    fontSize: 26,
    color: colors.ink,
    marginBottom: 8,
  },
  coverSubtitle: {
    fontSize: 13,
    color: colors.muted,
    marginBottom: 16,
  },
  coverScope: {
    fontSize: 10,
    color: colors.ink,
    lineHeight: 1.5,
    marginBottom: 20,
    maxWidth: 420,
  },
  coverMeta: {
    fontSize: 10,
    color: colors.muted,
  },
  sectionTitle: {
    fontFamily: "Helvetica-Bold",
    fontSize: 13,
    color: colors.accent,
    marginBottom: 10,
    marginTop: 6,
  },
  paragraph: {
    fontSize: 10,
    lineHeight: 1.55,
    marginBottom: 8,
    color: colors.ink,
  },
  callout: {
    backgroundColor: colors.soft,
    borderLeftWidth: 3,
    borderLeftColor: colors.accent,
    paddingVertical: 8,
    paddingHorizontal: 12,
    marginBottom: 10,
  },
  calloutLabel: {
    fontFamily: "Helvetica-Bold",
    fontSize: 9,
    color: colors.accent,
    marginBottom: 3,
  },
  bulletItem: {
    flexDirection: "row",
    marginBottom: 4,
    paddingLeft: 4,
  },
  bulletDot: {
    width: 12,
    fontSize: 10,
    color: colors.accent,
  },
  bulletText: {
    flex: 1,
    fontSize: 10,
    lineHeight: 1.45,
  },
  stepItem: {
    flexDirection: "row",
    marginBottom: 6,
  },
  stepNum: {
    width: 18,
    fontFamily: "Helvetica-Bold",
    fontSize: 10,
    color: colors.accent,
  },
  table: {
    marginBottom: 12,
    borderWidth: 1,
    borderColor: colors.line,
  },
  tableRow: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
  },
  tableHeaderCell: {
    flex: 1,
    fontFamily: "Helvetica-Bold",
    backgroundColor: colors.soft,
    paddingVertical: 6,
    paddingHorizontal: 8,
    fontSize: 8.5,
    color: colors.ink,
  },
  tableCell: {
    flex: 1,
    paddingVertical: 6,
    paddingHorizontal: 8,
    fontSize: 9,
    color: colors.ink,
  },
  investmentTitle: {
    fontFamily: "Helvetica-Bold",
    fontSize: 13,
    color: colors.accent,
    marginBottom: 10,
    marginTop: 10,
  },
  termsBox: {
    marginTop: 8,
    marginBottom: 12,
  },
  termsLine: {
    fontSize: 10,
    marginBottom: 4,
    lineHeight: 1.45,
  },
  signRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 28,
    gap: 24,
  },
  signCol: {
    flex: 1,
  },
  signLine: {
    borderTopWidth: 1,
    borderTopColor: colors.ink,
    marginTop: 40,
    marginBottom: 6,
  },
  signLabel: {
    fontSize: 9,
    color: colors.muted,
  },
});

export type ProposalPdfGestor = {
  fullName: string | null;
  companyName: string | null;
  email: string | null;
  whatsapp: string | null;
  website: string | null;
  logoUrl: string | null;
};

export type ProposalPdfData = {
  clientName: string;
  title: string;
  subtitle: string;
  scopeSummary: string;
  proposalMonth: string;
  coverImageUrl: string | null;
  sections: ProposalSection[];
  investmentItems: InvestmentItem[];
  commercialTerms: CommercialTerms;
  gestor: ProposalPdfGestor;
};

function formatWhatsApp(digits: string | null | undefined) {
  if (!digits) return "";
  const d = digits.replace(/\D/g, "");
  if (d.length >= 12 && d.startsWith("55")) {
    const local = d.slice(2);
    if (local.length === 11) {
      return `+55 (${local.slice(0, 2)}) ${local.slice(2, 7)}-${local.slice(7)}`;
    }
  }
  return d ? `+${d}` : "";
}

function websiteHref(website: string | null | undefined): string | null {
  const trimmed = website?.trim();
  if (!trimmed) return null;
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
}

function formatWebsiteLabel(website: string | null | undefined) {
  const trimmed = website?.trim();
  if (!trimmed) return "";
  return trimmed.replace(/^https?:\/\//i, "").replace(/\/$/, "");
}

function GestorLogo({
  logoUrl,
  website,
  style,
}: {
  logoUrl: string | null;
  website: string | null;
  style: { height: number; objectFit: "contain" };
}) {
  if (!logoUrl) return null;
  const image = <Image src={logoUrl} style={style} />;
  const href = websiteHref(website);
  if (!href) return image;
  return <Link src={href}>{image}</Link>;
}

function Letterhead({
  logoUrl,
  website,
}: {
  logoUrl: string | null;
  website: string | null;
}) {
  return (
    <View style={styles.header} fixed>
      <GestorLogo logoUrl={logoUrl} website={website} style={styles.headerLogo} />
    </View>
  );
}

function PageFooter({ gestor }: { gestor: ProposalPdfGestor }) {
  const company = gestor.companyName?.trim() || "";
  const name = gestor.fullName?.trim() || "";
  const whatsapp = formatWhatsApp(gestor.whatsapp);
  const websiteLabel = formatWebsiteLabel(gestor.website);
  const websiteUrl = websiteHref(gestor.website);
  const textParts = [company, name, whatsapp].filter(Boolean);

  if (textParts.length === 0 && !websiteLabel) return null;

  return (
    <View style={styles.footer} fixed>
      <Text style={styles.footerText}>
        {textParts.join("  ·  ")}
        {websiteLabel && websiteUrl ? (
          <>
            {textParts.length > 0 ? "  ·  " : ""}
            <Link src={websiteUrl} style={styles.footerLink}>
              {websiteLabel}
            </Link>
          </>
        ) : null}
      </Text>
    </View>
  );
}

function BlockView({ block }: { block: ProposalBlock }) {
  if (block.type === "paragraph") {
    if (!block.text.trim()) return null;
    return <Text style={styles.paragraph}>{block.text}</Text>;
  }
  if (block.type === "callout") {
    if (!block.text.trim() && !block.label.trim()) return null;
    return (
      <View style={styles.callout}>
        {block.label.trim() ? <Text style={styles.calloutLabel}>{block.label}</Text> : null}
        {block.text.trim() ? <Text style={styles.paragraph}>{block.text}</Text> : null}
      </View>
    );
  }
  if (block.type === "bullets") {
    const items = block.items.filter((i) => i.trim());
    if (items.length === 0) return null;
    return (
      <View style={{ marginBottom: 8 }}>
        {items.map((item, idx) => (
          <View key={`${block.id}-${idx}`} style={styles.bulletItem} wrap={false}>
            <Text style={styles.bulletDot}>•</Text>
            <Text style={styles.bulletText}>{item}</Text>
          </View>
        ))}
      </View>
    );
  }
  if (block.type === "steps") {
    const items = block.items.filter((i) => i.trim());
    if (items.length === 0) return null;
    return (
      <View style={{ marginBottom: 8 }}>
        {items.map((item, idx) => (
          <View key={`${block.id}-${idx}`} style={styles.stepItem} wrap={false}>
            <Text style={styles.stepNum}>{idx + 1}.</Text>
            <Text style={styles.bulletText}>{item}</Text>
          </View>
        ))}
      </View>
    );
  }
  if (block.type === "table") {
    const rows = block.rows.filter((row) => row.some((c) => c.trim()));
    if (rows.length === 0 && block.headers.every((h) => !h.trim())) return null;
    return (
      <View style={styles.table}>
        <View style={styles.tableRow} wrap={false}>
          {block.headers.map((h, i) => (
            <Text key={`h-${i}`} style={styles.tableHeaderCell}>
              {h}
            </Text>
          ))}
        </View>
        {rows.map((row, ri) => (
          <View key={`r-${ri}`} style={styles.tableRow} wrap={false}>
            {block.headers.map((_, ci) => (
              <Text key={`c-${ri}-${ci}`} style={styles.tableCell}>
                {row[ci] ?? ""}
              </Text>
            ))}
          </View>
        ))}
      </View>
    );
  }
  return null;
}

function InvestmentSectionView({
  section,
  data,
}: {
  section: ProposalPdfData["sections"][number];
  data: ProposalPdfData;
}) {
  return (
    <View style={{ marginBottom: 14 }}>
      <Text style={styles.investmentTitle}>
        {section.number}. {section.title}
      </Text>
      {section.blocks.map((block) => (
        <BlockView key={block.id} block={block} />
      ))}
      {data.investmentItems.length > 0 ? (
        <View style={styles.table}>
          <View style={styles.tableRow} wrap={false}>
            <Text style={styles.tableHeaderCell}>Frente</Text>
            <Text style={styles.tableHeaderCell}>Modelo</Text>
            <Text style={styles.tableHeaderCell}>Investimento</Text>
          </View>
          {data.investmentItems.map((item) => (
            <View key={item.id} style={styles.tableRow} wrap={false}>
              <Text style={styles.tableCell}>{item.front}</Text>
              <Text style={styles.tableCell}>{item.model}</Text>
              <Text style={styles.tableCell}>{item.amount}</Text>
            </View>
          ))}
        </View>
      ) : null}
      <View style={styles.termsBox}>
        <Text style={styles.termsLine}>
          Validade desta proposta: {data.commercialTerms.validityDays || "____"} dias.
        </Text>
        <Text style={styles.termsLine}>
          Forma de pagamento: {data.commercialTerms.payment || "________________"}
        </Text>
        {data.commercialTerms.notes.trim() ? (
          <Text style={styles.termsLine}>{data.commercialTerms.notes}</Text>
        ) : null}
      </View>
    </View>
  );
}

function NextStepsSectionView({
  section,
  data,
}: {
  section: ProposalPdfData["sections"][number];
  data: ProposalPdfData;
}) {
  return (
    <View style={{ marginBottom: 14 }}>
      <Text style={styles.sectionTitle}>
        {section.number}. {section.title}
      </Text>
      {data.commercialTerms.nextSteps
        .filter((s) => s.trim())
        .map((step, idx) => (
          <View key={`ns-${idx}`} style={styles.bulletItem} wrap={false}>
            <Text style={styles.bulletDot}>•</Text>
            <Text style={styles.bulletText}>{step}</Text>
          </View>
        ))}
    </View>
  );
}

function SignatureSectionView({
  section,
  data,
}: {
  section: ProposalPdfData["sections"][number];
  data: ProposalPdfData;
}) {
  return (
    <View>
      <Text style={styles.sectionTitle}>
        {section.number}. {section.title}
      </Text>
      {section.blocks.map((block) => (
        <BlockView key={block.id} block={block} />
      ))}
      <View style={styles.signRow}>
        <View style={styles.signCol}>
          <View style={styles.signLine} />
          <Text style={styles.signLabel}>
            {data.commercialTerms.clientSignLabel || data.clientName}
          </Text>
        </View>
        <View style={styles.signCol}>
          <View style={styles.signLine} />
          <Text style={styles.signLabel}>
            {data.commercialTerms.contractorSignLabel ||
              data.gestor.fullName ||
              "Contratada"}
          </Text>
        </View>
      </View>
    </View>
  );
}

function SectionView({
  section,
  data,
}: {
  section: ProposalPdfData["sections"][number];
  data: ProposalPdfData;
}) {
  if (section.key === "investimento") {
    return <InvestmentSectionView section={section} data={data} />;
  }
  if (section.key === "proximos") {
    return <NextStepsSectionView section={section} data={data} />;
  }
  if (section.key === "assinatura") {
    return <SignatureSectionView section={section} data={data} />;
  }

  return (
    <View style={{ marginBottom: 14 }}>
      <Text style={styles.sectionTitle} minPresenceAhead={40}>
        {section.number}. {section.title}
      </Text>
      {section.blocks.map((block) => (
        <BlockView key={block.id} block={block} />
      ))}
    </View>
  );
}

export function ProposalPdfDocument({ data }: { data: ProposalPdfData }) {
  const visibleSections = data.sections.filter((s) => s.visible);

  return (
    <Document
      title={`${data.title} — ${data.clientName}`}
      author={data.gestor.fullName ?? "SOM"}
      subject={data.subtitle}
    >
      <Page size="A4" style={styles.coverPage}>
        {data.coverImageUrl ? (
          <Image src={data.coverImageUrl} style={styles.coverHero} />
        ) : (
          <View style={styles.coverHeroFallback} />
        )}
        <View style={styles.coverBody}>
          <View style={styles.coverTopRow}>
            <GestorLogo
              logoUrl={data.gestor.logoUrl}
              website={data.gestor.website}
              style={styles.coverLogo}
            />
          </View>
          <Text style={styles.coverEyebrow}>{data.title}</Text>
          <Text style={styles.coverTitle}>{data.clientName}</Text>
          {data.subtitle.trim() ? (
            <Text style={styles.coverSubtitle}>{data.subtitle}</Text>
          ) : null}
          {data.scopeSummary.trim() ? (
            <Text style={styles.coverScope}>{data.scopeSummary}</Text>
          ) : null}
          {data.proposalMonth.trim() ? (
            <Text style={styles.coverMeta}>{data.proposalMonth}</Text>
          ) : null}
        </View>
        <PageFooter gestor={data.gestor} />
      </Page>

      <Page size="A4" style={styles.page} wrap>
        <Letterhead logoUrl={data.gestor.logoUrl} website={data.gestor.website} />
        {visibleSections.map((section) => (
          <SectionView key={section.id} section={section} data={data} />
        ))}
        <PageFooter gestor={data.gestor} />
      </Page>
    </Document>
  );
}
