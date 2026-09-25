import { createServerSupabaseClient, requireUser } from "@/lib/supabase/server";
import ThemesTable from "@/components/ThemesTable";
import type { Template, Theme } from "@/lib/types";

export default async function ThemesPage() {
  await requireUser();
  const supabase = createServerSupabaseClient();
  const [{ data: themes }, { data: templates }] = await Promise.all([
    supabase.from("themes").select("*").order("name", { ascending: true }),
    supabase.from("templates").select("*").order("name", { ascending: true }),
  ]);

  const rows = (themes as Theme[]) ?? [];
  const withOverlayUrls = await Promise.all(
    rows.map(async (t) => {
      const { data } = await supabase.storage.from("overlays").createSignedUrl(t.overlay_path, 60 * 30);
      return { ...t, overlayUrl: data?.signedUrl ?? null };
    })
  );

  return <ThemesTable themes={withOverlayUrls} templates={(templates as Template[]) ?? []} />;
}
