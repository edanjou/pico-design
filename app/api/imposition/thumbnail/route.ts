import { NextResponse } from "next/server";
import { createAdminSupabaseClient, createServerSupabaseClient } from "@/lib/supabase/server";
import { STORED_SOURCE_PATH } from "@/lib/imposition/saved";
import { isPdfBuffer } from "@/lib/pdf/rasterizePdf";
import { pdfThumbnailJpeg } from "@/lib/pdf/thumbnail";

export const runtime = "nodejs";
export const maxDuration = 30;

const error = (message: string, status = 400) => NextResponse.json({ error: message }, { status });

// Miniature du recto d'un fichier à imposer, pour l'aperçu de la feuille : un
// produit Pico (`productId`), un PDF déjà enregistré avec l'imposition (`path`)
// ou un PDF téléversé (`file`).
export async function POST(request: Request) {
  const supabase = createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return error("Non authentifié.", 401);

  const form = await request.formData();
  const productId = form.get("productId");
  const path = form.get("path");
  const file = form.get("file");

  let pdf: Buffer;
  if (typeof productId === "string" && productId) {
    const { data: product } = await supabase
      .from("products")
      .select("pdf_path")
      .eq("id", productId)
      .single<{ pdf_path: string | null }>();
    if (!product?.pdf_path) return error("PDF du produit introuvable.", 404);
    const { data, error: downloadError } = await createAdminSupabaseClient()
      .storage.from("outputs")
      .download(product.pdf_path);
    if (downloadError || !data) return error("PDF du produit introuvable.", 404);
    pdf = Buffer.from(await data.arrayBuffer());
  } else if (typeof path === "string" && path) {
    if (!STORED_SOURCE_PATH.test(path)) return error("Fichier enregistré invalide.");
    const { data, error: downloadError } = await createAdminSupabaseClient()
      .storage.from("imposition")
      .download(path);
    if (downloadError || !data) return error("Fichier introuvable.", 404);
    pdf = Buffer.from(await data.arrayBuffer());
  } else if (file instanceof File && file.size > 0) {
    pdf = Buffer.from(await file.arrayBuffer());
  } else {
    return error("Aucun fichier.");
  }
  if (!isPdfBuffer(pdf)) return error("Ce fichier n'est pas un PDF.");

  try {
    const jpeg = await pdfThumbnailJpeg(pdf);
    return new NextResponse(new Uint8Array(jpeg), {
      headers: { "Content-Type": "image/jpeg", "Cache-Control": "private, no-store" },
    });
  } catch (err) {
    return error(err instanceof Error ? err.message : "Impossible de lire ce PDF.", 422);
  }
}
