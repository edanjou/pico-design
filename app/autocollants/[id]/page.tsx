import { notFound } from "next/navigation";
import { createServerSupabaseClient, requireUser } from "@/lib/supabase/server";
import StickerTemplateEditor from "@/components/StickerTemplateEditor";
import type { StickerTemplate } from "@/lib/stickers/types";
import type { ImpositionCutter, ImpositionSheet } from "@/lib/types";

// Un modèle d'autocollants : ses fichiers, ses zones de nom, et la
// préparation des planches.
export default async function StickerTemplatePage({ params }: { params: { id: string } }) {
  await requireUser();
  const supabase = createServerSupabaseClient();
  const [{ data }, { data: cutters }, { data: sheets }] = await Promise.all([
    supabase.from("sticker_templates").select("*").eq("id", params.id).maybeSingle<StickerTemplate>(),
    // Profils Graphtec : feuille, marges, calibration et codes de la planche.
    supabase.from("imposition_cutters").select("*").eq("machine", "graphtec").order("name", { ascending: true }),
    supabase.from("imposition_sheets").select("*"),
  ]);
  if (!data) notFound();
  return (
    <StickerTemplateEditor
      template={data}
      cutters={(cutters as ImpositionCutter[]) ?? []}
      sheets={(sheets as ImpositionSheet[]) ?? []}
    />
  );
}
