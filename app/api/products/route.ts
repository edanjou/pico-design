import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = createServerSupabaseClient();
  const { data, error } = await supabase
    .from("products")
    .select("*")
    .order("name", { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ products: data });
}

export async function POST(request: Request) {
  const supabase = createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Non authentifié." }, { status: 401 });

  const formData = await request.formData();
  const name = formData.get("name");
  const templateId = formData.get("templateId");
  const file = formData.get("image");

  if (typeof name !== "string" || typeof templateId !== "string" || !(file instanceof File)) {
    return NextResponse.json(
      { error: "Paramètres manquants (name, templateId, image)." },
      { status: 400 }
    );
  }

  const productId = randomUUID();
  const imagePath = `products/${productId}/source-${file.name}`;
  const imageBuffer = Buffer.from(await file.arrayBuffer());

  const { error: uploadError } = await supabase.storage
    .from("uploads")
    .upload(imagePath, imageBuffer, { contentType: file.type || "image/jpeg", upsert: true });
  if (uploadError) {
    return NextResponse.json({ error: uploadError.message }, { status: 500 });
  }

  const { data, error } = await supabase
    .from("products")
    .insert({
      id: productId,
      name,
      template_id: templateId,
      image_path: imagePath,
      created_by: user.id,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ product: data });
}
