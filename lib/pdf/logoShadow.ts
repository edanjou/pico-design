import sharp from "sharp";

// Ombre portée du logo / de la pastille. Tous les réglages sont
// proportionnels à la largeur du logo, pour que l'ombre ait la même allure
// quelle que soit la taille du logo sur le produit.
const SHADOW_BLUR_RATIO = 0.025; // écart-type du flou
const SHADOW_OFFSET_X_RATIO = 0.012;
const SHADOW_OFFSET_Y_RATIO = 0.03;
const SHADOW_OPACITY = 0.4;

export interface ShadowedLogo {
  // Le logo sur son ombre, sur un canevas agrandi de `pad` pixels de chaque côté.
  png: Buffer;
  pad: number;
}

/**
 * Ajoute une ombre portée douce (noire, décalée vers le bas et légèrement à
 * droite) à un logo PNG à fond transparent. Le logo lui-même n'est ni déplacé
 * ni redimensionné : seule la marge `pad` est ajoutée autour pour que l'ombre
 * ne soit pas coupée — l'appelant doit décaler la position de `pad` pixels
 * vers le haut/la gauche pour que le logo reste exactement à sa place.
 */
export async function addDropShadow(logoPng: Buffer): Promise<ShadowedLogo> {
  const { width = 1, height = 1 } = await sharp(logoPng).metadata();
  const sigma = Math.max(0.5, width * SHADOW_BLUR_RATIO);
  const dx = Math.round(width * SHADOW_OFFSET_X_RATIO);
  const dy = Math.round(width * SHADOW_OFFSET_Y_RATIO);
  // Le flou s'étend sur ~3 écarts-types, en plus du décalage.
  const pad = Math.ceil(sigma * 3 + Math.max(dx, dy)) + 1;
  const canvasWidth = width + pad * 2;
  const canvasHeight = height + pad * 2;

  // Silhouette noire du logo, à l'opacité voulue (on ne touche qu'au canal alpha).
  const silhouette = await sharp(logoPng)
    .ensureAlpha()
    .linear([0, 0, 0, SHADOW_OPACITY], [0, 0, 0, 0])
    .png()
    .toBuffer();

  const offsetSilhouette = await sharp({
    create: { width: canvasWidth, height: canvasHeight, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
  })
    .composite([{ input: silhouette, left: pad + dx, top: pad + dy }])
    .png()
    .toBuffer();

  // Le flou est appliqué dans une étape séparée : sharp exécute `composite`
  // après ses autres opérations, un `blur` chaîné ne flouterait pas la silhouette.
  const blurred = await sharp(offsetSilhouette).blur(sigma).png().toBuffer();

  const png = await sharp(blurred)
    .composite([{ input: logoPng, left: pad, top: pad }])
    .png()
    .toBuffer();
  return { png, pad };
}

/**
 * Prépare le calque « logo » d'un `composite` sharp, avec ou sans ombre.
 * `left`/`top` sont la position du logo lui-même sur le canevas de taille
 * `canvasWidth × canvasHeight` ; avec l'ombre, l'image est agrandie de sa
 * marge puis rognée à ce qui reste dans le canevas (sharp refuse un calque
 * qui dépasse).
 */
export async function logoOverlay(
  logoPng: Buffer,
  shadow: boolean,
  left: number,
  top: number,
  canvasWidth: number,
  canvasHeight: number
): Promise<sharp.OverlayOptions> {
  if (!shadow) return { input: logoPng, left, top };

  const { png, pad } = await addDropShadow(logoPng);
  const { width = 1, height = 1 } = await sharp(png).metadata();
  const x = left - pad;
  const y = top - pad;
  const x0 = Math.max(0, x);
  const y0 = Math.max(0, y);
  const x1 = Math.min(canvasWidth, x + width);
  const y1 = Math.min(canvasHeight, y + height);
  if (x0 === x && y0 === y && x1 === x + width && y1 === y + height) {
    return { input: png, left: x, top: y };
  }
  const cropped = await sharp(png)
    .extract({ left: x0 - x, top: y0 - y, width: x1 - x0, height: y1 - y0 })
    .png()
    .toBuffer();
  return { input: cropped, left: x0, top: y0 };
}
