import { PDFDocument } from "pdf-lib";
import sharp from "sharp";
import { mmToPt, mmToPx } from "./units";
import type { LogoPosition, Template } from "../types";

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
    const embeddedLogo = await embedRasterImage(pdfDoc, logoImage);
    const logoAspect = embeddedLogo.height / embeddedLogo.width;
    const logoHeightPt = logoWidthPt * logoAspect;
    const marginPt = mmToPt(template.logo_margin_mm + template.bleed_mm);

    const { x, y } = logoPosition(
      template.logo_position,
      pageWidthPt,
      pageHeightPt,
      logoWidthPt,
      logoHeightPt,
      marginPt
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

async function embedRasterImage(pdfDoc: PDFDocument, image: Buffer) {
  // Normalise en PNG (avec transparence préservée) avant d'intégrer, pour
  // accepter n'importe quel format de logo en entrée (svg exclu).
  const png = await sharp(image).png().toBuffer();
  return pdfDoc.embedPng(png);
}

function logoPosition(
  position: LogoPosition,
  pageWidthPt: number,
  pageHeightPt: number,
  logoWidthPt: number,
  logoHeightPt: number,
  marginPt: number
): { x: number; y: number } {
  switch (position) {
    case "top-left":
      return { x: marginPt, y: pageHeightPt - marginPt - logoHeightPt };
    case "top-right":
      return {
        x: pageWidthPt - marginPt - logoWidthPt,
        y: pageHeightPt - marginPt - logoHeightPt,
      };
    case "bottom-left":
      return { x: marginPt, y: marginPt };
    case "bottom-right":
      return { x: pageWidthPt - marginPt - logoWidthPt, y: marginPt };
    case "center":
    default:
      return {
        x: (pageWidthPt - logoWidthPt) / 2,
        y: (pageHeightPt - logoHeightPt) / 2,
      };
  }
}
