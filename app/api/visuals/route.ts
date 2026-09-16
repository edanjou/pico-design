import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { createServerSupabaseClient } from "@/lib/supabase/server";

const ALLOWED_TYPES = ["image/svg+xml", "image/png", "image/jpeg"];

export async function GET() {
  const supabase = createServerSupabaseClient();
  const { data, error } = await supabase
    .from("visuals")
    .select("*")
    .order("name", { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ visuals: data });
}

export async function POST(request: Request) {
  const supabase = createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Non authentifié." }, { status: 401 });

  const formData = await request.formData();
  const name = formData.get("name");
  const file = formData.get("file");

  if (typeof name !== "string" || !(file instanceof File)) {
    return NextResponse.json({ error: "Paramètres manquants (name, file)." }, { status: 400 });
  }
  if (!ALLOWED_TYPES.includes(file.type)) {
    return NextResponse.json(
      { error: "Format non supporté (SVG, PNG ou JPG uniquement)." },
      { status: 400 }
    );
  }

  const visualId = randomUUID();
  const filePath = `${visualId}/${file.name}`;
  const buffer = Buffer.from(await file.arrayBuffer());

  const { error: uploadError } = await supabase.storage
    .from("visuals")
    .upload(filePath, buffer, { contentType: file.type, upsert: true });
  if (uploadError) {
    return NextResponse.json({ error: uploadError.message }, { status: 500 });
  }

  const { data, error } = await supabase
    .from("visuals")
    .insert({
      id: visualId,
      name,
      file_path: filePath,
      mime_type: file.type,
      created_by: user.id,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ visual: data });
}
