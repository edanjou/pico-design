import { isPdfBuffer, rasterizePdfPage } from "./pdf/rasterizePdf";

export const ALLOWED_VISUAL_TYPES = ["image/svg+xml", "image/png", "image/jpeg", "application/pdf"];

export interface PreparedFile {
  buffer: Buffer;
  contentType: string;
  filename: string;
}

/**
 * Prépare un fichier uploadé (visuel de la banque, ou image de produit)
 * pour le stockage : un PDF est converti en PNG (page demandée, la première
 * par défaut, 300 dpi) — le reste de l'app (recadrage, mosaïque, composition)
 * ne traite jamais de PDF directement, seulement des images matricielles ou
 * du SVG.
 */
export async function prepareUploadedFile(file: File, pdfPage = 1): Promise<PreparedFile> {
  const rawBuffer = Buffer.from(await file.arrayBuffer());
  if (file.type === "application/pdf" || isPdfBuffer(rawBuffer)) {
    const buffer = await rasterizePdfPage(rawBuffer, pdfPage);
    const filename = `${file.name.replace(/\.pdf$/i, "")}.png`;
    return { buffer, contentType: "image/png", filename };
  }
  return { buffer: rawBuffer, contentType: file.type, filename: file.name };
}
