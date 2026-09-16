import { createServerSupabaseClient } from "@/lib/supabase/server";
import UploadForm from "@/components/UploadForm";
import type { Template } from "@/lib/types";

export default async function GeneratePage() {
  const supabase = createServerSupabaseClient();
  const { data: templates } = await supabase
    .from("templates")
    .select("*")
    .order("name", { ascending: true });

  return (
    <div>
      <h1 className="mb-6 text-xl font-semibold text-pico-700">
        Générer un PDF prêt pour impression
      </h1>
      <UploadForm templates={(templates as Template[]) ?? []} />
    </div>
  );
}
