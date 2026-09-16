import { createServerSupabaseClient } from "@/lib/supabase/server";
import VisualsGrid, { type VisualWithUrl } from "@/components/VisualsGrid";
import type { Visual } from "@/lib/types";

export default async function VisualsPage() {
  const supabase = createServerSupabaseClient();
  const { data: visuals } = await supabase
    .from("visuals")
    .select("*")
    .order("name", { ascending: true });

  const rows = (visuals as Visual[]) ?? [];

  const withUrls: VisualWithUrl[] = await Promise.all(
    rows.map(async (v) => {
      const { data } = await supabase.storage.from("visuals").createSignedUrl(v.file_path, 60 * 30);
      return { ...v, fileUrl: data?.signedUrl ?? null };
    })
  );

  return <VisualsGrid visuals={withUrls} />;
}
