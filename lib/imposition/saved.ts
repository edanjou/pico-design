// Impositions enregistrées : ce qui est gardé en base pour pouvoir rouvrir et
// modifier une imposition, et les chemins de stockage de ses fichiers.
// Fonctions et types purs, partagés entre l'écran et les routes API.

import type { CutterMachine } from "./machines";
import type { FlipEdge, PieceOrientation } from "./layout";

export const MAX_NAME_LENGTH = 120;

// Un fichier de l'imposition : un produit Pico (son PDF vit déjà dans le
// stockage des produits) ou un PDF téléversé, gardé sous impositions/<id>/sources/.
export interface SavedSource {
  kind: "product" | "upload";
  name: string;
  productId?: string;
  path?: string;
  // Taille de la page du PDF (mm), null si elle n'a pas pu être lue.
  widthMm: number | null;
  heightMm: number | null;
  copies: number;
}

export interface ImpositionConfig {
  version: 1;
  sheetId: string;
  machine: CutterMachine;
  duploJobId: string;
  // Format du catalogue (id du modèle) ou "custom" avec les dimensions ci-dessous.
  formatId: string;
  custom: { widthMm: number; heightMm: number; bleedMm: number };
  orientation: PieceOrientation;
  flip: FlipEdge;
  sources: SavedSource[];
}

export interface SavedImposition {
  id: string;
  name: string;
  config: ImpositionConfig;
  pdf_path: string;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export const imposedPdfPath = (id: string) => `impositions/${id}/imposition.pdf`;
export const sourcesDir = (id: string) => `impositions/${id}/sources`;

// Un PDF source enregistré d'une imposition : impositions/<uuid>/sources/<fichier>.
export const STORED_SOURCE_PATH = /^impositions\/[0-9a-f-]{36}\/sources\/(?!\.{1,2}$)[^/]+$/i;

// Nom de fichier sûr pour une clé de stockage (pas d'accents ni d'espaces).
export function safeStorageName(name: string): string {
  return name.replace(/[^A-Za-z0-9._-]+/g, "_").slice(0, 80) || "fichier.pdf";
}

export function cleanImpositionName(name: unknown): string {
  return String(name ?? "").replace(/\s+/g, " ").trim().slice(0, MAX_NAME_LENGTH);
}

// Nom du fichier PDF téléchargé : le nom de l'imposition, sans caractères interdits.
export function pdfDownloadName(name: string): string {
  return `${name.replace(/[\\/:*?"<>|\x00-\x1f]+/g, " ").replace(/\s+/g, " ").trim() || "imposition"}.pdf`;
}
