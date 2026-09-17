import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";

const STRING_FIELDS = ["name", "category_id", "logo_h_align", "logo_v_align"] as const;
const NUMERIC_FIELDS = [
  "width_mm",
  "height_mm",
  "bleed_mm",
  "safety_margin_mm",
  "dpi",
  "logo_width_mm",
  "logo_margin_x_mm",
  "logo_margin_y_mm",
] as const;
const BOOLEAN_FIELDS = ["two_sided"] as const;

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const supabase = createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Non authentifié." }, { status: 401 });

  const formData = await request.formData();
  const update: Record<string, unknown> = {};
  for (const field of STRING_FIELDS) {
    const v = formData.get(field);
    if (typeof v === "string") update[field] = v;
  }
  for (const field of NUMERIC_FIELDS) {
    const v = formData.get(field);
    if (typeof v === "string") update[field] = parseFloat(v);
  }
  for (const field of BOOLEAN_FIELDS) {
    const v = formData.get(field);
    if (typeof v === "string") update[field] = v === "true";
  }

  const overlayFile = formData.get("overlay");
  const removeOverlay = formData.get("removeOverlay") === "true";

  if (overlayFile instanceof File && overlayFile.size > 0) {
    const overlayPath = `${params.id}/${overlayFile.name}`;
    const buffer = Buffer.from(await overlayFile.arrayBuffer());
    const { error: uploadError } = await supabase.storage
      .from("overlays")
      .upload(overlayPath, buffer, { contentType: overlayFile.type || "image/png", upsert: true });
    if (uploadError) {
      return NextResponse.json({ error: uploadError.message }, { status: 500 });
    }
    update.overlay_path = overlayPath;
  } else if (removeOverlay) {
    update.overlay_path = null;
  }

  const { data, error } = await supabase
    .from("templates")
    .update(update)
    .eq("id", params.id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ template: data });
}

export async function DELETE(_request: Request, { params }: { params: { id: string } }) {
  const supabase = createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Non authentifié." }, { status: 401 });

  const { data, error } = await supabase
    .from("templates")
    .delete()
    .eq("id", params.id)
    .select();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data || data.length === 0) {
    return NextResponse.json(
      { error: "Modèle introuvable ou suppression non autorisée." },
      { status: 404 }
    );
  }
  return NextResponse.json({ ok: true });
}
