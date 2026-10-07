// Où se pose la planche d'autocollants sur la feuille d'impression. Pure,
// partagée entre l'éditeur et le rendu PDF.
//
// Sans profil Graphtec : la planche occupe toute la feuille (taille du
// modèle). Avec un profil : la feuille est celle du profil, et la planche se
// pose dans ses marges, décalée par sa calibration — comme les pièces d'une
// imposition Graphtec. Les zones de nom sont mesurées depuis le coin de la
// planche : elles suivent la calibration avec le visuel.

import type { ImpositionCutter, ImpositionSheet } from "@/lib/types";

export interface StickerSheetLayout {
  sheetWidth: number;
  sheetHeight: number;
  // La planche (visuel et zones), en mm sur la feuille.
  area: { x: number; y: number; width: number; height: number };
}

export function stickerSheetLayout(
  size: { width_mm: number; height_mm: number },
  cutter: ImpositionCutter | null,
  sheet: ImpositionSheet | null
): StickerSheetLayout {
  if (!cutter || !sheet) {
    const w = Number(size.width_mm);
    const h = Number(size.height_mm);
    return { sheetWidth: w, sheetHeight: h, area: { x: 0, y: 0, width: w, height: h } };
  }
  const sw = Number(sheet.width_mm);
  const sh = Number(sheet.height_mm);
  const left = Number(cutter.margin_left_mm);
  const top = Number(cutter.margin_top_mm);
  const width = Math.max(1, sw - left - Number(cutter.margin_right_mm));
  const height = Math.max(1, sh - top - Number(cutter.margin_bottom_mm));
  return {
    sheetWidth: sw,
    sheetHeight: sh,
    area: { x: left + Number(cutter.offset_x_mm), y: top + Number(cutter.offset_y_mm), width, height },
  };
}
