import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { createServerSupabaseClient, createAdminSupabaseClient } from "@/lib/supabase/server";
import { generatePrintReadyPdf } from "@/lib/pdf/generate";
import type { Template } from "@/lib/types";

export const runtime = "nodejs"; // sharp/pdf-lib ont besoin du runtime Node, pas Edge.

const LOGO_STORAGE_PATH = "assets/pico-logo.png"; // dans le bucket "assets"

export async function POST(request: Request) {
  const supabase = createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Non authentifié." }, { status: 401 });
  }

  const formData = await request.formData();
  const templateId = formData.get("templateId");
  const file = formData.get("image");

  if (typeof templateId !== "string" || !(file instanceof File)) {
    return NextResponse.json(
      { error: "Paramètres manquants (templateId, image)." },
      { status: 400 }
    );
  }

  const { data: template, error: templateError } = await supabase
    .from("templates")
    .select("*")
    .eq("id", templateId)
    .single<Template>();

  if (templateError || !template) {
    return NextResponse.json({ error: "Modèle introuvable." }, { status: 404 });
  }

  const admin = createAdminSupabaseClient();
  const sourceBuffer = Buffer.from(await file.arrayBuffer());

  // Logo Pico : à uploader une fois dans le bucket "assets" (voir README).
  const { data: logoData } = await admin.storage
    .from("assets")
    .download(LOGO_STORAGE_PATH);
  const logoBuffer = logoData ? Buffer.from(await logoData.arrayBuffer()) : null;

  const jobId = randomUUID();
  const sourcePath = `${user.id}/${jobId}/source-${file.name}`;
  const outputPath = `${user.id}/${jobId}/output.pdf`;

  const { error: insertError } = await admin.from("jobs").insert({
    id: jobId,
    template_id: template.id,
    source_image_path: sourcePath,
    status: "processing",
    created_by: user.id,
  });
  if (insertError) {
    return NextResponse.json({ error: insertError.message }, { status: 500 });
  }

  try {
    await admin.storage.from("uploads").upload(sourcePath, sourceBuffer, {
      contentType: file.type || "image/jpeg",
      upsert: true,
    });

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
