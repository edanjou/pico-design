import { PDFDocument, degrees, type PDFEmbeddedPage } from "pdf-lib";
import { MM_TO_PT, mmToPt } from "../pdf/units";
import {
  assignCells,
  computeLayout,
  flipAxisIsVertical,
  mirrorCell,
  type Cell,
  type FlipEdge,
  type Layout,
  type LayoutInput,
} from "./layout";

export interface ImpositionSource {
  name: string;
  pdf: Uint8Array;
  copies: number;
}

export type MarksKind = "pdf" | "png" | "jpg";

export interface ImpositionMarks {
  bytes: Uint8Array;
  kind: MarksKind;
}

export interface ImposeInput extends LayoutInput {
  sources: ImpositionSource[];
  marks: ImpositionMarks | null;
  flip: FlipEdge;
}

export interface ImposeResult {
  pdf: Buffer;
  layout: Layout;
  placed: number;
  hasBack: boolean;
}

// Écart toléré (mm) entre la taille de page d'un PDF source et celle du
// format choisi : absorbe les arrondis des logiciels de mise en page sans
// laisser passer une pièce qui déborderait sur sa voisine.
const PAGE_SIZE_TOLERANCE_MM = 0.1;

type Rotation = 0 | 90 | 180 | 270;

interface PreparedSource {
  name: string;
  front: PDFEmbeddedPage;
  back: PDFEmbeddedPage | null;
  // Taille de la page source (mm) : sert à décider si elle entre telle quelle
  // dans une cellule ou s'il faut la tourner de 90°.
  pageWidth: number;
  pageHeight: number;
}

function mm(pt: number): number {
  return pt / MM_TO_PT;
}

function fmtMm(value: number): string {
  return `${Math.round(value * 100) / 100} mm`;
}

function close(a: number, b: number): boolean {
  return Math.abs(a - b) <= PAGE_SIZE_TOLERANCE_MM;
}

async function prepareSource(
  out: PDFDocument,
  source: ImpositionSource,
  pieceWidth: number,
  pieceHeight: number
): Promise<PreparedSource> {
  let doc: PDFDocument;
  try {
    doc = await PDFDocument.load(source.pdf);
  } catch {
    throw new Error(`« ${source.name} » n'est pas un PDF lisible.`);
  }
  const pages = doc.getPages();
  if (pages.length === 0) throw new Error(`« ${source.name} » ne contient aucune page.`);

  // pdf-lib intègre les pages sans tenir compte de /Rotate : on refuse plutôt
  // que d'imprimer une pièce de travers.
  if (pages.some((p) => p.getRotation().angle % 360 !== 0)) {
    throw new Error(
      `« ${source.name} » contient une page pivotée (attribut de rotation). Ré-exportez le PDF sans rotation de page.`
    );
  }

  const { width, height } = pages[0].getSize();
  const w = mm(width);
  const h = mm(height);
  const fitsAsIs = close(w, pieceWidth) && close(h, pieceHeight);
  const fitsTurned = close(w, pieceHeight) && close(h, pieceWidth);
  if (!fitsAsIs && !fitsTurned) {
    throw new Error(
      `« ${source.name} » mesure ${fmtMm(w)} × ${fmtMm(h)}, mais le format choisi mesure ${fmtMm(
        pieceWidth
      )} × ${fmtMm(pieceHeight)} (fond perdu inclus).`
    );
  }

  if (pages.length > 1) {
    const { width: bw, height: bh } = pages[1].getSize();
    if (!close(mm(bw), w) || !close(mm(bh), h)) {
      throw new Error(`Le verso de « ${source.name} » n'a pas la même taille que son recto.`);
    }
  }

  const indices = pages.length > 1 ? [0, 1] : [0];
  const embedded = await out.embedPdf(doc, indices);
  return { name: source.name, front: embedded[0], back: embedded[1] ?? null, pageWidth: w, pageHeight: h };
}

// Dessine `page` à sa taille réelle dans une cellule (coordonnées en points,
// origine en bas à gauche), tournée de `rotation` degrés (sens antihoraire).
// pdf-lib tourne autour du point d'insertion : on le place donc au coin
// de la cellule qui, après rotation, devient son coin bas-gauche.
function drawInCell(
  sheetPage: ReturnType<PDFDocument["addPage"]>,
  page: PDFEmbeddedPage,
  cell: { x: number; y: number; width: number; height: number },
  rotation: Rotation
) {
  let x = cell.x;
  let y = cell.y;
  if (rotation === 90) x = cell.x + cell.width;
  else if (rotation === 180) {
    x = cell.x + cell.width;
    y = cell.y + cell.height;
  } else if (rotation === 270) y = cell.y + cell.height;
  sheetPage.drawPage(page, { x, y, width: page.width, height: page.height, rotate: degrees(rotation) });
}

