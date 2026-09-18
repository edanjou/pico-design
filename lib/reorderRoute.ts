import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "./supabase/server";

// Logique partagée par les routes `.../reorder` (catégories, collections de
// produits, collections de visuels) : reçoit la liste des id dans le nouvel
// ordre et réécrit `sort_order` (0, 1, 2...) en conséquence.
export async function handleReorderRequest(request: Request, table: string) {
  const supabase = createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Non authentifié." }, { status: 401 });

  const body = await request.json().catch(() => null);
  const order = Array.isArray(body?.order) ? body.order : null;
  if (!order || order.length === 0 || !order.every((id: unknown) => typeof id === "string")) {
    return NextResponse.json({ error: "Ordre invalide." }, { status: 400 });
  }

  const results = await Promise.all(
    order.map((id: string, index: number) => supabase.from(table).update({ sort_order: index }).eq("id", id))
  );
  const failed = results.find((r) => r.error);
  if (failed?.error) return NextResponse.json({ error: failed.error.message }, { status: 500 });

  return NextResponse.json({ success: true });
}
