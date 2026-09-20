// Calcul de la grille d'imposition — fonctions pures (aucune dépendance
// serveur), partagées entre l'aperçu côté client et la génération du PDF
// côté serveur pour que les deux montrent toujours exactement la même chose.
//
// Toutes les valeurs sont en mm. Les coordonnées des cellules ont l'origine
// en HAUT à gauche de la feuille (comme à l'écran) ; la conversion vers le
// repère PDF (origine en bas à gauche) se fait au moment du dessin.

export type PieceOrientation = "auto" | "normal" | "rotated";

export interface SheetMargins {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

export interface LayoutInput {
  sheetWidth: number;
  sheetHeight: number;
  margins: SheetMargins;
  // Espace entre deux pièces voisines (bord de fond perdu à bord de fond perdu).
  gutterX: number;
  gutterY: number;
  // Décalage de calibration de la découpeuse, appliqué à toute la grille
  // (positif = vers la droite / vers le bas).
  offsetX: number;
  offsetY: number;
  // Centre la grille dans la zone utile (sinon, collée en haut à gauche).
  centerGrid: boolean;
  // Taille d'une pièce, fond perdu inclus (= taille de la page du PDF source).
  pieceWidth: number;
  pieceHeight: number;
  orientation: PieceOrientation;
}

export interface Cell {
  col: number;
  row: number;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface Layout {
  cols: number;
  rows: number;
  // Vrai si les pièces sont tournées de 90° sur la feuille.
  rotated: boolean;
  cellWidth: number;
  cellHeight: number;
  cells: Cell[];
  // Zone utile (feuille moins marges), pour l'aperçu.
  usable: { x: number; y: number; width: number; height: number };
}

// Tolérance sur les comparaisons de longueurs, en mm : absorbe les erreurs
// d'arrondi des conversions po/mm/pt sans jamais faire passer une pièce qui
// déborde vraiment.
export const LENGTH_EPSILON_MM = 0.01;

function fitCount(available: number, size: number, gutter: number): number {
  if (size <= 0 || available + LENGTH_EPSILON_MM < size) return 0;
  return Math.floor((available + gutter + LENGTH_EPSILON_MM) / (size + gutter));
}

export function computeLayout(input: LayoutInput): Layout {
  const { margins } = input;
  const usable = {
    x: margins.left,
    y: margins.top,
    width: input.sheetWidth - margins.left - margins.right,
    height: input.sheetHeight - margins.top - margins.bottom,
  };

  function candidate(rotated: boolean) {
    const cellWidth = rotated ? input.pieceHeight : input.pieceWidth;
    const cellHeight = rotated ? input.pieceWidth : input.pieceHeight;
    const cols = fitCount(usable.width, cellWidth, input.gutterX);
    const rows = fitCount(usable.height, cellHeight, input.gutterY);
    return { rotated, cellWidth, cellHeight, cols, rows, count: cols * rows };
  }

  const normal = candidate(false);
  const turned = candidate(true);
  let chosen = normal;
  if (input.orientation === "rotated") chosen = turned;
  else if (input.orientation === "auto" && turned.count > normal.count) chosen = turned;

  const { cols, rows, cellWidth, cellHeight, rotated } = chosen;
  const gridWidth = cols * cellWidth + Math.max(cols - 1, 0) * input.gutterX;
  const gridHeight = rows * cellHeight + Math.max(rows - 1, 0) * input.gutterY;
  const originX =
    usable.x + (input.centerGrid ? (usable.width - gridWidth) / 2 : 0) + input.offsetX;
  const originY =
    usable.y + (input.centerGrid ? (usable.height - gridHeight) / 2 : 0) + input.offsetY;

  const cells: Cell[] = [];
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      cells.push({
        col,
        row,
        x: originX + col * (cellWidth + input.gutterX),
        y: originY + row * (cellHeight + input.gutterY),
        width: cellWidth,
        height: cellHeight,
      });
    }
  }

  return { cols, rows, rotated, cellWidth, cellHeight, cells, usable };
}

export interface SourceCopies {
  copies: number;
}

// Répartit les cellules (ordre de lecture : gauche→droite, haut→bas) entre
// les sources : chacune reçoit ses copies d'un seul bloc, dans l'ordre de la
// liste. Retourne, pour chaque cellule, l'index de la source (ou null si
// vide), ainsi que le nombre de copies qui ne tiennent pas.
export function assignCells(
  sources: SourceCopies[],
  cellCount: number
): { assignment: (number | null)[]; overflow: number } {
  const assignment: (number | null)[] = new Array(cellCount).fill(null);
  let next = 0;
  let overflow = 0;
  sources.forEach((source, index) => {
    const copies = Math.max(0, Math.floor(source.copies));
    for (let i = 0; i < copies; i++) {
      if (next < cellCount) assignment[next++] = index;
      else overflow++;
    }
  });
  return { assignment, overflow };
}

export type FlipEdge = "long" | "short";

// Recto-verso : la feuille est retournée autour d'un axe pour imprimer le
// verso. Retourne `true` si cet axe est vertical (le verso est alors miroité
// horizontalement : une pièce en colonne c se retrouve en colonne cols-1-c),
// `false` s'il est horizontal (miroir vertical).
export function flipAxisIsVertical(sheetWidth: number, sheetHeight: number, edge: FlipEdge): boolean {
  const portrait = sheetHeight >= sheetWidth;
  // Portrait : le bord long est vertical, on tourne la feuille autour de lui.
  return edge === "long" ? portrait : !portrait;
}

// Position miroir d'une cellule du recto pour le verso, selon l'axe de retournement.
export function mirrorCell(
  cell: Cell,
  sheetWidth: number,
  sheetHeight: number,
  verticalAxis: boolean
): Cell {
  return verticalAxis
    ? { ...cell, x: sheetWidth - cell.x - cell.width }
    : { ...cell, y: sheetHeight - cell.y - cell.height };
}
