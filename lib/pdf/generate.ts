import { PDFDocument } from "pdf-lib";
import sharp from "sharp";
import { mmToPt, mmToPx } from "./units";
import type { LogoHAlign, LogoVAlign, Template } from "../types";

export interface GeneratePdfInput {
  template: Template;
  sourceImage: Buffer;
  logoImage: Buffer | null;
}

/**
 * Construit un PDF prêt-pour-impression à partir d'une image source et d'un
 * modèle (dimensions + fond perdu + logo). L'image est recadrée en "cover"
 * pour remplir toute la page (fond perdu inclus) à la résolution demandée,
 * puis le logo Pico est superposé à la position configurée.
 */
export async function generatePrintReadyPdf({
  template,
  sourceImage,
  logoImage,
}: GeneratePdfInput): Promise<Buffer> {
  const pageWidthMm = template.width_mm + template.bleed_mm * 2;
  const pageHeightMm = template.height_mm + template.bleed_mm * 2;

  const targetPxWidth = mmToPx(pageWidthMm, template.dpi);
  const targetPxHeight = mmToPx(pageHeightMm, template.dpi);

  // 1. Recadrer/redimensionner l'image source pour couvrir exactement la
  //    page (fond perdu compris) à la résolution d'impression.
  const fittedImage = await sharp(sourceImage)
    .resize(targetPxWidth, targetPxHeight, { fit: "cover", position: "attention" })
    .jpeg({ quality: 92 })
    .toBuffer();

  const pdfDoc = await PDFDocument.create();
  const pageWidthPt = mmToPt(pageWidthMm);
  const pageHeightPt = mmToPt(pageHeightMm);
  const page = pdfDoc.addPage([pageWidthPt, pageHeightPt]);

  const embeddedImage = await pdfDoc.embedJpg(fittedImage);
  page.drawImage(embeddedImage, {
    x: 0,
    y: 0,
    width: pageWidthPt,
    height: pageHeightPt,
  });

  // 2. Superposer le logo Pico, si fourni.
  if (logoImage) {
    const logoWidthPt = mmToPt(template.logo_width_mm);
    const logoTargetPx = mmToPx(template.logo_width_mm, template.dpi);
    const embeddedLogo = await embedRasterImage(pdfDoc, logoImage, logoTargetPx);
    const logoAspect = embeddedLogo.height / embeddedLogo.width;
    const logoHeightPt = logoWidthPt * logoAspect;
    const marginXPt = mmToPt(template.logo_margin_x_mm + template.bleed_mm);
    const marginYPt = mmToPt(template.logo_margin_y_mm + template.bleed_mm);

    const { x, y } = logoPosition(
      template.logo_h_align,
      template.logo_v_align,
      pageWidthPt,
      pageHeightPt,
      logoWidthPt,
      logoHeightPt,
      marginXPt,
      marginYPt
    );

    page.drawImage(embeddedLogo, {
      x,
      y,
      width: logoWidthPt,
      height: logoHeightPt,
    });
  }

  const bytes = await pdfDoc.save();
  return Buffer.from(bytes);
}

async function embedRasterImage(pdfDoc: PDFDocument, image: Buffer, targetWidthPx: number) {
  // Normalise en PNG (avec transparence préservée) avant d'intégrer, pour
  // accepter n'importe quel format de logo en entrée (raster ou SVG).
  if (isSvg(image)) {
    // Le SVG est vectoriel : on le rastérise à la densité qui donne la
    // largeur cible en pixels, pour un rendu net à la résolution d'impression.
    const nativeWidthPx = (await sharp(image).metadata()).width ?? targetWidthPx;
    const density = 72 * (targetWidthPx / nativeWidthPx);
    const png = await sharp(image, { density }).png().toBuffer();
    return pdfDoc.embedPng(png);
  }

  const png = await sharp(image).png().toBuffer();
  return pdfDoc.embedPng(png);
}

function isSvg(buffer: Buffer): boolean {
  return buffer.subarray(0, 512).toString("utf8").includes("<svg");
}

function logoPosition(
  hAlign: LogoHAlign,
  vAlign: LogoVAlign,
  pageWidthPt: number,
  pageHeightPt: number,
  logoWidthPt: number,
  logoHeightPt: number,
  marginXPt: number,
  marginYPt: number
): { x: number; y: number } {
  const x =
    hAlign === "left"
      ? marginXPt
      : hAlign === "right"
      ? pageWidthPt - marginXPt - logoWidthPt
      : (pageWidthPt - logoWidthPt) / 2;

  const y = vAlign === "top" ? pageHeightPt - marginYPt - logoHeightPt : marginYPt;

  return { x, y };
}
