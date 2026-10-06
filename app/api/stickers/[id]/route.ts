import { NextResponse } from "next/server";
import { createAdminSupabaseClient, createServerSupabaseClient } from "@/lib/supabase/server";
import { parseZones, type StickerTemplate } from "@/lib/stickers/types";
import { STICKERS_BUCKET, StickerAssetError, applyStickerAssets } from "@/lib/stickers/assets";

export const runtime = "nodejs";

async function currentUser() {
  const supabase = createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return { supabase, user };
}

// Enregistre un modèle : nom, taille, zones (JSON) et fichiers (multipart).
export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const { supabase, user } = await currentUser();
  if (!user) return NextResponse.json({ error: "Non authentifié." }, { status: 401 });

  const { data: current } = await supabase
    .from("sticker_templates")
    .select("*")
    .eq("id", params.id)
    .single<StickerTemplate>();
  if (!current) return NextResponse.json({ error: "Modèle introuvable." }, { status: 404 });

  const form = await request.formData();
  const name = String(form.get("name") ?? current.name).replace(/\s+/g, " ").trim().slice(0, 120);
  const width = Number(form.get("width_mm") ?? current.width_mm);
  const height = Number(form.get("height_mm") ?? current.height_mm);
  if (!name) return NextResponse.json({ error: "Donnez un nom au modèle." }, { status: 400 });
  if (!(width > 0 && width <= 2000) || !(height > 0 && height <= 2000)) {
    return NextResponse.json({ error: "La taille de la feuille est invalide." }, { status: 400 });
  }
  let zones = current.zones;
  if (form.has("zones")) {
    let raw: unknown;
    try {
      raw = JSON.parse(String(form.get("zones")));
    } catch {
      raw = null;
    }
    const parsed = parseZones(raw, width, height);
    if (!parsed) {
      return NextResponse.json(
        { error: "Zones invalides : chacune doit avoir une taille et rester à l'intérieur de la feuille." },
        { status: 400 }
      );
    }
    zones = parsed;
  }

  let paths;
  try {
    paths = await applyStickerAssets(createAdminSupabaseClient().storage, current.id, form, current);
  } catch (err) {
    const status = err instanceof StickerAssetError ? 400 : 500;
    return NextResponse.json({ error: err instanceof Error ? err.message : "Enregistrement impossible." }, { status });
  }

  const { data, error } = await supabase
    .from("sticker_templates")
    .update({ name, width_mm: width, height_mm: height, zones, ...paths, updated_at: new Date().toISOString() })
    .eq("id", current.id)
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ template: data });
}

export async function DELETE(_request: Request, { params }: { params: { id: string } }) {
  const { supabase, user } = await currentUser();
  if (!user) return NextResponse.json({ error: "Non authentifié." }, { status: 401 });

  const { data, error } = await supabase
    .from("sticker_templates")
    .delete()
    .eq("id", params.id)
    .select("artwork_path, marks_path, guide_path");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data || data.length === 0) return NextResponse.json({ error: "Modèle introuvable." }, { status: 404 });
  const files = data
    .flatMap((row) => [row.artwork_path, row.marks_path, row.guide_path])
    .filter((p): p is string => Boolean(p));
  if (files.length > 0) await createAdminSupabaseClient().storage.from(STICKERS_BUCKET).remove(files);
  return NextResponse.json({ ok: true });
}
