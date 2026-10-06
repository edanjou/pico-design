import { NextResponse } from "next/server";
import sharp from "sharp";
import { pdfToPng } from "pdf-to-png-converter";
import { createAdminSupabaseClient, createServerSupabaseClient } from "@/lib/supabase/server";
import { STICKER_ASSET_COLUMN, isStickerAsset } from "@/lib/stickers/types";
import { STICKERS_BUCKET } from "@/lib/stickers/assets";
import { detectMarksKind } from "@/lib/imposition/marks";

export const runtime = "nodejs";
export const maxDuration = 30;

// Assez pour placer des zones précisément sur une planche de 13 × 19 po.
const PREVIEW_WIDTH_PX = 2000;

const error = (message: string, status = 400) => NextResponse.json({ error: message }, { status });

/**
 * Un fichier du modèle : en PNG pour l'éditeur (une balise <image> SVG ne
 * lit pas un PDF), ou tel quel avec `?download=1` (le gabarit de guidage,
 * que le graphiste reprend pour la découpe).
 */
export async function GET(request: Request, { params }: { params: { id: string; asset: string } }) {
  const supabase = createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return error("Non authentifié.", 401);
  if (!isStickerAsset(params.asset)) return error("Fichier inconnu.", 404);

  const column = STICKER_ASSET_COLUMN[params.asset];
  const { data: row } = await supabase
    .from("sticker_templates")
    .select(`name, ${column}`)
    .eq("id", params.id)
    .single<Record<string, string | null>>();
  const path = row?.[column];
  if (!path) return error("Aucun fichier pour ce modèle.", 404);

  const { data: file } = await createAdminSupabaseClient().storage.from(STICKERS_BUCKET).download(path);
  if (!file) return error("Fichier introuvable.", 404);
  const bytes = Buffer.from(await file.arrayBuffer());
  const kind = detectMarksKind(bytes);

  if (new URL(request.url).searchParams.get("download") === "1") {
    const extension = path.split(".").pop() ?? "bin";
    const base = `${row?.name ?? "modele"} - ${params.asset}`.replace(/[\\/:*?"<>|]+/g, " ").trim();
    return new NextResponse(new Uint8Array(bytes), {
      headers: {
        "Content-Type": kind === "pdf" ? "application/pdf" : kind === "png" ? "image/png" : "image/jpeg",
        "Content-Disposition": `attachment; filename="${encodeURIComponent(base)}.${extension}"`,
        "Cache-Control": "private, no-store",
      },
    });
  }

  try {
    let image: Buffer = bytes;
    if (kind === "pdf") {
      const [page] = await pdfToPng(bytes, { pagesToProcess: [1], viewportScale: 3 });
      if (!page?.content) throw new Error();
      image = page.content;
    }
    const png = await sharp(image).resize({ width: PREVIEW_WIDTH_PX, withoutEnlargement: true }).png().toBuffer();
    return new NextResponse(new Uint8Array(png), {
      headers: { "Content-Type": "image/png", "Cache-Control": "private, no-store" },
    });
  } catch {
    return error("Impossible de lire ce fichier.", 422);
  }
}
