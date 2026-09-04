import JSZip from "https://esm.sh/jszip@3.10.1?target=deno";
import { extractText as extractPdfText, getDocumentProxy } from "https://esm.sh/unpdf@0.12.2?target=deno";
import * as XLSX from "https://esm.sh/xlsx@0.18.5?bundle&target=deno";

export const DOCUMENT_MAX_BYTES = 10 * 1024 * 1024;
export const DOCUMENT_MAX_CHARS = 12000;

const TEXT_EXT = /\.(txt|md|csv|rtf)$/i;
const PDF_EXT = /\.pdf$/i;
const DOCX_EXT = /\.docx$/i;
const DOC_EXT = /\.doc$/i;
const SHEET_EXT = /\.(xlsx|xls|ods|csv)$/i;

function decodeUtf8(bytes: Uint8Array): string {
  return new TextDecoder("utf-8", { fatal: false }).decode(bytes).replace(/\u0000/g, "");
}

function normalizeWhitespace(text: string): string {
  return text
    .replace(/\r\n/g, "\n")
    .replace(/\u00a0/g, " ")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function decodeXmlEntities(text: string): string {
  return text
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => String.fromCharCode(Number.parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'");
}

function stripXml(xml: string): string {
  return decodeXmlEntities(
    xml
      .replace(/<w:tab\b[^/]*\/>/g, "\t")
      .replace(/<w:br\b[^/]*\/>/g, "\n")
      .replace(/<\/w:p>/g, "\n")
      .replace(/<text:p\b[^>]*>/g, "")
      .replace(/<\/text:p>/g, "\n")
      .replace(/<[^>]+>/g, " "),
  );
}

function looksLikePdf(bytes: Uint8Array, fileName: string, mimeType?: string | null): boolean {
  if (PDF_EXT.test(fileName) || (mimeType ?? "").includes("pdf")) return true;
  return bytes.length >= 5 && decodeUtf8(bytes.slice(0, 5)) === "%PDF-";
}

function looksLikeZip(bytes: Uint8Array): boolean {
  return bytes.length >= 4 && bytes[0] === 0x50 && bytes[1] === 0x4b;
}

async function extractDocx(bytes: Uint8Array): Promise<string> {
  const zip = await JSZip.loadAsync(bytes);
  const docFile = zip.file("word/document.xml");
  if (!docFile) throw new Error("Word inválido");
  const xml = await docFile.async("string");
  return normalizeWhitespace(stripXml(xml));
}

async function extractOdt(bytes: Uint8Array): Promise<string> {
  const zip = await JSZip.loadAsync(bytes);
  const docFile = zip.file("content.xml");
  if (!docFile) throw new Error("Documento inválido");
  const xml = await docFile.async("string");
  return normalizeWhitespace(stripXml(xml));
}

function extractSpreadsheet(bytes: Uint8Array): string {
  const copy =
    bytes.byteOffset === 0 && bytes.byteLength === bytes.buffer.byteLength ? bytes : bytes.slice();
  const workbook = XLSX.read(copy, { type: "array", cellDates: true });
  const sheets = (workbook.SheetNames ?? []).slice(0, 6);
  const parts: string[] = [];
  for (const name of sheets) {
    const sheet = workbook.Sheets[name];
    if (!sheet) continue;
    const csv = XLSX.utils.sheet_to_csv(sheet, { blankrows: false }).trim();
    if (!csv) continue;
    const rows = csv.split("\n").slice(0, 150).join("\n");
    parts.push(sheets.length > 1 ? `Aba: ${name}\n${rows}` : rows);
  }
  return normalizeWhitespace(parts.join("\n\n"));
}

async function extractPdf(bytes: Uint8Array): Promise<string> {
  const data = bytes.byteOffset === 0 ? bytes : bytes.slice();
  const pdf = await getDocumentProxy(data);
  const result = await extractPdfText(pdf, { mergePages: true });
  const text = Array.isArray(result.text) ? result.text.join("\n") : String(result.text ?? "");
  return normalizeWhitespace(text);
}

function extractPlainText(bytes: Uint8Array, fileName: string): string {
  const raw = decodeUtf8(bytes);
  if (/\.rtf$/i.test(fileName) || raw.startsWith("{\\rtf")) {
    return normalizeWhitespace(
      raw
        .replace(/\\'[0-9a-fA-F]{2}/g, " ")
        .replace(/\\[a-zA-Z]+\d* ?/g, " ")
        .replace(/[{}]/g, " "),
    );
  }
  return normalizeWhitespace(raw);
}

function extensionOf(fileName: string): string {
  const base = fileName.split("?")[0] ?? fileName;
  const dot = base.lastIndexOf(".");
  return dot >= 0 ? base.slice(dot).toLowerCase() : "";
}

export async function extractDocumentText(input: {
  bytes: Uint8Array;
  fileName: string;
  mimeType?: string | null;
}): Promise<{ text: string; truncated: boolean }> {
  if (input.bytes.byteLength === 0) {
    throw new Error("Arquivo vazio");
  }
  if (input.bytes.byteLength > DOCUMENT_MAX_BYTES) {
    throw new Error("O arquivo deve ter no máximo 10 MB para o assistente.");
  }

  const fileName = input.fileName || "arquivo";
  const mime = input.mimeType ?? "";
  const ext = extensionOf(fileName);
  let text = "";

  try {
    if (DOC_EXT.test(fileName) && !DOCX_EXT.test(fileName)) {
      throw new Error("Envie o Word em .docx (o formato .doc antigo não é suportado).");
    }
    if (looksLikePdf(input.bytes, fileName, mime)) {
      text = await extractPdf(input.bytes);
    } else if (ext === ".docx" || mime.includes("wordprocessingml")) {
      text = await extractDocx(input.bytes);
    } else if (ext === ".odt" || mime.includes("opendocument.text")) {
      text = await extractOdt(input.bytes);
    } else if (
      SHEET_EXT.test(fileName) ||
      mime.includes("spreadsheet") ||
      mime.includes("excel") ||
      mime === "text/csv"
    ) {
      if (ext === ".csv" || mime === "text/csv") {
        text = extractPlainText(input.bytes, fileName);
      } else {
        text = extractSpreadsheet(input.bytes);
      }
    } else if (TEXT_EXT.test(fileName) || mime.startsWith("text/")) {
      text = extractPlainText(input.bytes, fileName);
    } else if (looksLikeZip(input.bytes)) {
      try {
        text = await extractDocx(input.bytes);
      } catch {
        text = extractSpreadsheet(input.bytes);
      }
    } else {
      text = extractPlainText(input.bytes, fileName);
    }
  } catch (error) {
    if (error instanceof Error && /docx|doc antigo|máximo 10 MB|vazio/i.test(error.message)) {
      throw error;
    }
    throw new Error("Não foi possível ler o texto deste arquivo. Envie um PDF com texto, Word (.docx) ou Excel (.xlsx).");
  }

  if (!text) {
    throw new Error(
      "Este arquivo não tem texto extraível (PDF escaneado, por exemplo). Envie um PDF com texto, Word ou Excel.",
    );
  }

  if (text.length <= DOCUMENT_MAX_CHARS) {
    return { text, truncated: false };
  }
  return { text: text.slice(0, DOCUMENT_MAX_CHARS).trimEnd(), truncated: true };
}
