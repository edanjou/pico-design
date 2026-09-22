import { createServerSupabaseClient, requireUser } from "@/lib/supabase/server";
import TemplatesTable, { type TemplateWithOverlayUrl } from "@/components/TemplatesTable";
import { parseBeautyShotXml, usedAssetNames, type BeautyShotOverlay } from "@/lib/pdf/beautyShot";
import type { Category, Sku, Template } from "@/lib/types";

export default async function TemplatesPage() {
  await requireUser();
  const supabase = createServerSupabaseClient();
  const [{ data: templates }, { data: categories }, { data: skus }] = await Promise.all([
    supabase.from("templates").select("*").order("name", { ascending: true }),
    supabase.from("categories").select("*").order("sort_order", { ascending: true }),
    supabase.from("skus").select("*").order("sku", { ascending: true }),
  ]);

  const rows = (templates as Template[]) ?? [];

  async function signedUrl(path: string | null) {
    if (!path) return null;
    const { data } = await supabase.storage.from("overlays").createSignedUrl(path, 60 * 30);
    return data?.signedUrl ?? null;
  }

  // Assets et surcouches (avec leur mode de fusion) déclarés par le XML —
  // ces dernières servent à afficher un curseur d'intensité par couche
  // dans TemplateForm (voir beauty_shot_overlay_opacities).
  async function beautyShotInfo(path: string | null): Promise<{ assetNames: string[]; overlays: BeautyShotOverlay[] }> {
    if (!path) return { assetNames: [], overlays: [] };
    const { data } = await supabase.storage.from("overlays").download(path);
    if (!data) return { assetNames: [], overlays: [] };
    try {
      const config = parseBeautyShotXml(await data.text());
      return { assetNames: usedAssetNames(config), overlays: config.overlays };
    } catch {
      return { assetNames: [], overlays: [] };
    }
  }

  const withOverlayUrls: TemplateWithOverlayUrl[] = await Promise.all(
    rows.map(async (t) => {
      const { assetNames, overlays } = await beautyShotInfo(t.beauty_shot_xml_path);
      return {
        ...t,
        overlayUrl: await signedUrl(t.overlay_path),
        beautyShotXmlUrl: await signedUrl(t.beauty_shot_xml_path),
        beautyShotAssetNames: assetNames,
        beautyShotOverlays: overlays,
      };
    })
  );

  return (
    <TemplatesTable
      templates={withOverlayUrls}
      categories={(categories as Category[]) ?? []}
      skus={(skus as Sku[]) ?? []}
    />
  );
}
