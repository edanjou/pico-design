import { notFound } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import ProductForm from "@/components/ProductForm";
import type { Product, Template } from "@/lib/types";

export default async function EditProductPage({ params }: { params: { id: string } }) {
  const supabase = createServerSupabaseClient();
  const [{ data: product }, { data: templates }] = await Promise.all([
    supabase.from("products").select("*").eq("id", params.id).single<Product>(),
    supabase.from("templates").select("*").order("name", { ascending: true }),
  ]);

  if (!product) notFound();

  const { data: signedUrl } = await supabase.storage
    .from("uploads")
    .createSignedUrl(product.image_path, 60 * 5);

  return (
    <div>
      <h1 className="mb-6 text-xl font-semibold text-pico-black">Modifier « {product.name} »</h1>
      <ProductForm
        templates={(templates as Template[]) ?? []}
        product={product}
        currentImageUrl={signedUrl?.signedUrl ?? null}
      />
    </div>
  );
}
