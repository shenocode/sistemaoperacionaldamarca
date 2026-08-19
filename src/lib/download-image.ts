export type DownloadImageFormat = "png" | "jpg";
export type ShareOrDownloadResult = "shared" | "downloaded" | "cancelled";

function triggerBlobDownload(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  anchor.rel = "noopener";
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

function baseName(name: string) {
  return name.replace(/\.[^.]+$/, "") || name || "arte";
}

function sanitizeDownloadName(name: string, fallback = "arquivo") {
  const cleaned = name
    .trim()
    .replace(/[^\w.\-()+ ]+/g, "_")
    .replace(/\s+/g, "-")
    .slice(0, 120);
  return cleaned || fallback;
}

function uniqueFileName(name: string, used: Set<string>) {
  let candidate = name;
  let counter = 2;
  while (used.has(candidate.toLowerCase())) {
    const dot = name.lastIndexOf(".");
    const stem = dot > 0 ? name.slice(0, dot) : name;
    const ext = dot > 0 ? name.slice(dot) : "";
    candidate = `${stem}-${counter}${ext}`;
    counter += 1;
  }
  used.add(candidate.toLowerCase());
  return candidate;
}

function isAbortError(err: unknown) {
  return (
    (err instanceof DOMException && err.name === "AbortError") ||
    (typeof err === "object" &&
      err !== null &&
      "name" in err &&
      (err as { name: string }).name === "AbortError")
  );
}

export function fileNameFromMediaUrl(url: string, fallback = "arquivo") {
  const raw = url.trim();
  if (!raw) return fallback;
  let last = raw;
  try {
    last = decodeURIComponent(new URL(raw).pathname.split("/").filter(Boolean).pop() ?? raw);
  } catch {
    last = decodeURIComponent(raw.split("/").filter(Boolean).pop() ?? raw);
  }
  return (
    last.replace(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}-/i, "") ||
    last ||
    fallback
  );
}

async function fetchMediaBlob(url: string, errorMessage: string): Promise<Blob> {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(errorMessage);
  }
  return res.blob();
}

async function fetchImageBlob(url: string): Promise<Blob> {
  return fetchMediaBlob(url, "Não foi possível baixar a imagem.");
}

function canShareFiles(files: File[]) {
  return (
    typeof navigator !== "undefined" &&
    typeof navigator.share === "function" &&
    typeof navigator.canShare === "function" &&
    navigator.canShare({ files })
  );
}

function openMediaInNewTab(url: string) {
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.target = "_blank";
  anchor.rel = "noopener noreferrer";
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
}

/** Baixa (ou abre o compartilhamento nativo no celular) arquivos de mídia. */
export async function shareOrDownloadFiles(
  items: Array<{ url: string; name?: string }>,
  zipName = "midias-aprovadas",
): Promise<ShareOrDownloadResult> {
  if (items.length === 0) return "downloaded";

  const used = new Set<string>();
  const files: File[] = [];

  try {
    for (const item of items) {
      const blob = await fetchMediaBlob(item.url, "Não foi possível baixar o arquivo.");
      const rawName = item.name?.trim() || fileNameFromMediaUrl(item.url);
      const name = uniqueFileName(sanitizeDownloadName(rawName), used);
      files.push(new File([blob], name, { type: blob.type || "application/octet-stream" }));
    }
  } catch (err) {
    if (items.length === 1) {
      openMediaInNewTab(items[0].url);
      return "downloaded";
    }
    throw err;
  }

  try {
    if (canShareFiles(files)) {
      await navigator.share({ files });
      return "shared";
    }
  } catch (err) {
    if (isAbortError(err)) return "cancelled";
  }

  if (files.length === 1) {
    triggerBlobDownload(files[0], files[0].name);
    return "downloaded";
  }

  const { default: JSZip } = await import("jszip");
  const zip = new JSZip();
  for (const file of files) {
    zip.file(file.name, file);
  }
  const zipBlob = await zip.generateAsync({ type: "blob" });
  triggerBlobDownload(zipBlob, `${baseName(sanitizeDownloadName(zipName, "midias-aprovadas"))}.zip`);
  return "downloaded";
}

async function blobToImageBitmap(blob: Blob): Promise<ImageBitmap> {
  return createImageBitmap(blob);
}

async function convertImageBlob(
  source: Blob,
  format: DownloadImageFormat,
): Promise<Blob> {
  if (format === "png" && source.type === "image/png") return source;
  if (format === "jpg" && (source.type === "image/jpeg" || source.type === "image/jpg")) {
    return source;
  }

  const bitmap = await blobToImageBitmap(source);
  const canvas = document.createElement("canvas");
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Não foi possível converter a imagem.");

  if (format === "jpg") {
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }
  ctx.drawImage(bitmap, 0, 0);
  bitmap.close();

  const mime = format === "png" ? "image/png" : "image/jpeg";
  const quality = format === "jpg" ? 0.92 : undefined;

  const blob = await new Promise<Blob | null>((resolve) => {
    canvas.toBlob((result) => resolve(result), mime, quality);
  });
  if (!blob) throw new Error("Falha ao gerar o arquivo para download.");
  return blob;
}

export async function downloadImageFromUrl(
  url: string,
  fileName: string,
  format: DownloadImageFormat,
) {
  const source = await fetchImageBlob(url);
  const blob = await convertImageBlob(source, format);
  const ext = format === "png" ? "png" : "jpg";
  triggerBlobDownload(blob, `${baseName(fileName)}.${ext}`);
}

export async function downloadImagesAsZip(
  items: Array<{ url: string; name: string }>,
  format: DownloadImageFormat,
  zipName = "artes-geradas",
) {
  if (items.length === 0) return;

  const { default: JSZip } = await import("jszip");
  const zip = new JSZip();
  const usedNames = new Set<string>();

  for (const item of items) {
    const source = await fetchImageBlob(item.url);
    const blob = await convertImageBlob(source, format);
    const ext = format === "png" ? "png" : "jpg";
    let name = `${baseName(item.name)}.${ext}`;
    let counter = 2;
    while (usedNames.has(name.toLowerCase())) {
      name = `${baseName(item.name)}-${counter}.${ext}`;
      counter += 1;
    }
    usedNames.add(name.toLowerCase());
    zip.file(name, blob);
  }

  const zipBlob = await zip.generateAsync({ type: "blob" });
  triggerBlobDownload(zipBlob, `${baseName(zipName)}.zip`);
}
