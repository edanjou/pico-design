import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { createServerSupabaseClient } from "@/lib/supabase/server";

const STRING_FIELDS = ["name", "category_id", "logo_h_align", "logo_v_align"] as const;
const NULLABLE_STRING_FIELDS = ["sku_id"] as const;
const NUMERIC_FIELDS = [
  "width_mm",
  "height_mm",
  "bleed_mm",
  "safety_margin_x_mm",
  "safety_margin_y_mm",
  "print_margin_x_mm",
  "print_margin_y_mm",
  "dpi",
  "logo_width_mm",
  "logo_margin_x_mm",
  "logo_margin_y_mm",
] as const;
const BOOLEAN_FIELDS = ["two_sided", "logo_on_front", "logo_on_back"] as const;

export async function GET() {
  const supabase = createServerSupabaseClient();
  const { data, error } = await supabase
    .from("templates")
    .select("*")
    .order("name", { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ templates: data });
}

export async function POST(request: Request) {
  const supabase = createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Non authentifié." }, { status: 401 });

  const formData = await request.formData();
  const body: Record<string, unknown> = {};
  for (const field of STRING_FIELDS) {
    const v = formData.get(field);
    if (typeof v === "string") body[field] = v;
  }
  for (const field of NULLABLE_STRING_FIELDS) {
    const v = formData.get(field);
    if (typeof v === "string") body[field] = v === "" ? null : v;
  }
  for (const field of NUMERIC_FIELDS) {
    const v = formData.get(field);
    if (typeof v === "string") body[field] = parseFloat(v);
  }
  for (const field of BOOLEAN_FIELDS) {
    const v = formData.get(field);
    if (typeof v === "string") body[field] = v === "true";
  }

  const templateId = randomUUID();
  const overlayFile = formData.get("overlay");
  let overlayPath: string | null = null;

  if (overlayFile instanceof File && overlayFile.size > 0) {
    overlayPath = `${templateId}/${overlayFile.name}`;
    const buffer = Buffer.from(await overlayFile.arrayBuffer());
    const { error: uploadError } = await supabase.storage
      .from("overlays")
      .upload(overlayPath, buffer, { contentType: overlayFile.type || "image/png", upsert: true });
    if (uploadError) {
      return NextResponse.json({ error: uploadError.message }, { status: 500 });
    }
  }

  const { data, error } = await supabase
    .from("templates")
    .insert({ id: templateId, ...body, overlay_path: overlayPath, created_by: user.id })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ template: data });
}
