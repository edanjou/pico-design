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

  // Le gabarit (si présent) est copié dans Storage sous le nouvel id, pour
  // que chaque modèle reste propriétaire de son propre fichier (modifier ou
  // supprimer le gabarit de l'un n'affecte pas l'autre).
  let overlayPath: string | null = null;
  if (source.overlay_path) {
    const filename = source.overlay_path.split("/").pop() ?? "overlay";
    overlayPath = `${newId}/${filename}`;
    const { error: copyError } = await supabase.storage
      .from("overlays")
      .copy(source.overlay_path, overlayPath);
    if (copyError) {
      return NextResponse.json({ error: copyError.message }, { status: 500 });
    }
  }

  const { data, error } = await supabase
    .from("templates")
    .insert({
      id: newId,
      name: `${source.name} (copie)`,
      category_id: source.category_id,
      width_mm: source.width_mm,
      height_mm: source.height_mm,
      bleed_mm: source.bleed_mm,
      safety_margin_mm: source.safety_margin_mm,
      dpi: source.dpi,
      logo_h_align: source.logo_h_align,
      logo_v_align: source.logo_v_align,
      logo_width_mm: source.logo_width_mm,
      logo_margin_x_mm: source.logo_margin_x_mm,
      logo_margin_y_mm: source.logo_margin_y_mm,
      overlay_path: overlayPath,
      created_by: user.id,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ template: data });
}
