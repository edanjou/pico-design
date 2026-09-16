import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { createServerSupabaseClient, createAdminSupabaseClient } from "@/lib/supabase/server";
import { generatePrintReadyPdf } from "@/lib/pdf/generate";
import type { Product, Template } from "@/lib/types";

export const runtime = "nodejs"; // sharp/pdf-lib ont besoin du runtime Node, pas Edge.

const LOGO_STORAGE_PATH = "pico-noir.svg"; // dans le bucket "assets"

export async function POST(request: Request) {
  const supabase = createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Non authentifié." }, { status: 401 });
  }

  const body = await request.json();
  const productId = body?.productId;

  if (typeof productId !== "string") {
    return NextResponse.json({ error: "Paramètre manquant (productId)." }, { status: 400 });
  }

  const { data: product, error: productError } = await supabase
    .from("products")
    .select("*, template:templates(*)")
    .eq("id", productId)
    .single<Product & { template: Template | null }>();

  if (productError || !product || !product.template) {
    return NextResponse.json({ error: "Produit ou modèle introuvable." }, { status: 404 });
  }

  const template = product.template;
  const admin = createAdminSupabaseClient();

  const { data: sourceData, error: sourceError } = await admin.storage
    .from("uploads")
    .download(product.image_path);
  if (sourceError || !sourceData) {
    return NextResponse.json({ error: "Image du produit introuvable." }, { status: 404 });
  }
  const sourceBuffer = Buffer.from(await sourceData.arrayBuffer());

  // Logo Pico : à uploader une fois dans le bucket "assets" (voir README).
  const { data: logoData } = await admin.storage.from("assets").download(LOGO_STORAGE_PATH);
  const logoBuffer = logoData ? Buffer.from(await logoData.arrayBuffer()) : null;

  const jobId = randomUUID();
  const outputPath = `${user.id}/${jobId}/output.pdf`;

  const { error: insertError } = await admin.from("jobs").insert({
    id: jobId,
    template_id: template.id,
    product_id: product.id,
    source_image_path: product.image_path,
    status: "processing",
    created_by: user.id,
  });
  if (insertError) {
    return NextResponse.json({ error: insertError.message }, { status: 500 });
  }

  try {
    const pdfBuffer = await generatePrintReadyPdf({
      template,
      sourceImage: sourceBuffer,
      logoImage: logoBuffer,
    });

    const { error: uploadError } = await admin.storage
      .from("outputs")
      .upload(outputPath, pdfBuffer, { contentType: "application/pdf", upsert: true });
    if (uploadError) throw uploadError;

    await admin
      .from("jobs")
      .update({ status: "done", output_pdf_path: outputPath })
      .eq("id", jobId);

    const { data: signedUrl } = await admin.storage
      .from("outputs")
      .createSignedUrl(outputPath, 60 * 60); // valide 1h

    return NextResponse.json({ jobId, downloadUrl: signedUrl?.signedUrl ?? null });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erreur inconnue.";
    await admin.from("jobs").update({ status: "error", error_message: message }).eq("id", jobId);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
