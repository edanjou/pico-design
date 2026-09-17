import { createServerSupabaseClient } from "@/lib/supabase/server";
import SkusTable from "@/components/SkusTable";
import type { Sku } from "@/lib/types";

export default async function SkusPage() {
  const supabase = createServerSupabaseClient();
  const { data: skus } = await supabase.from("skus").select("*").order("sku", { ascending: true });

  return <SkusTable skus={(skus as Sku[]) ?? []} />;
}
