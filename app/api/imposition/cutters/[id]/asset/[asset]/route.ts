import { NextResponse } from "next/server";
import sharp from "sharp";
import { pdfToPng } from "pdf-to-png-converter";
import { createAdminSupabaseClient, createServerSupabaseClient } from "@/lib/supabase/server";
import { ASSET_COLUMN, isCutterAsset } from "@/lib/imposition/cutters";
import { detectMarksKind } from "@/lib/imposition/marks";

export const runtime = "nodejs";
export const maxDuration = 30;

// Largeur (px) de l'image servie à l'aperçu : assez pour lire les repères
// d'une feuille de 13 × 19 po, assez peu pour rester légère.
const PREVIEW_WIDTH_PX = 1600;

const error = (message: string, status = 400) => NextResponse.json({ error: message }, { status });

// Marques ou gabarit d'un profil, en PNG, pour les poser sur l'aperçu de la
// feuille (une balise <image> SVG ne sait pas afficher un PDF).
export async function GET(_request: Request, { params }: { params: { id: string; asset: string } }) {
  const supabase = createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return error("Non authentifié.", 401);
  if (!isCutterAsset(params.asset)) return error("Fichier inconnu.", 404);

  const column = ASSET_COLUMN[params.asset];
  const { data: cutter } = await supabase
    .from("imposition_cutters")
    .select(column)
    .eq("id", params.id)
    .single<Record<typeof column, string | null>>();
  const path = cutter?.[column];
  if (!path) return error("Aucun fichier pour ce profil.", 404);

  const { data: file } = await createAdminSupabaseClient().storage.from("imposition").download(path);
  if (!file) return error("Fichier introuvable.", 404);
  const bytes = Buffer.from(await file.arrayBuffer());

  try {
    let image: Buffer = bytes;
    if (detectMarksKind(bytes) === "pdf") {
      const [page] = await pdfToPng(bytes, { pagesToProcess: [1], viewportScale: 2 });
      if (!page?.content) throw new Error();
      image = page.content;
    }
    // Fond transparent gardé : l'aperçu superpose ces calques aux pièces.
    const png = await sharp(image).resize({ width: PREVIEW_WIDTH_PX, withoutEnlargement: true }).png().toBuffer();
    return new NextResponse(new Uint8Array(png), {
      headers: { "Content-Type": "image/png", "Cache-Control": "private, no-store" },
    });
  } catch {
    return error("Impossible de lire ce fichier.", 422);
  }
}
