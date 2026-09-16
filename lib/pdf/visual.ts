import sharp from "sharp";
import { isSvg } from "./logo";

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
  targetHeightPx: number
): Promise<Buffer> {
  const png = await toPngBuffer(visual, targetWidthPx);
  return sharp(png)
    .resize(targetWidthPx, targetHeightPx, { fit: "cover" })
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
  targetHeightPx: number
): Promise<Buffer> {
  const rawTilePng = await toPngBuffer(visual, tileWidthPx);
  const meta = await sharp(rawTilePng).metadata();
  const nativeW = meta.width ?? tileWidthPx;
  const nativeH = meta.height ?? tileWidthPx;
  const tileHeightPx = Math.max(1, Math.round(nativeH * (tileWidthPx / nativeW)));

  const tilePng = await sharp(rawTilePng).resize(tileWidthPx, tileHeightPx).png().toBuffer();
  const base64 = tilePng.toString("base64");

  const patternSvg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="${targetWidthPx}" height="${targetHeightPx}">
      <defs>
        <pattern id="tile" x="0" y="0" width="${tileWidthPx}" height="${tileHeightPx}" patternUnits="userSpaceOnUse">
          <image href="data:image/png;base64,${base64}" width="${tileWidthPx}" height="${tileHeightPx}"/>
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill="url(#tile)"/>
    </svg>
  `;

  return sharp(Buffer.from(patternSvg)).jpeg({ quality: 92 }).toBuffer();
}
