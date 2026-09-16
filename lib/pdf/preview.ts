import sharp from "sharp";
import { mmToPx } from "./units";
import { rasterizeLogoToPng } from "./logo";
import type { Template } from "../types";

const PREVIEW_MAX_DIM_PX = 900;

/**
 * Génère un aperçu PNG d'un modèle : la page (avec la ligne de coupe si
 * fond perdu) et le logo Pico positionné exactement comme sur le PDF final.
 * Si `sourceImage` est fourni (aperçu d'un produit avant enregistrement),
 * il est recadré en "cover" pour remplir la page, comme le fera la
 * génération de PDF réelle ; sinon un fond neutre "Exemple" est utilisé.
 */
export async function generateTemplatePreviewPng(
  template: Template,
  logoImage: Buffer | null,
  sourceImage?: Buffer | null
): Promise<Buffer> {
  const pageWidthMm = template.width_mm + template.bleed_mm * 2;
  const pageHeightMm = template.height_mm + template.bleed_mm * 2;

  const fullWidthPx = mmToPx(pageWidthMm, template.dpi);
  const fullHeightPx = mmToPx(pageHeightMm, template.dpi);
  const scale = Math.min(1, PREVIEW_MAX_DIM_PX / Math.max(fullWidthPx, fullHeightPx, 1));
  const previewDpi = template.dpi * scale;

  const pageWidthPx = Math.max(1, Math.round(mmToPx(pageWidthMm, previewDpi)));
  const pageHeightPx = Math.max(1, Math.round(mmToPx(pageHeightMm, previewDpi)));
  const bleedPx = mmToPx(template.bleed_mm, previewDpi);

  const trimX = bleedPx;
  const trimY = bleedPx;
  const trimW = Math.max(0, pageWidthPx - bleedPx * 2);
  const trimH = Math.max(0, pageHeightPx - bleedPx * 2);

  const safetyPx = mmToPx(template.safety_margin_mm, previewDpi);
  const safetyX = trimX + safetyPx;
  const safetyY = trimY + safetyPx;
  const safetyW = Math.max(0, trimW - safetyPx * 2);
  const safetyH = Math.max(0, trimH - safetyPx * 2);

  const linesSvg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="${pageWidthPx}" height="${pageHeightPx}">
      ${!sourceImage ? `<rect width="100%" height="100%" fill="#ffffff"/>` : ""}
      ${
        template.bleed_mm > 0
          ? `<rect x="${trimX}" y="${trimY}" width="${trimW}" height="${trimH}" fill="none" stroke="#ef4444" stroke-width="1.5"/>`
          : ""
      }
      ${
        template.safety_margin_mm > 0
          ? `<rect x="${safetyX}" y="${safetyY}" width="${safetyW}" height="${safetyH}" fill="none" stroke="#60a5fa" stroke-width="1.5" stroke-dasharray="3 3"/>`
          : ""
      }
      ${
        !sourceImage
          ? `<text x="50%" y="50%" text-anchor="middle" dominant-baseline="middle" font-family="sans-serif" font-size="${Math.max(
              14,
              Math.round(pageWidthPx * 0.06)
            )}" fill="#9ca3af">Exemple</text>`
          : ""
      }
    </svg>
  `;

  const base = sourceImage
    ? await sharp(sourceImage)
        .resize(pageWidthPx, pageHeightPx, { fit: "cover" })
        .flatten({ background: "#ffffff" })
        .png()
        .toBuffer()
    : await sharp(Buffer.from(linesSvg)).png().toBuffer();

  const composites: sharp.OverlayOptions[] = sourceImage
    ? [{ input: await sharp(Buffer.from(linesSvg)).png().toBuffer(), left: 0, top: 0 }]
    : [];

  if (logoImage && template.logo_width_mm > 0) {
    const logoWidthPx = Math.max(1, Math.round(mmToPx(template.logo_width_mm, previewDpi)));
    const rawLogoPng = await rasterizeLogoToPng(logoImage, logoWidthPx);
    const meta = await sharp(rawLogoPng).metadata();
    const nativeW = meta.width ?? logoWidthPx;
    const nativeH = meta.height ?? logoWidthPx;
    const logoHeightPx = Math.max(1, Math.round(nativeH * (logoWidthPx / nativeW)));
    const logoPng = await sharp(rawLogoPng).resize(logoWidthPx, logoHeightPx).png().toBuffer();

    const marginXPx = mmToPx(template.logo_margin_x_mm + template.bleed_mm, previewDpi);
    const marginYPx = mmToPx(template.logo_margin_y_mm + template.bleed_mm, previewDpi);

    const left =
      template.logo_h_align === "left"
        ? marginXPx
        : template.logo_h_align === "right"
        ? pageWidthPx - marginXPx - logoWidthPx
        : (pageWidthPx - logoWidthPx) / 2;

    // Contrairement au PDF (origine en bas), l'image raster a son origine
    // en haut : "top" correspond donc directement à la petite marge, sans
    // inversion.
    const top =
      template.logo_v_align === "top" ? marginYPx : pageHeightPx - marginYPx - logoHeightPx;

    composites.push({
      input: logoPng,
      left: Math.round(Math.min(Math.max(left, 0), Math.max(pageWidthPx - logoWidthPx, 0))),
      top: Math.round(Math.min(Math.max(top, 0), Math.max(pageHeightPx - logoHeightPx, 0))),
    });
  }

  return sharp(base).composite(composites).png().toBuffer();
}
