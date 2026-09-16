import { createServerSupabaseClient } from "@/lib/supabase/server";
import ProductsTable, { type ProductWithTemplate } from "@/components/ProductsTable";
import type { Template } from "@/lib/types";

export default async function ProductsPage() {
  const supabase = createServerSupabaseClient();
  const [{ data: products }, { data: templates }] = await Promise.all([
    supabase
      .from("products")
      .select("*, template:templates(name, category)")
      .order("name", { ascending: true }),
    supabase.from("templates").select("*").order("name", { ascending: true }),
  ]);

  const rows = (products as ProductWithTemplate[]) ?? [];

  const withUrls = await Promise.all(
    rows.map(async (p) => {
      // TTL généreux : l'URL sert aussi à l'aperçu dans la modale d'édition,
      // ouverte potentiellement longtemps après le chargement de la page.
      const { data } = await supabase.storage.from("uploads").createSignedUrl(p.image_path, 60 * 30);
      return { ...p, imageUrl: data?.signedUrl ?? null };
    })
  );

  return <ProductsTable products={withUrls} templates={(templates as Template[]) ?? []} />;
}
