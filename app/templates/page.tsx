import { createServerSupabaseClient, requireUser } from "@/lib/supabase/server";
import TemplatesTable, { type TemplateWithOverlayUrl } from "@/components/TemplatesTable";
import type { Category, Sku, Template } from "@/lib/types";

export default async function TemplatesPage() {
  await requireUser();
  const supabase = createServerSupabaseClient();
  const [{ data: templates }, { data: categories }, { data: skus }] = await Promise.all([
    supabase.from("templates").select("*").order("name", { ascending: true }),
    supabase.from("categories").select("*").order("name", { ascending: true }),
    supabase.from("skus").select("*").order("sku", { ascending: true }),
  ]);

  const rows = (templates as Template[]) ?? [];

  async function signedUrl(path: string | null) {
    if (!path) return null;
    const { data } = await supabase.storage.from("overlays").createSignedUrl(path, 60 * 30);
    return data?.signedUrl ?? null;
  }

  const withOverlayUrls: TemplateWithOverlayUrl[] = await Promise.all(
    rows.map(async (t) => ({
      ...t,
      overlayUrl: await signedUrl(t.overlay_path),
      maskUrl: await signedUrl(t.mask_path),
      shadingUrl: await signedUrl(t.shading_path),
    }))
  );

  return (
    <TemplatesTable
      templates={withOverlayUrls}
      categories={(categories as Category[]) ?? []}
      skus={(skus as Sku[]) ?? []}
    />
  );
}
