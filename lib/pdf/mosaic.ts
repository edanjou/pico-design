import sharp from "sharp";
import { coverCropToBuffer } from "./crop";

/**
 * Compose une mosaïque de plusieurs photos distinctes (par opposition à
 * `composeTiledImage`, qui répète UN seul visuel de la banque en motif) : la
 * page cible est divisée en `cols`×`rows` cellules égales, chaque image est
 * recadrée en "cover" (centrée, sans marge) dans sa propre cellule — comme
 * autant de mini `coverCropToBuffer` côte à côte. Une cellule sans image
 * (`null`) reste blanche, comme un fond absent (voir coverCropToBuffer) :
 * permet de composer une mosaïque partiellement remplie plutôt que d'exiger
 * que toutes les cases soient prises.
 *
 * Les bords des cellules sont arrondis indépendamment (`colEdges`/`rowEdges`,
 * plutôt qu'une largeur/hauteur de cellule fixe multipliée) pour que la
 * dernière colonne/ligne absorbe l'arrondi cumulé et que la mosaïque couvre
 * exactement la cible, sans liseré blanc sur le bord droit/bas.
 */
export async function composeMosaicImage(
  cells: (Buffer | null)[],
  cols: number,
  rows: number,
  targetWidthPx: number,
  targetHeightPx: number
): Promise<Buffer> {
  const c = Math.max(1, Math.floor(cols));
  const r = Math.max(1, Math.floor(rows));
  const colEdges = Array.from({ length: c + 1 }, (_, i) => Math.round((i * targetWidthPx) / c));
  const rowEdges = Array.from({ length: r + 1 }, (_, i) => Math.round((i * targetHeightPx) / r));

  const composites: { input: Buffer; left: number; top: number }[] = [];
  for (let row = 0; row < r; row++) {
    for (let col = 0; col < c; col++) {
      const cell = cells[row * c + col] ?? null;
      const cellWidth = colEdges[col + 1] - colEdges[col];
      const cellHeight = rowEdges[row + 1] - rowEdges[row];
      if (!cell || cellWidth <= 0 || cellHeight <= 0) continue;
      const cropped = await coverCropToBuffer(cell, cellWidth, cellHeight);
      composites.push({ input: cropped, left: colEdges[col], top: rowEdges[row] });
    }
  }

  return sharp({
    create: { width: targetWidthPx, height: targetHeightPx, channels: 3, background: "#ffffff" },
  })
    .composite(composites)
    .jpeg({ quality: 92 })
    .toBuffer();
}
