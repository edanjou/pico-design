import type { SupabaseClient } from "@supabase/supabase-js";

// Calcule le prochain `sort_order` d'une table réordonnable (catégories,
// collections...) pour qu'un nouvel élément apparaisse à la fin de la liste
// plutôt qu'en tête (valeur par défaut 0).
export async function nextSortOrder(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any>,
  table: string
): Promise<number> {
  const { data } = await supabase
    .from(table)
    .select("sort_order")
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle<{ sort_order: number }>();
  return (data?.sort_order ?? -1) + 1;
}
