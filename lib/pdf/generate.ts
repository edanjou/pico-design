import { PDFDocument, rgb } from "pdf-lib";
import sharp from "sharp";
import { mmToPt, mmToPx } from "./units";
import { rasterizeLogoToPng } from "./logo";
import { addDropShadow } from "./logoShadow";
import { coverCropToBuffer } from "./crop";
import type { LogoHAlign, LogoVAlign, Template } from "../types";

export interface GeneratePdfInput {
  template: Template;
  sourceImage: Buffer;
  logoImage: Buffer | null;
  positionX?: number;
  positionY?: number;
  // Image de verso (optionnelle) : ajoutée comme deuxième page du PDF.
  // Uniquement pertinent pour les modèles recto-verso.
  backImage?: Buffer | null;
  backPositionX?: number;
  backPositionY?: number;
  // Logo à afficher sur le verso, si le modèle est configuré pour ça
  // (`logo_on_back`) — indépendant du logo du recto, qui peut avoir sa
  // propre forme/couleur mais utilise le même fichier ici (voir
  // lib/pdf/productPdf.ts, qui décide quel côté reçoit `logoImage`).
  backLogoImage?: Buffer | null;
  // Ombre portée derrière le logo (recto et verso).
  logoShadow?: boolean;
}

/**
 * Construit un PDF prêt-pour-impression à partir d'une image source et d'un
 * modèle (dimensions + fond perdu + logo). L'image est recadrée en "cover"
 * pour remplir toute la page (fond perdu inclus) à la résolution demandée,
 * puis le logo Pico est superposé à la position configurée. Si `backImage`
 * est fourni, une deuxième page (verso, sans logo) est ajoutée.
 */
export async function generatePrintReadyPdf({
  template,
  sourceImage,
  logoImage,
  positionX = 0.5,
  positionY = 0.5,
  backImage = null,
  backPositionX = 0.5,
  backPositionY = 0.5,
  backLogoImage = null,
  logoShadow = false,
}: GeneratePdfInput): Promise<Buffer> {
  const pageWidthMm = template.width_mm + template.bleed_mm * 2;
  const pageHeightMm = template.height_mm + template.bleed_mm * 2;
  const targetPxWidth = mmToPx(pageWidthMm, template.dpi);
  const targetPxHeight = mmToPx(pageHeightMm, template.dpi);

  const pdfDoc = await PDFDocument.create();

  await addImagePage(
    pdfDoc,
    template,
    sourceImage,
    positionX,
    positionY,
    targetPxWidth,
    targetPxHeight,
    logoImage,
    logoShadow
  );

  if (backImage) {
    await addImagePage(
      pdfDoc,
      template,
      backImage,
      backPositionX,
      backPositionY,
      targetPxWidth,
      targetPxHeight,
      backLogoImage,
      logoShadow
    );
  }

  const bytes = await pdfDoc.save();
  return Buffer.from(bytes);
}

async function addImagePage(
  pdfDoc: PDFDocument,
  template: Template,
  sourceImage: Buffer,
  positionX: number,
  positionY: number,
  targetPxWidth: number,
  targetPxHeight: number,
  logoImage: Buffer | null,
  logoShadow: boolean
): Promise<void> {
  const pageWidthMm = template.width_mm + template.bleed_mm * 2;
  const pageHeightMm = template.height_mm + template.bleed_mm * 2;
  const pageWidthPt = mmToPt(pageWidthMm);
  const pageHeightPt = mmToPt(pageHeightMm);

  // Recadrer/redimensionner l'image source pour couvrir exactement la page
  // (fond perdu compris) à la résolution d'impression, au point focal
  // choisi par l'utilisateur.
  const cropped = await coverCropToBuffer(sourceImage, targetPxWidth, targetPxHeight, positionX, positionY);
  const fittedImage = await sharp(cropped)
    .flatten({ background: "#ffffff" })
    .jpeg({ quality: 92 })
    .toBuffer();

  // Marge d'impression : bande blanche ajoutée en plus, tout autour de la
  // page normale (fond perdu compris), pour certains formats qui en ont
  // besoin (ex. étuis de téléphone) — la page PDF est agrandie en
  // conséquence, l'image imprimée garde sa taille normale. Distincte de la
  // marge de protection (`safety_margin_*_mm`), qui reste un simple guide
  // visuel à l'écran et n'apparaît jamais dans le PDF.
  const printMarginXPt = mmToPt(template.print_margin_x_mm);
  const printMarginYPt = mmToPt(template.print_margin_y_mm);
  const totalPageWidthPt = pageWidthPt + printMarginXPt * 2;
  const totalPageHeightPt = pageHeightPt + printMarginYPt * 2;

  const page = pdfDoc.addPage([totalPageWidthPt, totalPageHeightPt]);
  if (printMarginXPt > 0 || printMarginYPt > 0) {
    page.drawRectangle({
      x: 0,
      y: 0,
      width: totalPageWidthPt,
      height: totalPageHeightPt,
      color: rgb(1, 1, 1),
    });
  }

  const embeddedImage = await pdfDoc.embedJpg(fittedImage);
  page.drawImage(embeddedImage, {
    x: printMarginXPt,
    y: printMarginYPt,
    width: pageWidthPt,
    height: pageHeightPt,
  });

  if (!logoImage) return;

  const logoWidthPt = mmToPt(template.logo_width_mm);
  const logoTargetPx = mmToPx(template.logo_width_mm, template.dpi);
  const logoPng = await rasterizeLogoToPng(logoImage, logoTargetPx);
  const embeddedLogo = await pdfDoc.embedPng(logoPng);
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

  if (logoShadow) {
    // Le canevas de l'image avec ombre déborde du logo de `pad` pixels de
    // chaque côté : on le décale d'autant pour que le logo reste exactement
    // à sa position.
    const shadowed = await addDropShadow(logoPng);
    const embeddedShadowed = await pdfDoc.embedPng(shadowed.png);
    const ptPerPx = logoWidthPt / embeddedLogo.width;
    page.drawImage(embeddedShadowed, {
      x: x + printMarginXPt - shadowed.pad * ptPerPx,
      y: y + printMarginYPt - shadowed.pad * ptPerPx,
      width: embeddedShadowed.width * ptPerPx,
      height: embeddedShadowed.height * ptPerPx,
    });
    return;
  }

  page.drawImage(embeddedLogo, {
    x: x + printMarginXPt,
    y: y + printMarginYPt,
    width: logoWidthPt,
    height: logoHeightPt,
  });
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
