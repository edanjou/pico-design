import sharp from "sharp";

export function isSvg(buffer: Buffer): boolean {
  return buffer.subarray(0, 512).toString("utf8").includes("<svg");
}

// Rastérise un logo (SVG ou raster) en PNG à la largeur cible en pixels.
// Le SVG est vectoriel : on le rend à la densité qui donne cette largeur,
// pour un rendu net plutôt que flou.
export async function rasterizeLogoToPng(image: Buffer, targetWidthPx: number): Promise<Buffer> {
  if (isSvg(image)) {
    const nativeWidthPx = (await sharp(image).metadata()).width ?? targetWidthPx;
    const density = 72 * (targetWidthPx / nativeWidthPx);
    return sharp(image, { density }).png().toBuffer();
  }
  return sharp(image).png().toBuffer();
}
