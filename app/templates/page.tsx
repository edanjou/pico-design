import { createServerSupabaseClient } from "@/lib/supabase/server";
import TemplatesTable from "@/components/TemplatesTable";
import type { Category, Template } from "@/lib/types";

export default async function TemplatesPage() {
  const supabase = createServerSupabaseClient();
  const [{ data: templates }, { data: categories }] = await Promise.all([
    supabase.from("templates").select("*").order("name", { ascending: true }),
    supabase.from("categories").select("*").order("name", { ascending: true }),
  ]);

  return (
    <TemplatesTable
      templates={(templates as Template[]) ?? []}
      categories={(categories as Category[]) ?? []}
    />
  );
}
