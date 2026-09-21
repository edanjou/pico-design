import {
  PDFDict,
  PDFDocument,
  PDFHexString,
  PDFName,
  PDFOperator,
  PDFOperatorNames,
  cmyk,
  degrees,
  type PDFEmbeddedPage,
  type PDFPage,
  type PDFRef,
} from "pdf-lib";
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
import { computeDuploLayout, type DuploJobGeometry } from "./duplo";
import { regMarkFits, regMarkRects, type RegCorner } from "./regmark";

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

// Code-barres du job Duplo, posé au recto. Il est ancré au coin `corner` de la
// feuille : `xMm` est la distance entre le bord (gauche ou droit) de ce coin et
// le côté du code-barres qui lui fait face, `yMm` celle du bord haut ou bas.
// `rotation` en degrés antihoraires.
export interface ImpositionBarcode {
  pdf: Uint8Array;
  corner: "top-left" | "top-right" | "bottom-left" | "bottom-right";
  xMm: number;
  yMm: number;
  rotation: Rotation;
}

// Repère REG du job Duplo : L noir posé au recto, dans le coin `corner`.
export interface ImpositionRegMark {
  corner: RegCorner;
  sideMm: number;
  leadMm: number;
}

export interface ImposeInput extends LayoutInput {
  sources: ImpositionSource[];
  marks: ImpositionMarks | null;
  flip: FlipEdge;
  // Job de la Duplo : si fourni, la grille en est tirée (marges, espacement et
  // centrage du profil sont alors ignorés ; le décalage de calibration reste).
  duploJob?: DuploJobGeometry | null;
  // Fond perdu par côté, pour retrouver la taille finie des pièces d'un job.
  pieceBleedMm?: number;
  barcode?: ImpositionBarcode | null;
  regMark?: ImpositionRegMark | null;
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

export type Rotation = 0 | 90 | 180 | 270;

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

// Marge blanche (mm) autour du code-barres : zone de silence exigée par le
// code 39 et fond qui l'isole des pièces, comme sur les feuilles de Fiery
// (fond blanc de 3 à 4 mm autour des barres).
const BARCODE_QUIET_ZONE_MM = 3.5;

// Pose la 1re page du PDF du code-barres à sa taille réelle, dans le coin
// d'ancrage, sur un fond blanc, la boîte obtenue APRÈS rotation devant tenir
// sur la feuille.
async function drawBarcode(
  out: PDFDocument,
  sheetPage: ReturnType<PDFDocument["addPage"]>,
  barcode: ImpositionBarcode,
  sheetWidth: number,
  sheetHeight: number
) {
  let embedded: PDFEmbeddedPage;
  try {
    [embedded] = await out.embedPdf(await PDFDocument.load(barcode.pdf), [0]);
  } catch {
    throw new Error("Le PDF du code-barres de ce job est illisible.");
  }
  const turned = barcode.rotation % 180 !== 0;
  const width = mm(turned ? embedded.height : embedded.width);
  const height = mm(turned ? embedded.width : embedded.height);
  const x = barcode.corner.endsWith("right") ? sheetWidth - barcode.xMm - width : barcode.xMm;
  const y = barcode.corner.startsWith("bottom") ? sheetHeight - barcode.yMm - height : barcode.yMm;
  if (
    x < -PAGE_SIZE_TOLERANCE_MM ||
    y < -PAGE_SIZE_TOLERANCE_MM ||
    x + width > sheetWidth + PAGE_SIZE_TOLERANCE_MM ||
    y + height > sheetHeight + PAGE_SIZE_TOLERANCE_MM
  ) {
    throw new Error(
      `Le code-barres (${fmtMm(width)} × ${fmtMm(height)}) déborde de la feuille à cette position : ` +
        "ajustez sa position dans le profil de découpeuse."
    );
  }
  // Fond blanc (borné à la feuille), puis le code-barres par-dessus.
  const q = BARCODE_QUIET_ZONE_MM;
  const left = Math.max(0, x - q);
  const top = Math.max(0, y - q);
  const backdrop = toPdfRect(
    {
      col: 0,
      row: 0,
      x: left,
      y: top,
      width: Math.min(sheetWidth, x + width + q) - left,
      height: Math.min(sheetHeight, y + height + q) - top,
    },
    sheetHeight
  );
  sheetPage.drawRectangle({ ...backdrop, color: cmyk(0, 0, 0, 0), borderWidth: 0 });
  drawInCell(
    sheetPage,
    embedded,
    toPdfRect({ col: 0, row: 0, x, y, width, height }, sheetHeight),
    barcode.rotation
  );
}

// Repère REG : deux traits noirs (K seul) formant un L.
function drawRegMark(
  sheetPage: ReturnType<PDFDocument["addPage"]>,
  reg: ImpositionRegMark,
  sheetWidth: number,
  sheetHeight: number
) {
  const rects = regMarkRects(reg.corner, reg.sideMm, reg.leadMm, sheetWidth, sheetHeight);
  if (!regMarkFits(rects, sheetWidth, sheetHeight)) {
    throw new Error(
      `Le repère REG de ce job (à ${fmtMm(reg.sideMm)} × ${fmtMm(reg.leadMm)} du bord) déborde de la feuille.`
    );
  }
  for (const r of rects) {
    sheetPage.drawRectangle({
      ...toPdfRect({ col: 0, row: 0, ...r }, sheetHeight),
      color: cmyk(0, 0, 0, 1),
      borderWidth: 0,
    });
  }
}

// Calques du PDF (groupes de contenu optionnel, visibles dans le panneau des
// calques d'Acrobat ou d'Illustrator). Ils sont créés du plus bas au plus haut :
// le premier calque est dessiné en premier, les suivants passent par-dessus.
interface Layer {
  key: string;
  ref: PDFRef;
}

class Layers {
  private layers: Layer[] = [];

