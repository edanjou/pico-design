import { createServerSupabaseClient } from "@/lib/supabase/server";
import SkusTable from "@/components/SkusTable";
import type { Sku, SkuGroup } from "@/lib/types";

export default async function SkusPage() {
  const supabase = createServerSupabaseClient();
  const [{ data: skus }, { data: skuGroups }] = await Promise.all([
    supabase.from("skus").select("*").order("sku", { ascending: true }),
    supabase.from("sku_groups").select("*").order("name", { ascending: true }),
  ]);

  return <SkusTable skus={(skus as Sku[]) ?? []} skuGroups={(skuGroups as SkuGroup[]) ?? []} />;
}
