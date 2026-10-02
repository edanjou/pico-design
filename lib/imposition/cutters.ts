// Profils de découpe de la Graphtec : validation des champs reçus par les
// routes API et chemins de stockage de leurs fichiers. Fonctions pures.

import type { MarksKind } from "./render";

// Les deux fichiers d'un profil, rangés sous cutters/<id>/ dans le bucket
// "imposition" :
//   * marks : codes et repères lus par la Graphtec, IMPRIMÉS au recto ;
//   * guide : gabarit de guidage, affiché dans l'aperçu seulement.
export const CUTTER_ASSETS = ["marks", "guide"] as const;
export type CutterAsset = (typeof CUTTER_ASSETS)[number];

export function isCutterAsset(value: unknown): value is CutterAsset {
  return (CUTTER_ASSETS as readonly unknown[]).includes(value);
}

export const ASSET_COLUMN: Record<CutterAsset, "marks_path" | "guide_path"> = {
  marks: "marks_path",
  guide: "guide_path",
};

export function cutterAssetPath(cutterId: string, asset: CutterAsset, kind: MarksKind): string {
  return `cutters/${cutterId}/${asset}.${kind}`;
}

export const CONTENT_TYPES: Record<MarksKind, string> = {
  pdf: "application/pdf",
  png: "image/png",
  jpg: "image/jpeg",
};

export const MAX_GRID = 50;

export interface CutterFields {
  name: string;
  sheet_id: string;
  grid_cols: number;
  grid_rows: number;
  margin_top_mm: number;
  margin_right_mm: number;
  margin_bottom_mm: number;
  margin_left_mm: number;
  gutter_x_mm: number;
  gutter_y_mm: number;
  offset_x_mm: number;
  offset_y_mm: number;
  center_grid: boolean;
}

// Champs du profil envoyés en multipart (à côté des fichiers). Renvoie un
// message d'erreur en français plutôt que de laisser la base refuser la ligne.
export function parseCutterForm(form: FormData): { fields: CutterFields } | { error: string } {
  const name = String(form.get("name") ?? "").replace(/\s+/g, " ").trim().slice(0, 120);
  if (!name) return { error: "Donnez un nom au profil." };
  const sheetId = String(form.get("sheet_id") ?? "");
  if (!/^[0-9a-f-]{36}$/i.test(sheetId)) return { error: "Choisissez le format du papier." };

  const int = (key: string) => Number(form.get(key));
  const cols = int("grid_cols");
  const rows = int("grid_rows");
  if (![cols, rows].every((n) => Number.isInteger(n) && n >= 1 && n <= MAX_GRID)) {
    return { error: `Le nombre de colonnes et de rangées doit être un entier de 1 à ${MAX_GRID}.` };
  }

  const num = (key: string) => {
    const raw = form.get(key);
    return raw === null || raw === "" ? 0 : Number(raw);
  };
  const positive = {
    margin_top_mm: num("margin_top_mm"),
    margin_right_mm: num("margin_right_mm"),
    margin_bottom_mm: num("margin_bottom_mm"),
    margin_left_mm: num("margin_left_mm"),
    gutter_x_mm: num("gutter_x_mm"),
    gutter_y_mm: num("gutter_y_mm"),
  };
  if (Object.values(positive).some((v) => !Number.isFinite(v) || v < 0)) {
    return { error: "Les marges et l'espacement doivent être des nombres positifs." };
  }
  // La calibration peut être négative (décalage vers la gauche ou vers le haut).
  const offsetX = num("offset_x_mm");
  const offsetY = num("offset_y_mm");
  if (!Number.isFinite(offsetX) || !Number.isFinite(offsetY)) return { error: "Le décalage de calibration est invalide." };

  return {
    fields: {
      name,
      sheet_id: sheetId,
      grid_cols: cols,
      grid_rows: rows,
      ...positive,
      offset_x_mm: offsetX,
      offset_y_mm: offsetY,
      center_grid: form.get("center_grid") === "true",
    },
  };
}
