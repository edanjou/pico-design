import { NextResponse } from "next/server";
import { logoShadowOf } from "@/lib/logoShadowSettings";
import { createServerSupabaseClient, createAdminSupabaseClient } from "@/lib/supabase/server";
import { generateProductMockupPng } from "@/lib/pdf/mockup";
import {
  beautyShotAssetPath,
  generateBeautyShotMockupPng,
  mimeTypeForAsset,
  parseBeautyShotXml,
  usedAssetNames,
} from "@/lib/pdf/beautyShot";
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
  if (!rawTemplate.beauty_shot_xml_path && (!rawTemplate.mask_path || !rawTemplate.shading_path)) {
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

  if (rawTemplate.beauty_shot_xml_path) {
    const xmlRes = await admin.storage.from("overlays").download(rawTemplate.beauty_shot_xml_path);
    if (!xmlRes.data) {
      return NextResponse.json({ error: "Impossible de charger le XML du mockup." }, { status: 500 });
    }
    const config = parseBeautyShotXml(await xmlRes.data.text());

    const assetEntries = await Promise.all(
      usedAssetNames(config).map(async (name) => {
        const path = beautyShotAssetPath(rawTemplate.id, name, mimeTypeForAsset(config, name));
        const { data } = await admin.storage.from("overlays").download(path);
        return [name, data ? Buffer.from(await data.arrayBuffer()) : null] as const;
      })
    );
    const missing = assetEntries.filter(([, buf]) => !buf);
    if (missing.length > 0) {
      return NextResponse.json(
        { error: `Fichiers manquants pour le mockup : ${missing.map(([name]) => name).join(", ")}.` },
        { status: 500 }
      );
    }
    const assets = new Map(assetEntries.map(([name, buf]) => [name, buf as Buffer]));

    const png = await generateBeautyShotMockupPng(
      template,
      config,
      assets,
      sourceBuffer,
      logoBuffer,
      product.image_position_x,
      product.image_position_y,
      logoShadowOf(product),
      rawTemplate.beauty_shot_overlay_opacities
    );
    return new NextResponse(new Uint8Array(png), {
      headers: { "Content-Type": "image/png", "Cache-Control": "private, no-store" },
    });
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
