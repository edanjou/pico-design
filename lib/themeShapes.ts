import type { ThemeSlot, ThemeSlotPoint, ThemeSlotShape } from "@/lib/types";

/**
 * Formes des emplacements de Thème (voir ThemeSlot.shape) : un seul endroit
 * pour les décrire, utilisé par l'éditeur admin (ThemeForm), l'aperçu du
 * client (ImageSourcePicker, en clip-path CSS) et le rendu imprimé
 * (lib/pdf/theme.ts, en masque SVG). Sans dépendance serveur : chargé aussi
 * côté navigateur.
 *
 * Les sommets d'un polygone sont en ratios 0-1 du RECTANGLE de
 * l'emplacement, pas de la page : déplacer ou redimensionner l'emplacement
 * déplace la forme avec lui.
 */

// Nombre d'emplacements d'un thème : autant qu'on veut, borné seulement
// pour garder les envois raisonnables (une photo par emplacement).
export const MAX_THEME_SLOTS = 50;

export const MIN_POLYGON_SIDES = 3;
// Même limite pour un polygone régulier (« Côtés ») et pour un tracé au clic.
export const MAX_POLYGON_SIDES = 50;
export const MAX_POINTS = 50;

/** Polygone régulier inscrit dans le rectangle, premier sommet en haut. */
export function regularPolygon(sides: number): ThemeSlotPoint[] {
  const n = Math.min(MAX_POLYGON_SIDES, Math.max(MIN_POLYGON_SIDES, Math.round(sides)));
  return Array.from({ length: n }, (_, i) => {
    const angle = -Math.PI / 2 + (i * 2 * Math.PI) / n;
    return { x: round(0.5 + 0.5 * Math.cos(angle)), y: round(0.5 + 0.5 * Math.sin(angle)) };
  });
}

/** Forme effective : un polygone sans sommets valables retombe sur le rectangle. */
export function slotShape(slot: ThemeSlot): ThemeSlotShape {
  if (slot.shape === "ellipse") return "ellipse";
  if (slot.shape === "polygon" && (slot.points?.length ?? 0) >= MIN_POLYGON_SIDES) return "polygon";
  return "rect";
}

/** clip-path CSS de la photo dans son emplacement (undefined = rectangle). */
export function slotClipPath(slot: ThemeSlot): string | undefined {
  const shape = slotShape(slot);
  if (shape === "ellipse") return "ellipse(50% 50% at 50% 50%)";
  if (shape === "polygon") {
    return `polygon(${slot.points!.map((p) => `${pct(p.x)} ${pct(p.y)}`).join(", ")})`;
  }
  return undefined;
}

/**
 * Contour SVG de la forme dans un rectangle de `width` × `height` (px), pour
 * le trait de l'aperçu et le masque du rendu imprimé.
 */
export function slotSvgShape(slot: ThemeSlot, width: number, height: number): string {
  const shape = slotShape(slot);
  if (shape === "ellipse") {
    return `<ellipse cx="${width / 2}" cy="${height / 2}" rx="${width / 2}" ry="${height / 2}"/>`;
  }
  if (shape === "polygon") {
    return `<polygon points="${slot.points!.map((p) => `${p.x * width},${p.y * height}`).join(" ")}"/>`;
  }
  return `<rect x="0" y="0" width="${width}" height="${height}"/>`;
}

/** Points SVG (attribut `points`) d'un polygone dans un rectangle donné. */
export function polygonPointsAttr(points: ThemeSlotPoint[], width: number, height: number): string {
  return points.map((p) => `${p.x * width},${p.y * height}`).join(" ");
}

/**
 * Forme lue depuis des données non fiables (formulaire, JSON enregistré) :
 * une forme inconnue ou un polygone invalide retombent sur le rectangle,
 * jamais d'erreur.
 */
export function sanitizeSlotShape(raw: { shape?: unknown; points?: unknown }): Pick<ThemeSlot, "shape" | "points"> {
  if (raw.shape === "ellipse") return { shape: "ellipse" };
  if (raw.shape === "polygon" && Array.isArray(raw.points)) {
    const points = raw.points
      .slice(0, MAX_POINTS)
      .map((p) => ({ x: Number(p?.x), y: Number(p?.y) }))
      .filter((p) => Number.isFinite(p.x) && Number.isFinite(p.y))
      .map((p) => ({ x: clamp01(p.x), y: clamp01(p.y) }));
    if (points.length >= MIN_POLYGON_SIDES) return { shape: "polygon", points };
  }
  return {};
}

function clamp01(n: number): number {
  return Math.min(1, Math.max(0, n));
}

function round(n: number): number {
  return Math.round(n * 10000) / 10000;
}

function pct(n: number): string {
  return `${round(n * 100)}%`;
}
