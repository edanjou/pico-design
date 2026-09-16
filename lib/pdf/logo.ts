import sharp from "sharp";
import type { LogoVariant } from "../types";

// Fichiers du bucket Storage "assets" pour chaque variante de logo.
// "icon_cercle" doit être uploadé manuellement dans Supabase Storage
// (bucket assets, chemin exact ci-dessous) avant de pouvoir être choisi.
export const LOGO_VARIANT_FILES: Record<LogoVariant, string> = {
  noir: "pico-noir.svg",
  blanc: "pico-blanc.svg",
  icon_cercle: "cercle-noir.svg",
};

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
