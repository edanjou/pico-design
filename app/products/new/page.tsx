import { createServerSupabaseClient } from "@/lib/supabase/server";
import ProductForm from "@/components/ProductForm";
import type { Template } from "@/lib/types";

export default async function NewProductPage() {
  const supabase = createServerSupabaseClient();
  const { data: templates } = await supabase
    .from("templates")
    .select("*")
    .order("name", { ascending: true });

  return (
    <div>
      <h1 className="mb-6 text-xl font-semibold text-pico-black">Nouveau produit</h1>
      <ProductForm templates={(templates as Template[]) ?? []} />
    </div>
  );
}
