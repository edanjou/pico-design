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

  // Décalage de phase du motif (0.5 = origine par défaut, non décalée).
  // Une plage de 0..1 couvre déjà une période complète : au-delà, le motif
  // ne fait que se répéter, donc pas besoin d'un décalage non borné.
  const clamp01 = (n: number) => Math.min(1, Math.max(0, n));
  const offsetX = (0.5 - clamp01(positionX)) * tileWidthPx;
  const offsetY = (0.5 - clamp01(positionY)) * tileHeightPx;

  const décalée = await décalerTuile(tilePng, tileWidthPx, tileHeightPx, offsetX, offsetY);

  // Une tuile plus grande que la page ne se répète pas : elle déborde, et
  // seul son coin supérieur gauche est visible. `composite` refuse une image
  // plus grande que la base (« Image to composite must have same dimensions
  // or smaller »), là où un <pattern> SVG se contentait de la rogner — on
  // rogne donc explicitement. Sur l'axe où la tuile tient, rien ne change et
  // la répétition reste entière.
  const largeurMotif = Math.min(tileWidthPx, targetWidthPx);
  const hauteurMotif = Math.min(tileHeightPx, targetHeightPx);
  const motif =
    largeurMotif === tileWidthPx && hauteurMotif === tileHeightPx
      ? décalée
      : await sharp(décalée)
          .extract({ left: 0, top: 0, width: largeurMotif, height: hauteurMotif })
          .png()
          .toBuffer();

  // Répétition par sharp plutôt que par un <pattern> SVG. L'ancienne version
  // intégrait la tuile en base64 dans un attribut href : au-delà de ~10 Mo,
  // libxml2 refuse le document entier (« Buffer size limit exceeded, try
  // XML_PARSE_HUGE »), et une tuile de grande taille — une répétition large
  // à 300 dpi — franchit ce seuil sans rien faire d'anormal. Le texte n'est
  // plus un intermédiaire : les pixels vont directement d'un buffer à
  // l'autre, sans limite d'analyseur XML.
  return sharp({
    create: {
      width: targetWidthPx,
      height: targetHeightPx,
      channels: 3,
      background: "#ffffff",
    },
  })
    // `gravity` est indispensable : sans elle, sharp CENTRE la répétition,
    // là où un <pattern> SVG part de l'origine — le motif entier se
    // retrouvait décalé d'une fraction de tuile.
    .composite([{ input: motif, tile: true, gravity: "northwest" }])
    .jpeg({ quality: 92 })
    .toBuffer();
}

/**
 * Applique le décalage de phase À LA TUILE elle-même, par enroulement : ce
 * qui sort d'un côté rentre de l'autre. Une tuile ainsi décalée, répétée
 * depuis l'origine, donne exactement le motif que produisait l'attribut
 * x/y du <pattern> SVG.
 *
 * En quatre morceaux plutôt qu'un déplacement négatif : `composite`
 * n'accepte pas d'offset négatif, et découper puis recoller reste exact au
 * pixel près.
 *
 * Seule différence avec le <pattern> SVG : le décalage s'aligne sur le pixel
 * entier au lieu d'accepter une position fractionnaire. Sur un motif qui se
 * répète, une fraction de pixel ne se voit pas — et elle obligeait librsvg à
 * rééchantillonner la tuile, ce qui adoucissait ses bords.
 */
async function décalerTuile(
  tile: Buffer,
  width: number,
  height: number,
  offsetX: number,
  offsetY: number
): Promise<Buffer> {
  const modulo = (n: number, m: number) => ((Math.round(n) % m) + m) % m;
  const dx = modulo(offsetX, width);
  const dy = modulo(offsetY, height);
  if (dx === 0 && dy === 0) return tile;

  // Chaque morceau : la région prise dans la tuile, et où elle atterrit.
  const morceaux = [
    { left: width - dx, top: height - dy, w: dx, h: dy, x: 0, y: 0 },
    { left: 0, top: height - dy, w: width - dx, h: dy, x: dx, y: 0 },
    { left: width - dx, top: 0, w: dx, h: height - dy, x: 0, y: dy },
    { left: 0, top: 0, w: width - dx, h: height - dy, x: dx, y: dy },
  ].filter((m) => m.w > 0 && m.h > 0);

  const overlays = await Promise.all(
    morceaux.map(async (m) => ({
      input: await sharp(tile).extract({ left: m.left, top: m.top, width: m.w, height: m.h }).toBuffer(),
      left: m.x,
      top: m.y,
    }))
  );

  return sharp({
    create: { width, height, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
  })
    .composite(overlays)
    .png()
    .toBuffer();
}
