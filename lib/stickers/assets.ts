// Fichiers d'un modèle d'autocollants (visuel, codes Graphtec, gabarit) dans le
// bucket privé "stickers", sous <id du modèle>/.

import type { createAdminSupabaseClient } from "@/lib/supabase/server";
import { detectMarksKind } from "@/lib/imposition/marks";
import { STICKER_ASSETS, STICKER_ASSET_COLUMN, STICKER_ASSET_LABELS } from "./types";

type Storage = ReturnType<typeof createAdminSupabaseClient>["storage"];
type Columns = Partial<Record<"artwork_path" | "marks_path" | "guide_path", string | null>>;

export const STICKERS_BUCKET = "stickers";

const CONTENT_TYPES = { pdf: "application/pdf", png: "image/png", jpg: "image/jpeg" } as const;

export class StickerAssetError extends Error {}

/**
 * Applique aux fichiers du modèle ce que le formulaire demande : un fichier
 * reçu (champ `artwork`, `marks` ou `guide`) remplace l'actuel,
 * `remove_<champ>` le retire. Renvoie les colonnes qui changent.
 */
export async function applyStickerAssets(
  storage: Storage,
  templateId: string,
  form: FormData,
  current: Columns
): Promise<Columns> {
  const changes: Columns = {};
  for (const asset of STICKER_ASSETS) {
    const column = STICKER_ASSET_COLUMN[asset];
    const file = form.get(asset);
    const previous = current[column] ?? null;
    if (file instanceof File && file.size > 0) {
      const bytes = new Uint8Array(await file.arrayBuffer());
      const kind = detectMarksKind(bytes);
      if (!kind) throw new StickerAssetError(`${STICKER_ASSET_LABELS[asset]} : PDF, PNG ou JPEG attendu.`);
      const path = `${templateId}/${asset}.${kind}`;
      const { error } = await storage
        .from(STICKERS_BUCKET)
        .upload(path, bytes, { contentType: CONTENT_TYPES[kind], upsert: true });
      if (error) throw new StickerAssetError(`Enregistrement de « ${file.name} » impossible : ${error.message}`);
      if (previous && previous !== path) await storage.from(STICKERS_BUCKET).remove([previous]);
      changes[column] = path;
    } else if (form.get(`remove_${asset}`) === "true" && previous) {
      await storage.from(STICKERS_BUCKET).remove([previous]);
      changes[column] = null;
    }
  }
  return changes;
}
