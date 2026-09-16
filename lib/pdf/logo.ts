import sharp from "sharp";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { LogoShape } from "../types";
import { DEFAULT_LOGO_COLOR, isValidLogoColor } from "../logoColors";

export { LOGO_COLOR_PALETTE, isValidLogoColor } from "../logoColors";

// Fichiers "forme neutre" du bucket Storage "assets" — recolorés
// dynamiquement selon la couleur choisie (voir recolorSvg ci-dessous),
// donc un seul fichier par forme suffit peu importe la couleur finale.
export const LOGO_SHAPE_FILES: Record<LogoShape, string> = {
  logo: "pico-noir.svg",
  pastille: "cercle-noir.svg",
};

export function isSvg(buffer: Buffer): boolean {
  return buffer.subarray(0, 512).toString("utf8").includes("<svg");
}

// Applique une couleur de remplissage au SVG (sur l'élément racine, hérité
// par tous les tracés qui n'ont pas leur propre fill — c'est le cas des
// fichiers logo/pastille utilisés ici).
export function recolorSvg(svg: Buffer, hexColor: string): Buffer {
  const color = isValidLogoColor(hexColor) ? hexColor : DEFAULT_LOGO_COLOR;
  const text = svg.toString("utf8");
  const recolored = text.replace(/<svg([^>]*)>/, (_match, attrs: string) => {
    const withoutFill = attrs.replace(/\sfill="[^"]*"/g, "");
    return `<svg${withoutFill} fill="${color}">`;
  });
  return Buffer.from(recolored, "utf8");
}

// Télécharge la forme de logo choisie (bucket "assets") et lui applique la
// couleur choisie. Retourne null si le fichier n'existe pas dans le bucket.
export async function loadLogoImage(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  admin: SupabaseClient<any>,
  shape: LogoShape,
  hexColor: string
): Promise<Buffer | null> {
  const path = LOGO_SHAPE_FILES[shape] ?? LOGO_SHAPE_FILES.logo;
  const { data } = await admin.storage.from("assets").download(path);
  if (!data) return null;
  const buffer = Buffer.from(await data.arrayBuffer());
  return recolorSvg(buffer, hexColor);
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
