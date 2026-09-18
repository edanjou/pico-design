import { NextResponse } from "next/server";
import { createServerSupabaseClient, createAdminSupabaseClient } from "@/lib/supabase/server";
import { MENU_ITEMS } from "@/lib/menuItems";

export const runtime = "nodejs";

export async function PATCH(request: Request) {
  const supabase = createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Non authentifié." }, { status: 401 });

  const body = await request.json().catch(() => null);
  const order = Array.isArray(body?.order) ? body.order : null;
  if (!order || !order.every((k: unknown) => typeof k === "string" && k in MENU_ITEMS)) {
    return NextResponse.json({ error: "Ordre invalide." }, { status: 400 });
  }

  // Chacun ne peut modifier que son propre ordre — écrit via le client
  // admin (la table `profiles` n'a pas de politique RLS d'update), mais
  // restreint explicitement à `user.id`.
  const admin = createAdminSupabaseClient();
  const { error } = await admin.from("profiles").update({ menu_order: order }).eq("id", user.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ success: true });
}
