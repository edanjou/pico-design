import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { parseCutterForm } from "@/lib/imposition/presets";
import { MARKS_CONTENT_TYPES, detectMarksKind, safeStorageName } from "@/lib/imposition/marks";

export const runtime = "nodejs";

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const supabase = createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Non authentifié." }, { status: 401 });

  const formData = await request.formData();
  const parsed = parseCutterForm(formData);
  if ("error" in parsed) return NextResponse.json({ error: parsed.error }, { status: 400 });

  const { data: existing } = await supabase
    .from("imposition_cutters")
    .select("marks_path")
    .eq("id", params.id)
    .single<{ marks_path: string | null }>();
  if (!existing) return NextResponse.json({ error: "Découpeuse introuvable." }, { status: 404 });

  let marksPath = existing.marks_path;
  const marks = formData.get("marks");
  if (marks instanceof File && marks.size > 0) {
    const bytes = new Uint8Array(await marks.arrayBuffer());
    const kind = detectMarksKind(bytes);
    if (!kind) {
      return NextResponse.json({ error: "Les marques doivent être un PDF, un PNG ou un JPEG." }, { status: 400 });
    }
    marksPath = `${params.id}/marks-${safeStorageName(marks.name)}`;
    const { error: uploadError } = await supabase.storage
      .from("imposition")
      .upload(marksPath, bytes, { contentType: MARKS_CONTENT_TYPES[kind], upsert: true });
    if (uploadError) return NextResponse.json({ error: uploadError.message }, { status: 500 });
  } else if (formData.get("removeMarks") === "true") {
    marksPath = null;
  }

  const { data, error } = await supabase
    .from("imposition_cutters")
    .update({ ...parsed.fields, marks_path: marksPath })
    .eq("id", params.id)
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Nettoie l'ancien fichier de marques une fois la base à jour (remplacé ou retiré).
  if (existing.marks_path && existing.marks_path !== marksPath) {
    await supabase.storage.from("imposition").remove([existing.marks_path]);
  }
  return NextResponse.json({ cutter: data });
}

export async function DELETE(_request: Request, { params }: { params: { id: string } }) {
  const supabase = createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Non authentifié." }, { status: 401 });

  const { data, error } = await supabase
    .from("imposition_cutters")
    .delete()
    .eq("id", params.id)
    .select("marks_path");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data || data.length === 0) {
    return NextResponse.json({ error: "Découpeuse introuvable ou suppression non autorisée." }, { status: 404 });
  }
  const marksPath = (data[0] as { marks_path: string | null }).marks_path;
  if (marksPath) await supabase.storage.from("imposition").remove([marksPath]);
  return NextResponse.json({ ok: true });
}
