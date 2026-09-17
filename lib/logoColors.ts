// Palette de couleurs de marque pour le logo/la pastille appliqués aux
// produits. Module sans dépendance serveur (pas de sharp/supabase) pour
// pouvoir être importé aussi bien côté client que côté serveur.

export const LOGO_COLOR_PALETTE: { name: string; hex: string }[] = [
  { name: "Noir", hex: "#000000" },
  { name: "Blanc", hex: "#FFFFFF" },
  { name: "Beige", hex: "#F8F1E9" },
  { name: "Violet", hex: "#DBBDF3" },
  { name: "Bleu", hex: "#F4F2EE" },
  { name: "Violet pâle", hex: "#EADCF9" },
  { name: "Bourgogne", hex: "#631028" },
  { name: "Rose", hex: "#FF99CC" },
  { name: "Orange", hex: "#FF6633" },
  { name: "Lime", hex: "#E9EA93" },
  { name: "Pêche", hex: "#FCC7B0" },
];

export const DEFAULT_LOGO_COLOR = "#000000";

// N'importe quelle couleur hexadécimale valide est acceptée (pas seulement
// celles de la palette Pico) — le sélecteur de couleur libre permet de
// choisir en dehors de la palette.
const HEX_COLOR_RE = /^#[0-9a-f]{6}$/i;

export function isValidLogoColor(hex: string): boolean {
  return HEX_COLOR_RE.test(hex);
}
