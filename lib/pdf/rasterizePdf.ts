import { pdfToPng } from "pdf-to-png-converter";

// Résolution de rendu, cohérente avec le DPI d'impression standard utilisé
// ailleurs dans l'app (voir lib/pdf/units.ts).
const PRINT_DPI = 300;
const PDF_POINTS_DPI = 72;

export function isPdfBuffer(buffer: Buffer): boolean {
  return buffer.subarray(0, 5).toString("utf8") === "%PDF-";
}

/**
 * Rasterise la première page d'un PDF en PNG haute résolution (300 dpi),
 * pour permettre d'utiliser un PDF partout où l'app attend une image
 * matricielle (visuel de la banque, image de produit uploadée...). Les
 * pages suivantes d'un PDF multi-page sont ignorées.
 */
export async function rasterizePdfFirstPage(buffer: Buffer): Promise<Buffer> {
  const pages = await pdfToPng(buffer, {
    pagesToProcess: [1],
    viewportScale: PRINT_DPI / PDF_POINTS_DPI,
    // Ne pas mettre `disableFontFace: false` : hors navigateur, pdf.js ne sait
    // pas charger les polices TrueType intégrées et les remplace par des cases
    // barrées. Le réglage par défaut (true) dessine les glyphes en vectoriel.
  });
  const [page] = pages;
  if (!page?.content) {
    throw new Error("Impossible de convertir le PDF en image.");
  }
  return page.content;
}
