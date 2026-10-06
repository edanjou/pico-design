import { NextResponse } from "next/server";
import { createAdminSupabaseClient, createServerSupabaseClient } from "@/lib/supabase/server";
import type { StickerTemplate } from "@/lib/stickers/types";
import { STICKERS_BUCKET } from "@/lib/stickers/assets";
import { MAX_NAMES_PER_PDF, parseNames, renderStickerSheets } from "@/lib/stickers/render";

export const runtime = "nodejs";
export const maxDuration = 60;

const error = (message: string, status = 400) => NextResponse.json({ error: message }, { status });

// Planches d'un modèle pour une liste de noms (un par ligne) : une page par
// nom, prête à imprimer et à découper à la Graphtec.
export async function POST(request: Request, { params }: { params: { id: string } }) {
  const supabase = createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return error("Non authentifié.", 401);

  const { names: rawNames } = (await request.json().catch(() => ({}))) as { names?: unknown };
  const names = parseNames(rawNames);
  if (names.length === 0) return error("Écrivez au moins un nom.");
  if (names.length > MAX_NAMES_PER_PDF) return error(`${MAX_NAMES_PER_PDF} noms au plus par fichier.`);

  const { data: template } = await supabase
    .from("sticker_templates")
    .select("*")
    .eq("id", params.id)
    .single<StickerTemplate>();
  if (!template) return error("Modèle introuvable.", 404);
  if (template.zones.length === 0) return error("Ce modèle n'a encore aucune zone de nom.");

  const storage = createAdminSupabaseClient().storage.from(STICKERS_BUCKET);
  async function read(path: string | null) {
    if (!path) return null;
    const { data } = await storage.download(path);
    return data ? new Uint8Array(await data.arrayBuffer()) : null;
  }

  try {
    const pdf = await renderStickerSheets(
      template,
      { artwork: await read(template.artwork_path), marks: await read(template.marks_path) },
      names
    );
    const label = names.length === 1 ? names[0] : `${names.length} noms`;
    const filename = `${template.name} - ${label}`.replace(/[\\/:*?"<>|]+/g, " ").trim();
    return new NextResponse(new Uint8Array(pdf), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="${encodeURIComponent(filename)}.pdf"`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch (err) {
    return error(err instanceof Error ? err.message : "Erreur lors de la préparation.", 422);
  }
}
