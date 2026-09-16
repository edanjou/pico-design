import { NextResponse } from "next/server";
import { createServerSupabaseClient, createAdminSupabaseClient } from "@/lib/supabase/server";
import { resolveProductImage } from "@/lib/pdf/productSource";
import { isValidLogoColor } from "@/lib/pdf/logo";
import { generateAndStoreProductPdf } from "@/lib/pdf/productPdf";
import { parsePositionValue } from "@/lib/pdf/crop";
import type { LogoShape, VisualMode } from "@/lib/types";

export const runtime = "nodejs"; // sharp/pdf-lib ont besoin du runtime Node, pas Edge.

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
  const collectionId = formData.get("collectionId");
  const positionX = parsePositionValue(formData.get("positionX"));
  const positionY = parsePositionValue(formData.get("positionY"));

  if (typeof name !== "string" || typeof templateId !== "string") {
    return NextResponse.json(
      { error: "Paramètres manquants (name, templateId)." },
      { status: 400 }
    );
  }

  const shape: LogoShape = logoShape === "pastille" ? "pastille" : "logo";
  const color = typeof logoColor === "string" && isValidLogoColor(logoColor) ? logoColor : "#000000";
  const secondaryColor =
    typeof logoSecondaryColor === "string" && isValidLogoColor(logoSecondaryColor)
      ? logoSecondaryColor
      : "#FFFFFF";

  const update: Record<string, unknown> = {
    name,
    template_id: templateId,
    logo_shape: shape,
    logo_color: color,
    logo_secondary_color: secondaryColor,
    collection_id: typeof collectionId === "string" && collectionId ? collectionId : null,
    image_position_x: positionX,
    image_position_y: positionY,
  };
  const hasNewSource = file instanceof File && file.size > 0
    ? true
    : typeof visualId === "string" && typeof visualMode === "string";

  const admin = createAdminSupabaseClient();
  let sourceBufferForPdf: Buffer | null = null;

  if (hasNewSource) {
    let resolved;
    try {
      resolved = await resolveProductImage(supabase, {
        templateId,
        file: file instanceof File && file.size > 0 ? file : null,
        visualId: typeof visualId === "string" ? visualId : null,
        visualMode: typeof visualMode === "string" ? (visualMode as VisualMode) : null,
        tileSizeMm: typeof tileSizeMm === "string" ? parseFloat(tileSizeMm) : null,
        positionX,
        positionY,
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
    sourceBufferForPdf = resolved.buffer;
  } else {
    // Pas de nouvelle image : régénérer le PDF (modèle/logo ont pu changer)
    // à partir de l'image actuellement enregistrée pour ce produit.
    const { data: current } = await supabase
      .from("products")
      .select("image_path")
      .eq("id", params.id)
      .single<{ image_path: string }>();
    if (current) {
      const { data: existingFile } = await admin.storage.from("uploads").download(current.image_path);
      if (existingFile) sourceBufferForPdf = Buffer.from(await existingFile.arrayBuffer());
    }
  }

  // Le PDF prêt-pour-impression est régénéré dès l'enregistrement du produit
  // (pas à la demande) — une erreur ici n'empêche pas de sauvegarder le
  // produit, mais est remontée au client via pdfError.
  let pdfError: string | null = null;
  if (sourceBufferForPdf) {
    try {
      update.pdf_path = await generateAndStoreProductPdf(admin, {
        productId: params.id,
        templateId,
        sourceImage: sourceBufferForPdf,
        logoShape: shape,
        logoColor: color,
        logoSecondaryColor: secondaryColor,
        positionX,
        positionY,
      });
    } catch (err) {
      pdfError = err instanceof Error ? err.message : "Erreur lors de la génération du PDF.";
    }
  }

  const { data, error } = await supabase
    .from("products")
    .update(update)
    .eq("id", params.id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ product: data, pdfError });
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
