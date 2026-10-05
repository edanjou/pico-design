// Banque d'illustrations : types de fichiers acceptés et chemins de stockage.
// Fonctions pures, partagées entre les routes API et l'écran.

export const ILLUSTRATIONS_BUCKET = "illustrations";

// Assez pour un PNG détaillé à 300 dpi, peu pour un fichier que le client
// renvoie avec son design (il passe sous les plafonds du public, voir
// lib/uploadLimits.ts).
export const MAX_ILLUSTRATION_BYTES = 15 * 1024 * 1024;

export const ILLUSTRATION_TYPES = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
  "image/svg+xml": "svg",
} as const;
export type IllustrationMime = keyof typeof ILLUSTRATION_TYPES;

// Type lu dans le CONTENU du fichier, pas dans son nom ni dans le type annoncé
// par le navigateur, qui peut se tromper (un .png qui est en fait un JPEG).
export function detectIllustrationType(bytes: Uint8Array): IllustrationMime | null {
  const startsWith = (...sig: number[]) => sig.every((b, i) => bytes[i] === b);
  if (startsWith(0x89, 0x50, 0x4e, 0x47)) return "image/png";
  if (startsWith(0xff, 0xd8, 0xff)) return "image/jpeg";
  // RIFF....WEBP
  if (startsWith(0x52, 0x49, 0x46, 0x46) && String.fromCharCode(...bytes.slice(8, 12)) === "WEBP") return "image/webp";
  // SVG : du texte, avec une balise <svg> dans son début (après un éventuel
  // prologue XML, des commentaires ou un BOM).
  const head = new TextDecoder("utf-8", { fatal: false }).decode(bytes.slice(0, 2048)).toLowerCase();
  if (head.includes("<svg")) return "image/svg+xml";
  return null;
}

export function illustrationPath(id: string, mime: IllustrationMime): string {
  return `${id}.${ILLUSTRATION_TYPES[mime]}`;
}

// Nom affiché d'après le nom du fichier : sans extension, tirets et soulignés
// changés en espaces (« chat_qui_dort.png » → « chat qui dort »).
export function nameFromFileName(fileName: string): string {
  return cleanIllustrationName(fileName.replace(/\.[a-z0-9]{2,5}$/i, "").replace(/[_-]+/g, " "));
}

export function cleanIllustrationName(name: unknown): string {
  return String(name ?? "").replace(/\s+/g, " ").trim().slice(0, 120);
}