function toPdfRect(cell: Cell, sheetHeight: number) {
  return {
    x: mmToPt(cell.x),
    y: mmToPt(sheetHeight - cell.y - cell.height),
    width: mmToPt(cell.width),
    height: mmToPt(cell.height),
  };
}

async function drawMarks(
  out: PDFDocument,
  sheetPage: ReturnType<PDFDocument["addPage"]>,
  marks: ImpositionMarks,
  sheetWidthPt: number,
  sheetHeightPt: number
) {
  if (marks.kind === "pdf") {
    const [embedded] = await out.embedPdf(await PDFDocument.load(marks.bytes), [0]);
    // Taille réelle, centrée : un fichier de marques de la taille de la
    // feuille tombe pile, un fichier plus petit reste bien centré.
    sheetPage.drawPage(embedded, {
      x: (sheetWidthPt - embedded.width) / 2,
      y: (sheetHeightPt - embedded.height) / 2,
      width: embedded.width,
      height: embedded.height,
    });
    return;
  }
  const image = marks.kind === "png" ? await out.embedPng(marks.bytes) : await out.embedJpg(marks.bytes);
  // Une image n'a pas de taille physique fiable : on la considère comme un
  // calque de la taille de la feuille.
  sheetPage.drawImage(image, { x: 0, y: 0, width: sheetWidthPt, height: sheetHeightPt });
}

export async function imposeToPdf(input: ImposeInput): Promise<ImposeResult> {
  const layout = computeLayout(input);
  if (layout.cells.length === 0) {
    throw new Error(
      `Le format (${fmtMm(input.pieceWidth)} × ${fmtMm(
        input.pieceHeight
      )}) ne rentre pas dans la zone utile de la feuille.`
    );
  }

  const { assignment, overflow } = assignCells(input.sources, layout.cells.length);
  if (overflow > 0) {
    throw new Error(
      `Trop de copies : ${overflow} de plus que les ${layout.cells.length} emplacements de la feuille.`
    );
  }
  const placed = assignment.filter((a) => a !== null).length;
  if (placed === 0) throw new Error("Aucune copie à placer sur la feuille.");

  const out = await PDFDocument.create();
  const prepared: PreparedSource[] = [];
  for (const source of input.sources) {
    prepared.push(await prepareSource(out, source, input.pieceWidth, input.pieceHeight));
  }

  const sheetWidthPt = mmToPt(input.sheetWidth);
  const sheetHeightPt = mmToPt(input.sheetHeight);

  const front = out.addPage([sheetWidthPt, sheetHeightPt]);
  // Un PDF déjà dans le sens de la cellule reste à l'endroit ; sinon (cellule
  // couchée, ou PDF fourni dans l'orientation inverse du format) on le tourne
  // de 90°. Le verso reprend la rotation du recto (voir plus bas).
  function frontRotationFor(source: PreparedSource, cell: Cell): Rotation {
    return close(source.pageWidth, cell.width) && close(source.pageHeight, cell.height) ? 0 : 90;
  }
  layout.cells.forEach((cell, i) => {
    const sourceIndex = assignment[i];
    if (sourceIndex === null) return;
    const source = prepared[sourceIndex];
    drawInCell(front, source.front, toPdfRect(cell, input.sheetHeight), frontRotationFor(source, cell));
  });
  // Marques par-dessus : elles vivent dans les marges, hors des pièces.
  if (input.marks) await drawMarks(out, front, input.marks, sheetWidthPt, sheetHeightPt);

  // Verso : seulement pour les sources qui ont une 2e page, aux positions
  // miroir du recto, sans marques (la découpeuse lit le recto).
  const hasBack = assignment.some((a) => a !== null && prepared[a].back !== null);
  if (hasBack) {
    const verticalAxis = flipAxisIsVertical(input.sheetWidth, input.sheetHeight, input.flip);
    const back = out.addPage([sheetWidthPt, sheetHeightPt]);
    layout.cells.forEach((cell, i) => {
      const sourceIndex = assignment[i];
      if (sourceIndex === null) return;
      const source = prepared[sourceIndex];
      if (!source.back) return;
      const frontTotal = frontRotationFor(source, cell);
      // Le verso se tourne comme un feuillet : si l'axe de retournement de la
      // feuille n'est pas celui de la pièce (pièce couchée sur la feuille), le
      // verso doit être tourné de 180° de plus pour rester à l'endroit.
      const cardAxisVertical = frontTotal % 180 === 0;
      const backRotation = ((frontTotal + (cardAxisVertical === verticalAxis ? 0 : 180)) %
        360) as Rotation;
      const mirrored = mirrorCell(cell, input.sheetWidth, input.sheetHeight, verticalAxis);
      drawInCell(back, source.back, toPdfRect(mirrored, input.sheetHeight), backRotation);
    });
  }

  return { pdf: Buffer.from(await out.save()), layout, placed, hasBack };
}
