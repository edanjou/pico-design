import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { parseCutterForm } from "@/lib/imposition/presets";
import { MARKS_CONTENT_TYPES, detectMarksKind, safeStorageName } from "@/lib/imposition/marks";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const supabase = createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Non authentifié." }, { status: 401 });

  const formData = await request.formData();
  const parsed = parseCutterForm(formData);
  if ("error" in parsed) return NextResponse.json({ error: parsed.error }, { status: 400 });

  const id = randomUUID();
  let marksPath: string | null = null;
  const marks = formData.get("marks");
  if (marks instanceof File && marks.size > 0) {
    const bytes = new Uint8Array(await marks.arrayBuffer());
    const kind = detectMarksKind(bytes);
    if (!kind) {
      return NextResponse.json({ error: "Les marques doivent être un PDF, un PNG ou un JPEG." }, { status: 400 });
    }
    marksPath = `${id}/marks-${safeStorageName(marks.name)}`;
    const { error: uploadError } = await supabase.storage
      .from("imposition")
      .upload(marksPath, bytes, { contentType: MARKS_CONTENT_TYPES[kind], upsert: true });
    if (uploadError) return NextResponse.json({ error: uploadError.message }, { status: 500 });
  }

  const { data, error } = await supabase
    .from("imposition_cutters")
    .insert({ id, ...parsed.fields, marks_path: marksPath, created_by: user.id })
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ cutter: data });
}
