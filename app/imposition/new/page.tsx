import { requireUser } from "@/lib/supabase/server";
import ImpositionTool from "@/components/ImpositionTool";
import { loadImpositionToolData } from "@/lib/imposition/toolData";

export default async function NewImpositionPage() {
  await requireUser();
  return <ImpositionTool {...await loadImpositionToolData()} saved={null} />;
}
