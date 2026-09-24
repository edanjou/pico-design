import { createServerSupabaseClient, requireUser } from "@/lib/supabase/server";
import DesignTool from "@/components/DesignTool";
import type { VisualWithUrl } from "@/components/VisualsGrid";
import type { Category, Sku, Template, Visual } from "@/lib/types";

// Données de l'outil de design : modèles, catégories, SKUs (affiché au
// résumé) et banque de visuels — plus de notion de Produit (ni de
// collection) ici, l'outil ne fait que préparer un design (aperçu +
// téléchargement), il n'enregistre rien.
export default async function DesignPage() {
  await requireUser();
  const supabase = createServerSupabaseClient();
  const [{ data: templates }, { data: categories }, { data: skus }, { data: visuals }] = await Promise.all([
    supabase.from("templates").select("*").order("name", { ascending: true }),
    supabase.from("categories").select("*").order("sort_order", { ascending: true }),
    supabase.from("skus").select("*").order("sku", { ascending: true }),
    supabase.from("visuals").select("*").order("name", { ascending: true }),
  ]);

  const visualRows = (visuals as Visual[]) ?? [];
  const visualsWithUrls: VisualWithUrl[] = await Promise.all(
    visualRows.map(async (v) => {
      const { data } = await supabase.storage.from("visuals").createSignedUrl(v.file_path, 60 * 30);
      return { ...v, fileUrl: data?.signedUrl ?? null };
    })
  );

  return (
    <DesignTool
      templates={(templates as Template[]) ?? []}
      categories={(categories as Category[]) ?? []}
      skus={(skus as Sku[]) ?? []}
      visuals={visualsWithUrls}
    />
  );
}
