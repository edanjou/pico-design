import { NextResponse } from "next/server";
import { createServerSupabaseClient, createAdminSupabaseClient } from "@/lib/supabase/server";
import { generateProductMockupPng } from "@/lib/pdf/mockup";
import { loadLogoImage } from "@/lib/pdf/logo";
import { applyOrientation } from "@/lib/pdf/orientation";
import type { Product, Template } from "@/lib/types";

export const runtime = "nodejs"; // sharp a besoin du runtime Node, pas Edge.

export async function GET(_request: Request, { params }: { params: { id: string } }) {
  const supabase = createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Non authentifié." }, { status: 401 });

  const { data: product, error: productError } = await supabase
    .from("products")
    .select("*")
    .eq("id", params.id)
    .single<Product>();
  if (productError || !product) {
    return NextResponse.json({ error: "Produit introuvable." }, { status: 404 });
  }

  const { data: rawTemplate, error: templateError } = await supabase
    .from("templates")
    .select("*")
    .eq("id", product.template_id)
    .single<Template>();
  if (templateError || !rawTemplate) {
    return NextResponse.json({ error: "Modèle introuvable." }, { status: 404 });
  }
  if (!rawTemplate.mask_path || !rawTemplate.shading_path) {
    return NextResponse.json(
      { error: "Ce modèle n'a pas de masque et d'ombrage pour le mockup." },
      { status: 400 }
    );
  }
  const template = applyOrientation(rawTemplate, product.rotated);

  const admin = createAdminSupabaseClient();
  const [sourceRes, maskRes, shadingRes] = await Promise.all([
    admin.storage.from("uploads").download(product.image_path),
    admin.storage.from("overlays").download(rawTemplate.mask_path),
    admin.storage.from("overlays").download(rawTemplate.shading_path),
  ]);
  if (!sourceRes.data || !maskRes.data || !shadingRes.data) {
    return NextResponse.json({ error: "Impossible de charger les fichiers du mockup." }, { status: 500 });
  }

  let logoBuffer: Buffer | null = null;
  if (product.show_logo && template.logo_on_front) {
    logoBuffer = await loadLogoImage(admin, product.logo_shape, product.logo_color, product.logo_secondary_color);
  }

  const png = await generateProductMockupPng(
    template,
    Buffer.from(await sourceRes.data.arrayBuffer()),
    Buffer.from(await maskRes.data.arrayBuffer()),
    Buffer.from(await shadingRes.data.arrayBuffer()),
    logoBuffer,
    product.image_position_x,
    product.image_position_y
  );

  return new NextResponse(new Uint8Array(png), {
    headers: { "Content-Type": "image/png", "Cache-Control": "private, no-store" },
  });
}
