import { createServerSupabaseClient } from "@/lib/supabase/server";
import TemplatesTable from "@/components/TemplatesTable";
import type { Template } from "@/lib/types";

export default async function TemplatesPage() {
  const supabase = createServerSupabaseClient();
  const { data: templates } = await supabase
    .from("templates")
    .select("*")
    .order("name", { ascending: true });

  return <TemplatesTable templates={(templates as Template[]) ?? []} />;
}
