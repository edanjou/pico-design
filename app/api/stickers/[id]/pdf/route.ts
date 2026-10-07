import { NextResponse } from "next/server";
import { createAdminSupabaseClient, createServerSupabaseClient } from "@/lib/supabase/server";
import type { StickerTemplate } from "@/lib/stickers/types";
import { STICKERS_BUCKET } from "@/lib/stickers/assets";
import { MAX_NAMES_PER_PDF, parseNames, renderStickerSheets } from "@/lib/stickers/render";
import { stickerSheetLayout } from "@/lib/stickers/layout";
import type { ImpositionCutter, ImpositionSheet } from "@/lib/types";

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

  // Profil Graphtec relié : sa feuille, ses marges, sa calibration et ses codes.
  let cutter: ImpositionCutter | null = null;
  let sheet: ImpositionSheet | null = null;
  if (template.cutter_id) {
    const { data } = await supabase
      .from("imposition_cutters")
      .select("*")
      .eq("id", template.cutter_id)
      .single<ImpositionCutter>();
    cutter = data ?? null;
    if (!cutter?.sheet_id) {
      return error("Le profil Graphtec de ce modèle n'a plus de format de papier : complétez-le dans l'imposition.");
    }
    const { data: s } = await supabase
      .from("imposition_sheets")
      .select("*")
      .eq("id", cutter.sheet_id)
      .single<ImpositionSheet>();
    sheet = s ?? null;
    if (!sheet) return error("La feuille du profil Graphtec est introuvable.", 404);
  }
  const layout = stickerSheetLayout(template, cutter, sheet);

  const admin = createAdminSupabaseClient();
  async function read(bucket: string, path: string | null) {
    if (!path) return null;
    const { data } = await admin.storage.from(bucket).download(path);
    return data ? new Uint8Array(await data.arrayBuffer()) : null;
  }

  try {
    const pdf = await renderStickerSheets(
      template,
      {
        artwork: await read(STICKERS_BUCKET, template.artwork_path),
        // Les codes du profil quand il y en a un : un seul endroit à régler pour la machine.
        marks: cutter ? await read("imposition", cutter.marks_path) : await read(STICKERS_BUCKET, template.marks_path),
      },
      names,
      layout
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
