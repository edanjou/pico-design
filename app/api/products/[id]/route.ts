import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { resolveProductImage } from "@/lib/pdf/productSource";
import { isValidLogoColor } from "@/lib/pdf/logo";
import type { LogoShape, VisualMode } from "@/lib/types";

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const supabase = createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Non authentifié." }, { status: 401 });

  const formData = await request.formData();
  const name = formData.get("name");
  const templateId = formData.get("templateId");
  const file = formData.get("image");
  const visualId = formData.get("visualId");
  const visualMode = formData.get("visualMode");
  const tileSizeMm = formData.get("tileSizeMm");
  const logoShape = formData.get("logoShape");
  const logoColor = formData.get("logoColor");
  const logoSecondaryColor = formData.get("logoSecondaryColor");

  if (typeof name !== "string" || typeof templateId !== "string") {
    return NextResponse.json(
      { error: "Paramètres manquants (name, templateId)." },
      { status: 400 }
    );
  }

  const update: Record<string, unknown> = {
    name,
    template_id: templateId,
    logo_shape: (logoShape === "pastille" ? "pastille" : "logo") satisfies LogoShape,
    logo_color:
      typeof logoColor === "string" && isValidLogoColor(logoColor) ? logoColor : "#000000",
    logo_secondary_color:
      typeof logoSecondaryColor === "string" && isValidLogoColor(logoSecondaryColor)
        ? logoSecondaryColor
        : "#FFFFFF",
  };
  const hasNewSource = file instanceof File && file.size > 0
    ? true
    : typeof visualId === "string" && typeof visualMode === "string";

  if (hasNewSource) {
    let resolved;
    try {
      resolved = await resolveProductImage(supabase, {
        templateId,
        file: file instanceof File && file.size > 0 ? file : null,
        visualId: typeof visualId === "string" ? visualId : null,
        visualMode: typeof visualMode === "string" ? (visualMode as VisualMode) : null,
        tileSizeMm: typeof tileSizeMm === "string" ? parseFloat(tileSizeMm) : null,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Erreur lors du traitement de l'image.";
      return NextResponse.json({ error: message }, { status: 400 });
    }

    const imagePath = `products/${params.id}/source-${resolved.filename}`;
    const { error: uploadError } = await supabase.storage
      .from("uploads")
      .upload(imagePath, resolved.buffer, { contentType: resolved.contentType, upsert: true });
    if (uploadError) {
      return NextResponse.json({ error: uploadError.message }, { status: 500 });
    }
    update.image_path = imagePath;
    update.visual_id = file instanceof File && file.size > 0 ? null : (visualId as string);
    update.visual_mode = file instanceof File && file.size > 0 ? null : (visualMode as string);
    update.tile_size_mm =
      file instanceof File && file.size > 0
        ? null
        : typeof tileSizeMm === "string"
        ? parseFloat(tileSizeMm)
        : null;
  }

  const { data, error } = await supabase
    .from("products")
    .update(update)
    .eq("id", params.id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ product: data });
}

export async function DELETE(_request: Request, { params }: { params: { id: string } }) {
  const supabase = createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Non authentifié." }, { status: 401 });

  const { data, error } = await supabase
    .from("products")
    .delete()
    .eq("id", params.id)
    .select();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data || data.length === 0) {
    return NextResponse.json(
      { error: "Produit introuvable ou suppression non autorisée." },
      { status: 404 }
    );
  }
  return NextResponse.json({ ok: true });
}
