import Link from "next/link";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import ProductsTable, { type ProductWithTemplate } from "@/components/ProductsTable";

export default async function ProductsPage() {
  const supabase = createServerSupabaseClient();
  const { data: products } = await supabase
    .from("products")
    .select("*, template:templates(name, category)")
    .order("name", { ascending: true });

  const rows = (products as ProductWithTemplate[]) ?? [];

  const withUrls = await Promise.all(
    rows.map(async (p) => {
      const { data } = await supabase.storage.from("uploads").createSignedUrl(p.image_path, 60 * 5);
      return { ...p, imageUrl: data?.signedUrl ?? null };
    })
  );

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-pico-black">Produits</h1>
          <p className="text-sm text-neutral-500">
            {rows.length} produit{rows.length > 1 ? "s" : ""} au catalogue.
          </p>
        </div>
        <Link
          href="/products/new"
          className="flex items-center gap-2 rounded-lg bg-pico-maroon px-4 py-2 text-sm font-medium text-white hover:bg-pico-maroon-dark"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className="h-4 w-4">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v14m-7-7h14" />
          </svg>
          Nouveau produit
        </Link>
      </div>

      <ProductsTable products={withUrls} />
    </div>
  );
}
