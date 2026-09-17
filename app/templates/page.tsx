import { createServerSupabaseClient } from "@/lib/supabase/server";
import TemplatesTable, { type TemplateWithOverlayUrl } from "@/components/TemplatesTable";
import type { Category, Sku, Template } from "@/lib/types";

export default async function TemplatesPage() {
  const supabase = createServerSupabaseClient();
  const [{ data: templates }, { data: categories }, { data: skus }] = await Promise.all([
    supabase.from("templates").select("*").order("name", { ascending: true }),
    supabase.from("categories").select("*").order("name", { ascending: true }),
    supabase.from("skus").select("*").order("sku", { ascending: true }),
  ]);

  const rows = (templates as Template[]) ?? [];

  const withOverlayUrls: TemplateWithOverlayUrl[] = await Promise.all(
    rows.map(async (t) => {
      if (!t.overlay_path) return { ...t, overlayUrl: null };
      const { data } = await supabase.storage.from("overlays").createSignedUrl(t.overlay_path, 60 * 30);
      return { ...t, overlayUrl: data?.signedUrl ?? null };
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
