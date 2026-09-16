import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { resolveProductImage } from "@/lib/pdf/productSource";
import { isValidLogoColor } from "@/lib/pdf/logo";
import type { LogoShape, VisualMode } from "@/lib/types";

export async function GET() {
  const supabase = createServerSupabaseClient();
  const { data, error } = await supabase
    .from("products")
    .select("*")
    .order("name", { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ products: data });
}

export async function POST(request: Request) {
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
  const collectionId = formData.get("collectionId");

  if (typeof name !== "string" || typeof templateId !== "string") {
    return NextResponse.json(
      { error: "Paramètres manquants (name, templateId)." },
      { status: 400 }
    );
  }

  let resolved;
  try {
    resolved = await resolveProductImage(supabase, {
      templateId,
      file: file instanceof File ? file : null,
      visualId: typeof visualId === "string" ? visualId : null,
      visualMode: typeof visualMode === "string" ? (visualMode as VisualMode) : null,
      tileSizeMm: typeof tileSizeMm === "string" ? parseFloat(tileSizeMm) : null,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erreur lors du traitement de l'image.";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  const productId = randomUUID();
  const imagePath = `products/${productId}/source-${resolved.filename}`;

  const { error: uploadError } = await supabase.storage
    .from("uploads")
    .upload(imagePath, resolved.buffer, { contentType: resolved.contentType, upsert: true });
  if (uploadError) {
    return NextResponse.json({ error: uploadError.message }, { status: 500 });
  }

  const { data, error } = await supabase
    .from("products")
    .insert({
      id: productId,
      name,
      template_id: templateId,
      image_path: imagePath,
      visual_id: typeof visualId === "string" ? visualId : null,
      visual_mode: typeof visualMode === "string" ? visualMode : null,
      tile_size_mm: typeof tileSizeMm === "string" ? parseFloat(tileSizeMm) : null,
      logo_shape: (logoShape === "pastille" ? "pastille" : "logo") satisfies LogoShape,
      logo_color:
        typeof logoColor === "string" && isValidLogoColor(logoColor) ? logoColor : "#000000",
      logo_secondary_color:
        typeof logoSecondaryColor === "string" && isValidLogoColor(logoSecondaryColor)
          ? logoSecondaryColor
          : "#FFFFFF",
      collection_id: typeof collectionId === "string" && collectionId ? collectionId : null,
      created_by: user.id,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ product: data });
}
