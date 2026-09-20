import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { parseSheetBody } from "@/lib/imposition/presets";

export async function POST(request: Request) {
  const supabase = createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Non authentifié." }, { status: 401 });

  const fields = parseSheetBody(await request.json().catch(() => null));
  if (!fields) {
    return NextResponse.json({ error: "La largeur et la hauteur sont requises." }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("imposition_sheets")
    .insert({ ...fields, created_by: user.id })
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ sheet: data });
}
