import { NextResponse } from "next/server";
import { createServerSupabaseClient, createAdminSupabaseClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

export async function GET(_request: Request, { params }: { params: { id: string } }) {
  const supabase = createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Non authentifié." }, { status: 401 });

  const { data: product, error } = await supabase
    .from("products")
    .select("name, pdf_path")
    .eq("id", params.id)
    .single<{ name: string; pdf_path: string | null }>();
  if (error || !product) {
    return NextResponse.json({ error: "Produit introuvable." }, { status: 404 });
  }
  if (!product.pdf_path) {
    return NextResponse.json(
      { error: "Le PDF n'a pas encore été généré pour ce produit." },
      { status: 404 }
    );
  }

  const admin = createAdminSupabaseClient();
  const { data: file, error: downloadError } = await admin.storage
    .from("outputs")
    .download(product.pdf_path);
  if (downloadError || !file) {
    return NextResponse.json({ error: "Fichier PDF introuvable." }, { status: 404 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const safeName = product.name.replace(/[^a-z0-9-_ ]/gi, "").trim() || "produit";

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${safeName}.pdf"`,
      "Cache-Control": "private, no-store",
    },
  });
}
