import { pdf } from "@react-pdf/renderer";
import {
  ProposalPdfDocument,
  type ProposalPdfData,
} from "@/components/proposals/proposal-pdf-document";

export async function downloadProposalPdf(data: ProposalPdfData, fileName: string) {
  const blob = await pdf(<ProposalPdfDocument data={data} />).toBlob();
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName.endsWith(".pdf") ? fileName : `${fileName}.pdf`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}
