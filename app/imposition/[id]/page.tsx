import { notFound } from "next/navigation";
import { createServerSupabaseClient, requireUser } from "@/lib/supabase/server";
import ImpositionTool from "@/components/ImpositionTool";
import { loadImpositionToolData } from "@/lib/imposition/toolData";
import type { SavedImposition } from "@/lib/imposition/saved";

export default async function EditImpositionPage({ params }: { params: { id: string } }) {
  await requireUser();
  const supabase = createServerSupabaseClient();
  const { data: saved } = await supabase
    .from("impositions")
    .select("*")
    .eq("id", params.id)
    .maybeSingle<SavedImposition>();
  if (!saved) notFound();
  return <ImpositionTool {...await loadImpositionToolData()} saved={saved} />;
}
