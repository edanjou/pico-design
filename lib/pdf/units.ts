// Conversion mm <-> points PDF (1 pouce = 72 points = 25.4 mm).
export const MM_TO_PT = 72 / 25.4;

export function mmToPt(mm: number): number {
  return mm * MM_TO_PT;
}

// Dimensions en pixels nécessaires pour imprimer `mm` à `dpi` (300 dpi = qualité impression standard).
export function mmToPx(mm: number, dpi: number): number {
  return Math.round((mm / 25.4) * dpi);
}
