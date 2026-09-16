import { createServerSupabaseClient } from "@/lib/supabase/server";
import UploadForm from "@/components/UploadForm";
import type { Product, TemplateCategory } from "@/lib/types";

type ProductWithTemplate = Product & {
  template: {
    name: string;
    category: TemplateCategory;
    width_mm: number;
    height_mm: number;
    dpi: number;
  } | null;
};

export default async function GeneratePage() {
  const supabase = createServerSupabaseClient();
  const { data: products } = await supabase
    .from("products")
    .select("*, template:templates(name, category, width_mm, height_mm, dpi)")
    .order("name", { ascending: true });

  const rows = (products as ProductWithTemplate[]) ?? [];

  const withUrls = await Promise.all(
    rows.map(async (p) => {
      const { data } = await supabase.storage.from("uploads").createSignedUrl(p.image_path, 60 * 10);
      return { ...p, imageUrl: data?.signedUrl ?? null };
    })
  );

  return (
    <div>
      <h1 className="mb-6 text-xl font-semibold text-pico-black">
        Générer un PDF prêt pour impression
      </h1>
      <UploadForm products={withUrls} />
    </div>
  );
}