  constructor(private out: PDFDocument) {}

  add(name: string): Layer {
    const ref = this.out.context.register(
      this.out.context.obj({ Type: "OCG", Name: PDFHexString.fromText(name.slice(0, 80)) })
    );
    const layer = { key: `Calque${this.layers.length + 1}`, ref };
    this.layers.push(layer);
    return layer;
  }

  // Déclare les calques dans le catalogue, tous visibles. Le panneau les liste
  // du plus haut au plus bas, comme Illustrator : le premier calque est en bas.
  finish() {
    if (this.layers.length === 0) return;
    const refs = this.layers.map((l) => l.ref);
    this.out.catalog.set(
      PDFName.of("OCProperties"),
      this.out.context.obj({ OCGs: refs, D: { BaseState: "ON", Order: [...refs].reverse(), ON: refs } })
    );
  }
}

// Exécute `draw` (dessin sur `page`) à l'intérieur du calque : le contenu est
// encadré par /OC … BDC … EMC, et le calque est déclaré dans les ressources de la page.
async function inLayer(page: PDFPage, layer: Layer, draw: () => void | Promise<void>) {
  const resources = page.node.normalizedEntries().Resources;
  let properties = resources.lookupMaybe(PDFName.of("Properties"), PDFDict);
  if (!properties) {
    properties = page.doc.context.obj({});
    resources.set(PDFName.of("Properties"), properties);
  }
  properties.set(PDFName.of(layer.key), layer.ref);
  page.pushOperators(
    PDFOperator.of(PDFOperatorNames.BeginMarkedContentSequence, [PDFName.of("OC"), PDFName.of(layer.key)])
  );
  await draw();
  page.pushOperators(PDFOperator.of(PDFOperatorNames.EndMarkedContent));
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
  let layout: Layout | null;
  if (input.duploJob) {
    layout = computeDuploLayout({
      job: input.duploJob,
      sheetWidth: input.sheetWidth,
      sheetHeight: input.sheetHeight,
      pieceWidth: input.pieceWidth,
      pieceHeight: input.pieceHeight,
      bleedMm: input.pieceBleedMm ?? 0,
      orientation: input.orientation,
      offsetX: input.offsetX,
      offsetY: input.offsetY,
    });
    if (!layout) throw new Error("Ce job Duplo ne convient pas à cette feuille ou à ce format de pièce.");
  } else {
    layout = computeLayout(input);
  }
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

  const layers = new Layers(out);
  const front = out.addPage([sheetWidthPt, sheetHeightPt]);
  // Un PDF déjà dans le sens de la cellule reste à l'endroit ; sinon (cellule
  // couchée, ou PDF fourni dans l'orientation inverse du format) on le tourne
  // de 90°. Le verso reprend la rotation du recto (voir plus bas).
  function frontRotationFor(source: PreparedSource, cell: Cell): Rotation {
    return close(source.pageWidth, cell.width) && close(source.pageHeight, cell.height) ? 0 : 90;
  }

  // Premier calque (en bas) : le code-barres et les repères. Les visuels passent
  // par-dessus, un calque par visuel, aussi bien au recto qu'au verso.
  if (input.marks || input.barcode || input.regMark) {
    await inLayer(front, layers.add("Marques (code-barres et repère REG)"), async () => {
      if (input.marks) await drawMarks(out, front, input.marks, sheetWidthPt, sheetHeightPt);
      if (input.barcode) await drawBarcode(out, front, input.barcode, input.sheetWidth, input.sheetHeight);
      if (input.regMark) drawRegMark(front, input.regMark, input.sheetWidth, input.sheetHeight);
    });
  }
  const usedSources = [...new Set(assignment.filter((a): a is number => a !== null))].sort((a, b) => a - b);
  const visualLayers = new Map<number, Layer>(
    usedSources.map((index) => [index, layers.add(`Visuel ${index + 1} — ${prepared[index].name}`)])
  );
  for (const index of usedSources) {
    await inLayer(front, visualLayers.get(index)!, () => {
      layout.cells.forEach((cell, i) => {
        if (assignment[i] !== index) return;
        const source = prepared[index];
        drawInCell(front, source.front, toPdfRect(cell, input.sheetHeight), frontRotationFor(source, cell));
      });
    });
  }

  // Verso : seulement pour les sources qui ont une 2e page, aux positions
  // miroir du recto, sans marques (la découpeuse lit le recto).
  const hasBack = assignment.some((a) => a !== null && prepared[a].back !== null);
  if (hasBack) {
    const verticalAxis = flipAxisIsVertical(input.sheetWidth, input.sheetHeight, input.flip);
    const back = out.addPage([sheetWidthPt, sheetHeightPt]);
    for (const index of usedSources) {
      const source = prepared[index];
      if (!source.back) continue;
      const sourceBack = source.back;
      await inLayer(back, visualLayers.get(index)!, () => {
        layout.cells.forEach((cell, i) => {
          if (assignment[i] !== index) return;
          const frontTotal = frontRotationFor(source, cell);
          // Le verso se tourne comme un feuillet : si l'axe de retournement de la
          // feuille n'est pas celui de la pièce (pièce couchée sur la feuille), le
          // verso doit être tourné de 180° de plus pour rester à l'endroit.
          const cardAxisVertical = frontTotal % 180 === 0;
          const backRotation = ((frontTotal + (cardAxisVertical === verticalAxis ? 0 : 180)) %
            360) as Rotation;
          const mirrored = mirrorCell(cell, input.sheetWidth, input.sheetHeight, verticalAxis);
          drawInCell(back, sourceBack, toPdfRect(mirrored, input.sheetHeight), backRotation);
        });
      });
    }
  }

  layers.finish();
  return { pdf: Buffer.from(await out.save()), layout, placed, hasBack };
}
