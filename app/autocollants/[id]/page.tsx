import { notFound } from "next/navigation";
import { createServerSupabaseClient, requireUser } from "@/lib/supabase/server";
import StickerTemplateEditor from "@/components/StickerTemplateEditor";
import type { StickerTemplate } from "@/lib/stickers/types";

// Un modèle d'autocollants : ses fichiers, ses zones de nom, et la
// préparation des planches.
export default async function StickerTemplatePage({ params }: { params: { id: string } }) {
  await requireUser();
  const { data } = await createServerSupabaseClient()
    .from("sticker_templates")
    .select("*")
    .eq("id", params.id)
    .maybeSingle<StickerTemplate>();
  if (!data) notFound();
  return <StickerTemplateEditor template={data} />;
}
