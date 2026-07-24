export type DownloadImageFormat = "png" | "jpg";

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

async function fetchImageBlob(url: string): Promise<Blob> {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error("Não foi possível baixar a imagem.");
  }
  return res.blob();
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
