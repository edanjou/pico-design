import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const supabase = createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Non authentifié." }, { status: 401 });

  const formData = await request.formData();
  const name = formData.get("name");
  const templateId = formData.get("templateId");
  const file = formData.get("image");

  if (typeof name !== "string" || typeof templateId !== "string") {
    return NextResponse.json(
      { error: "Paramètres manquants (name, templateId)." },
      { status: 400 }
    );
  }

  const update: Record<string, unknown> = { name, template_id: templateId };

  if (file instanceof File && file.size > 0) {
    const imagePath = `products/${params.id}/source-${file.name}`;
    const imageBuffer = Buffer.from(await file.arrayBuffer());
    const { error: uploadError } = await supabase.storage
      .from("uploads")
      .upload(imagePath, imageBuffer, { contentType: file.type || "image/jpeg", upsert: true });
    if (uploadError) {
      return NextResponse.json({ error: uploadError.message }, { status: 500 });
    }
    update.image_path = imagePath;
  }

  const { data, error } = await supabase
    .from("products")
    .update(update)
    .eq("id", params.id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ product: data });
}

export async function DELETE(_request: Request, { params }: { params: { id: string } }) {
  const supabase = createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Non authentifié." }, { status: 401 });

  const { data, error } = await supabase
    .from("products")
    .delete()
    .eq("id", params.id)
    .select();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data || data.length === 0) {
    return NextResponse.json(
      { error: "Produit introuvable ou suppression non autorisée." },
      { status: 404 }
    );
  }
  return NextResponse.json({ ok: true });
}
