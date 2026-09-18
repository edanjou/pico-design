import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { Template } from "@/lib/types";

export async function POST(_request: Request, { params }: { params: { id: string } }) {
  const supabase = createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Non authentifié." }, { status: 401 });

  const { data: source, error: sourceError } = await supabase
    .from("templates")
    .select("*")
    .eq("id", params.id)
    .single<Template>();
  if (sourceError || !source) {
    return NextResponse.json({ error: "Modèle introuvable." }, { status: 404 });
  }

  const newId = randomUUID();

  // Le gabarit, le masque et l'ombrage (si présents) sont copiés dans
  // Storage sous le nouvel id, pour que chaque modèle reste propriétaire de
  // ses propres fichiers (modifier ou supprimer ceux de l'un n'affecte pas
  // l'autre).
  async function copyOptionalFile(sourcePath: string | null, fallbackName: string) {
    if (!sourcePath) return null;
    const filename = sourcePath.split("/").pop() ?? fallbackName;
    const newPath = `${newId}/${filename}`;
    const { error: copyError } = await supabase.storage.from("overlays").copy(sourcePath, newPath);
    if (copyError) throw copyError;
    return newPath;
  }

  let overlayPath: string | null;
  let maskPath: string | null;
  let shadingPath: string | null;
  try {
    overlayPath = await copyOptionalFile(source.overlay_path, "overlay");
    maskPath = await copyOptionalFile(source.mask_path, "mask");
    shadingPath = await copyOptionalFile(source.shading_path, "shading");
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erreur lors de la copie d'un fichier.";
    return NextResponse.json({ error: message }, { status: 500 });
  }

  const { data, error } = await supabase
    .from("templates")
    .insert({
      id: newId,
      name: `${source.name} (copie)`,
      category_id: source.category_id,
      sku_id: source.sku_id,
      width_mm: source.width_mm,
      height_mm: source.height_mm,
      bleed_mm: source.bleed_mm,
      safety_margin_x_mm: source.safety_margin_x_mm,
      safety_margin_y_mm: source.safety_margin_y_mm,
      print_margin_x_mm: source.print_margin_x_mm,
      print_margin_y_mm: source.print_margin_y_mm,
      dpi: source.dpi,
      logo_h_align: source.logo_h_align,
      logo_v_align: source.logo_v_align,
      logo_width_mm: source.logo_width_mm,
      logo_margin_x_mm: source.logo_margin_x_mm,
      logo_margin_y_mm: source.logo_margin_y_mm,
      two_sided: source.two_sided,
      logo_on_front: source.logo_on_front,
      logo_on_back: source.logo_on_back,
      allow_orientation_change: source.allow_orientation_change,
      overlay_path: overlayPath,
      mask_path: maskPath,
      shading_path: shadingPath,
      created_by: user.id,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ template: data });
}
