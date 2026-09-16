import sharp from "sharp";

// Extrait un point focal (0..1) d'une valeur de formulaire, avec repli sur
// le centre (0.5) si absente/invalide.
export function parsePositionValue(value: FormDataEntryValue | null): number {
  if (typeof value !== "string") return 0.5;
  const n = parseFloat(value);
  if (Number.isNaN(n)) return 0.5;
  return Math.min(1, Math.max(0, n));
}

/**
 * Recadre une image en "cover" (remplit exactement la cible, sans
 * déformation) avec un point focal ajustable : positionX/positionY vont de
 * 0 à 1 (0 = bord gauche/haut visible, 1 = bord droit/bas visible, 0.5 =
 * centré). C'est l'équivalent manuel du fit "cover" de sharp, mais avec une
 * position choisie par l'utilisateur plutôt que centrée ou détectée
 * automatiquement (ancien comportement "attention").
 */
export async function coverCropToBuffer(
  image: Buffer,
  targetWidthPx: number,
  targetHeightPx: number,
  positionX = 0.5,
  positionY = 0.5
): Promise<Buffer> {
  const meta = await sharp(image).metadata();
  const origW = meta.width ?? targetWidthPx;
  const origH = meta.height ?? targetHeightPx;
  const scale = Math.max(targetWidthPx / origW, targetHeightPx / origH);
  const scaledW = Math.max(targetWidthPx, Math.round(origW * scale));
  const scaledH = Math.max(targetHeightPx, Math.round(origH * scale));

  const resized = await sharp(image).resize(scaledW, scaledH).toBuffer();

  const clamp01 = (n: number) => Math.min(1, Math.max(0, n));
  const left = Math.round((scaledW - targetWidthPx) * clamp01(positionX));
  const top = Math.round((scaledH - targetHeightPx) * clamp01(positionY));

  return sharp(resized)
    .extract({ left, top, width: targetWidthPx, height: targetHeightPx })
    .toBuffer();
}
