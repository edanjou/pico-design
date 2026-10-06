// Imposition d'un DOCUMENT de plusieurs pages (ex. 50 pages 8,5 × 11) en
// feuilles séparées, coupées au massicot — par opposition aux pièces (cartes,
// aimants…) répétées sur une feuille. Fonctions pures, partagées entre
// l'aperçu (écran) et le PDF (serveur) : les deux montrent le même plan.
//
// Vocabulaire :
//   * page   : une page du PDF du client ;
//   * feuillet (leaf) : une pièce finie, une fois coupée. En recto seul, un
//     feuillet porte une page ; en recto-verso, deux (page impaire au recto,
//     paire au verso) ;
//   * pose (slot) : un emplacement de la grille sur la feuille d'impression ;
//   * feuille : une feuille d'impression (recto, et verso si recto-verso).
//
// Ordre « couper et empiler » : les feuillets sont distribués pose par pose,
// pas feuille par feuille. La pose 1 reçoit les feuillets 1 à S (S = nombre de
// feuilles), la pose 2 les suivants, etc. Une fois la pile de feuilles coupée,
// on pose la pile de la pose 2 sous celle de la pose 1, et ainsi de suite : le
// tout est dans l'ordre, exemplaire après exemplaire. Le PDF s'imprime donc en
// UN seul exemplaire : les copies du document y sont déjà.

import { computeLayout, type Layout } from "./layout";

export interface DocumentPlanInput {
  sheetWidth: number;
  sheetHeight: number;
  // Marge minimale de chaque côté de la feuille (zone non imprimable,
  // place des traits de coupe), en mm.
  marginMm: number;
  // Espace entre deux pages voisines, en mm (0 = bord à bord, coupe double au
  // milieu du fond perdu).
  gutterMm: number;
  // Taille d'une page du PDF, fond perdu compris, en mm.
  pageWidth: number;
  pageHeight: number;
  pageCount: number;
  duplex: boolean;
  copies: number;
}

export interface DocumentPlan {
  layout: Layout;
  // Feuillets d'un exemplaire, et au total (tous exemplaires).
  leavesPerCopy: number;
  totalLeaves: number;
  // Poses par feuille, et feuilles d'impression nécessaires.
  perSheet: number;
  sheets: number;
}

export interface LeafPages {
  copy: number; // exemplaire, à partir de 0
  front: number; // index de page (0 = page 1) au recto
  back: number | null; // index de page au verso, ou null (recto seul, ou page manquante)
}

export const MAX_DOCUMENT_COPIES = 500;

export function planDocument(input: DocumentPlanInput): DocumentPlan {
  const layout = computeLayout({
    sheetWidth: input.sheetWidth,
    sheetHeight: input.sheetHeight,
    margins: { top: input.marginMm, right: input.marginMm, bottom: input.marginMm, left: input.marginMm },
    gutterX: input.gutterMm,
    gutterY: input.gutterMm,
    offsetX: 0,
    offsetY: 0,
    centerGrid: true,
    pieceWidth: input.pageWidth,
    pieceHeight: input.pageHeight,
    // Autant de pages que possible, dans le sens qui en met le plus.
    orientation: "auto",
  });
  const pageCount = Math.max(0, Math.floor(input.pageCount));
  const copies = Math.max(1, Math.floor(input.copies));
  const leavesPerCopy = input.duplex ? Math.ceil(pageCount / 2) : pageCount;
  const totalLeaves = leavesPerCopy * copies;
  const perSheet = layout.cells.length;
  const sheets = perSheet > 0 && totalLeaves > 0 ? Math.ceil(totalLeaves / perSheet) : 0;
  return { layout, leavesPerCopy, totalLeaves, perSheet, sheets };
}

// Le feuillet placé à la pose `slot` de la feuille `sheet` (ordre « couper et
// empiler »), ou null si la pose reste vide (fin du dernier paquet).
export function leafAt(plan: DocumentPlan, sheet: number, slot: number, duplex: boolean, pageCount: number): LeafPages | null {
  const leaf = slot * plan.sheets + sheet;
  if (leaf >= plan.totalLeaves || plan.leavesPerCopy === 0) return null;
  const copy = Math.floor(leaf / plan.leavesPerCopy);
  const inCopy = leaf % plan.leavesPerCopy;
  if (!duplex) return { copy, front: inCopy, back: null };
  const front = inCopy * 2;
  const back = front + 1 < pageCount ? front + 1 : null;
  return { copy, front, back };
}
