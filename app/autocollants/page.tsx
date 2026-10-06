import { createServerSupabaseClient, requireUser } from "@/lib/supabase/server";
import StickerTemplatesList from "@/components/StickerTemplatesList";
import type { StickerTemplate } from "@/lib/stickers/types";
import type { ImpositionSheet } from "@/lib/types";

// Module Autocollants : les modèles de planches (voir
// supabase/migrations/0066_sticker_templates.sql).
export default async function StickersPage() {
  await requireUser();
  const supabase = createServerSupabaseClient();
  const [{ data: templates }, { data: sheets }] = await Promise.all([
    supabase.from("sticker_templates").select("*").order("name", { ascending: true }),
    supabase
      .from("imposition_sheets")
      .select("*")
      .order("width_mm", { ascending: true })
      .order("height_mm", { ascending: true }),
  ]);
  return (
    <StickerTemplatesList
      templates={(templates as StickerTemplate[]) ?? []}
      sheets={(sheets as ImpositionSheet[]) ?? []}
    />
  );
}
