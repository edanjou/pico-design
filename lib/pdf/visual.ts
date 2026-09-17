import sharp from "sharp";
import { isSvg } from "./logo";
import { coverCropToBuffer } from "./crop";

// Rastérise une image (SVG ou raster) en PNG, avec le SVG rendu à la
// densité qui donne approximativement la largeur cible (avant tout
// resize/crop ultérieur).
async function toPngBuffer(image: Buffer, approxTargetWidthPx: number): Promise<Buffer> {
  if (isSvg(image)) {
    const nativeWidthPx = (await sharp(image).metadata()).width ?? approxTargetWidthPx;
    const density = 72 * (approxTargetWidthPx / nativeWidthPx);
    return sharp(image, { density }).png().toBuffer();
  }
  return sharp(image).png().toBuffer();
}

/**
 * Compose un visuel en plein format : recadré/redimensionné en "cover"
 * pour remplir exactement la page cible, comme une photo uploadée.
 */
export async function composeFullCoverImage(
  visual: Buffer,
  targetWidthPx: number,
  targetHeightPx: number,
  positionX = 0.5,
  positionY = 0.5
): Promise<Buffer> {
  const png = await toPngBuffer(visual, targetWidthPx);
  const cropped = await coverCropToBuffer(png, targetWidthPx, targetHeightPx, positionX, positionY);
  return sharp(cropped)
    .flatten({ background: "#ffffff" })
    .jpeg({ quality: 92 })
    .toBuffer();
}

/**
 * Compose un visuel en mosaïque répétée (motif tissu/papier cadeau) :
 * le visuel est rendu une fois à la taille de répétition demandée, puis
 * répété (tile) pour couvrir toute la page cible.
 */
export async function composeTiledImage(
  visual: Buffer,
  tileWidthPx: number,
  targetWidthPx: number,
  targetHeightPx: number,
  positionX = 0.5,
  positionY = 0.5
): Promise<Buffer> {
  const rawTilePng = await toPngBuffer(visual, tileWidthPx);
  const meta = await sharp(rawTilePng).metadata();
  const nativeW = meta.width ?? tileWidthPx;
  const nativeH = meta.height ?? tileWidthPx;
  const tileHeightPx = Math.max(1, Math.round(nativeH * (tileWidthPx / nativeW)));

  const tilePng = await sharp(rawTilePng).resize(tileWidthPx, tileHeightPx).png().toBuffer();
  const base64 = tilePng.toString("base64");

  // Décalage de phase du motif (0.5 = origine par défaut, non décalée).
  // Une plage de 0..1 couvre déjà une période complète : au-delà, le motif
  // ne fait que se répéter, donc pas besoin d'un décalage non borné.
  const clamp01 = (n: number) => Math.min(1, Math.max(0, n));
  const offsetX = (0.5 - clamp01(positionX)) * tileWidthPx;
  const offsetY = (0.5 - clamp01(positionY)) * tileHeightPx;

  const patternSvg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="${targetWidthPx}" height="${targetHeightPx}">
      <defs>
        <pattern id="tile" x="${offsetX}" y="${offsetY}" width="${tileWidthPx}" height="${tileHeightPx}" patternUnits="userSpaceOnUse">
          <image href="data:image/png;base64,${base64}" width="${tileWidthPx}" height="${tileHeightPx}"/>
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill="url(#tile)"/>
    </svg>
  `;

  return sharp(Buffer.from(patternSvg))
    .flatten({ background: "#ffffff" })
    .jpeg({ quality: 92 })
    .toBuffer();
}
