import { createServerSupabaseClient, requireUser } from "@/lib/supabase/server";
import VisualsGrid, { type VisualWithUrl } from "@/components/VisualsGrid";
import type { Visual, VisualCollection } from "@/lib/types";

export default async function VisualsPage() {
  await requireUser();
  const supabase = createServerSupabaseClient();
  const [{ data: visuals }, { data: collections }] = await Promise.all([
    supabase.from("visuals").select("*").order("name", { ascending: true }),
    supabase.from("visual_collections").select("*").order("name", { ascending: true }),
  ]);

  const rows = (visuals as Visual[]) ?? [];

  const withUrls: VisualWithUrl[] = await Promise.all(
    rows.map(async (v) => {
      const { data } = await supabase.storage.from("visuals").createSignedUrl(v.file_path, 60 * 30);
      return { ...v, fileUrl: data?.signedUrl ?? null };
    })
  );

  return <VisualsGrid visuals={withUrls} collections={(collections as VisualCollection[]) ?? []} />;
}
