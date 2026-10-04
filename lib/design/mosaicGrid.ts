// Grille d'une mosaïque de photos : limites partagées entre l'Outil Shopify
// (choix d'une grille personnalisée) et les routes de rendu, qui les
// imposent. Sans plafond côté serveur, une grille forgée (10 000 × 10 000)
// ferait construire des millions de cases à une route ouverte au public.

// Colonnes et rangées, chacune : au-delà, une photo par case devient
// illisible sur les formats Pico, et l'envoi dépasse vite le plafond d'octets
// du public (voir lib/uploadLimits.ts).
export const MAX_MOSAIC_SIDE = 6;

export function isValidMosaicSide(value: number): boolean {
  return Number.isInteger(value) && value >= 1 && value <= MAX_MOSAIC_SIDE;
}
