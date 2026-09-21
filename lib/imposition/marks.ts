import type { MarksKind } from "./render";

// Détecte le type d'un fichier de marques d'après son contenu (et non son
// extension ou son type MIME, que le navigateur peut mal renseigner).
export function detectMarksKind(bytes: Uint8Array): MarksKind | null {
  const startsWith = (...sig: number[]) => sig.every((b, i) => bytes[i] === b);
  if (startsWith(0x25, 0x50, 0x44, 0x46, 0x2d)) return "pdf"; // %PDF-
  if (startsWith(0x89, 0x50, 0x4e, 0x47)) return "png";
  if (startsWith(0xff, 0xd8, 0xff)) return "jpg";
  return null;
}
