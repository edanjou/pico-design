import { NextResponse } from "next/server";
import { logoShadowOf } from "@/lib/logoShadowSettings";
import { createServerSupabaseClient, createAdminSupabaseClient } from "@/lib/supabase/server";
import { generateProductMockupPng } from "@/lib/pdf/mockup";
import { generateBeautyShotMockupPng } from "@/lib/pdf/beautyShot";
import { loadBeautyShotBundle } from "@/lib/pdf/beautyShotBundle";
import { resolveMockupBundle } from "@/lib/templateMockups";
import { loadLogoImage } from "@/lib/pdf/logo";
import { applyOrientation } from "@/lib/pdf/orientation";
import type { Product, Template } from "@/lib/types";

export const runtime = "nodejs"; // sharp a besoin du runtime Node, pas Edge.

export async function GET(request: Request, { params }: { params: { id: string } }) {
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
  // ?mockupId= choisit lequel rendre quand le modèle en a plusieurs (voir
  // resolveMockupBundle) ; absent = le premier, puis repli sur le bundle
  // hérité du modèle.
  const mockupId = new URL(request.url).searchParams.get("mockupId");
  const bundle = await resolveMockupBundle(supabase, rawTemplate, mockupId);
  if (mockupId && !bundle) {
    return NextResponse.json({ error: "Mockup introuvable pour ce modèle." }, { status: 404 });
  }
  if (!bundle && (!rawTemplate.mask_path || !rawTemplate.shading_path)) {
    return NextResponse.json(
      { error: "Ce modèle n'a pas de bundle mockup (XML) ni de masque/ombrage." },
      { status: 400 }
    );
  }
  const template = applyOrientation(rawTemplate, product.rotated);

  const admin = createAdminSupabaseClient();

  const sourceRes = await admin.storage.from("uploads").download(product.image_path);
  if (!sourceRes.data) {
    return NextResponse.json({ error: "Impossible de charger l'image du produit." }, { status: 500 });
  }
  const sourceBuffer = Buffer.from(await sourceRes.data.arrayBuffer());

  let logoBuffer: Buffer | null = null;
  if (product.show_logo && template.logo_on_front) {
    logoBuffer = await loadLogoImage(admin, product.logo_shape, product.logo_color, product.logo_secondary_color);
  }

  if (bundle) {
    // Assets manquants ou bundle incohérent (mesh hors de la scène, voir
    // generateBeautyShotMockupPng) : renvoyer le message tel quel, il dit
    // quoi corriger — sinon le client ne verrait qu'un 500 opaque.
    try {
      const { config, assets } = await loadBeautyShotBundle(admin.storage, bundle.xmlPath);

      const png = await generateBeautyShotMockupPng(
        template,
        config,
        assets,
        sourceBuffer,
        logoBuffer,
        // Le cadrage enregistré du produit place son visuel sur la page —
        // le même que l'aperçu et le PDF. Celui du mockup, plus bas, ne
        // choisit que la tranche vue par la caméra.
        product.image_position_x,
        product.image_position_y,
        logoShadowOf(product),
        bundle.overlayOpacities,
        1,
        0,
        [],
        bundle.marginLeft,
        bundle.marginRight,
        bundle.marginTop,
        bundle.marginBottom,
        bundle.positionX ?? 0.5,
        bundle.positionY ?? 0.5,
        bundle.zoom ?? 1
      );
      return new NextResponse(new Uint8Array(png), {
        headers: { "Content-Type": "image/png", "Cache-Control": "private, no-store" },
      });
    } catch (err) {
      return NextResponse.json(
        { error: err instanceof Error ? err.message : "Erreur lors de la génération du mockup." },
        { status: 500 }
      );
    }
  }

  const [maskRes, shadingRes] = await Promise.all([
    admin.storage.from("overlays").download(rawTemplate.mask_path!),
    admin.storage.from("overlays").download(rawTemplate.shading_path!),
  ]);
  if (!maskRes.data || !shadingRes.data) {
    return NextResponse.json({ error: "Impossible de charger les fichiers du mockup." }, { status: 500 });
  }

  const png = await generateProductMockupPng(
    template,
    sourceBuffer,
    Buffer.from(await maskRes.data.arrayBuffer()),
    Buffer.from(await shadingRes.data.arrayBuffer()),
    logoBuffer,
    product.image_position_x,
    product.image_position_y,
    logoShadowOf(product)
  );

  return new NextResponse(new Uint8Array(png), {
    headers: { "Content-Type": "image/png", "Cache-Control": "private, no-store" },
  });
}
