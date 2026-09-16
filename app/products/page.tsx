import Link from "next/link";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import ProductTableRow from "@/components/ProductTableRow";
import type { Product } from "@/lib/types";

type ProductWithTemplate = Product & { template: { name: string } | null };

export default async function ProductsPage() {
  const supabase = createServerSupabaseClient();
  const { data: products } = await supabase
    .from("products")
    .select("*, template:templates(name)")
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
        <h1 className="text-xl font-semibold text-pico-black">Produits</h1>
        <Link
          href="/products/new"
          className="rounded bg-pico-black px-3 py-1.5 text-sm text-white hover:bg-neutral-800"
        >
          + Nouveau produit
        </Link>
      </div>

      {rows.length === 0 ? (
        <p className="rounded border border-neutral-200 bg-white p-4 text-sm text-neutral-500">
          Aucun produit pour l&apos;instant.
        </p>
      ) : (
        <div className="overflow-x-auto rounded border border-neutral-200 bg-white">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs font-semibold uppercase tracking-wide text-neutral-500">
                <th className="p-3">Image</th>
                <th className="p-3">Nom</th>
                <th className="p-3">Modèle</th>
                <th className="p-3"></th>
              </tr>
            </thead>
            <tbody>
              {withUrls.map((p) => (
                <ProductTableRow
                  key={p.id}
                  product={p}
                  templateName={p.template?.name ?? "Modèle supprimé"}
                  imageUrl={p.imageUrl}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
