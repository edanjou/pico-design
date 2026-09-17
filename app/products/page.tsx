import { createServerSupabaseClient, requireUser } from "@/lib/supabase/server";
import ProductsTable, { type ProductWithTemplate } from "@/components/ProductsTable";
import type { VisualWithUrl } from "@/components/VisualsGrid";
import type { Category, ProductCollection, Template, Visual } from "@/lib/types";

export default async function ProductsPage() {
  await requireUser();
  const supabase = createServerSupabaseClient();
  const [
    { data: products },
    { data: templates },
    { data: categories },
    { data: visuals },
    { data: productCollections },
  ] = await Promise.all([
    supabase
      .from("products")
      .select("*, template:templates(name, category_id, width_mm, height_mm)")
      .order("name", { ascending: true }),
    supabase.from("templates").select("*").order("name", { ascending: true }),
    supabase.from("categories").select("*").order("name", { ascending: true }),
    supabase.from("visuals").select("*").order("name", { ascending: true }),
    supabase.from("product_collections").select("*").order("name", { ascending: true }),
  ]);

  const rows = (products as ProductWithTemplate[]) ?? [];

  const withUrls = await Promise.all(
    rows.map(async (p) => {
      // TTL généreux : l'URL sert aussi à l'aperçu dans la modale d'édition,
      // ouverte potentiellement longtemps après le chargement de la page.
      const { data } = await supabase.storage.from("uploads").createSignedUrl(p.image_path, 60 * 30);
      const backData = p.back_image_path
        ? await supabase.storage.from("uploads").createSignedUrl(p.back_image_path, 60 * 30)
        : null;
      return { ...p, imageUrl: data?.signedUrl ?? null, backImageUrl: backData?.data?.signedUrl ?? null };
    })
  );

  const visualRows = (visuals as Visual[]) ?? [];
  const visualsWithUrls: VisualWithUrl[] = await Promise.all(
    visualRows.map(async (v) => {
      const { data } = await supabase.storage.from("visuals").createSignedUrl(v.file_path, 60 * 30);
      return { ...v, fileUrl: data?.signedUrl ?? null };
    })
  );

  return (
    <ProductsTable
      products={withUrls}
      templates={(templates as Template[]) ?? []}
      categories={(categories as Category[]) ?? []}
      visuals={visualsWithUrls}
      collections={(productCollections as ProductCollection[]) ?? []}
    />
  );
}
