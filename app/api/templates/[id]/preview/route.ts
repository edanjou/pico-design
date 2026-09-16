import { NextResponse } from "next/server";
import { createServerSupabaseClient, createAdminSupabaseClient } from "@/lib/supabase/server";
import { generateTemplatePreviewPng } from "@/lib/pdf/preview";
import type { Template } from "@/lib/types";

export const runtime = "nodejs"; // sharp a besoin du runtime Node, pas Edge.

const LOGO_STORAGE_PATH = "assets/pico-noir.svg"; // dans le bucket "assets"

export async function GET(_request: Request, { params }: { params: { id: string } }) {
  const supabase = createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Non authentifié." }, { status: 401 });

  const { data: template, error } = await supabase
    .from("templates")
    .select("*")
    .eq("id", params.id)
    .single<Template>();

  if (error || !template) {
    return NextResponse.json({ error: "Modèle introuvable." }, { status: 404 });
  }

  const admin = createAdminSupabaseClient();
  const { data: logoData } = await admin.storage.from("assets").download(LOGO_STORAGE_PATH);
  const logoBuffer = logoData ? Buffer.from(await logoData.arrayBuffer()) : null;

  const png = await generateTemplatePreviewPng(template, logoBuffer);

  return new NextResponse(new Uint8Array(png), {
    headers: {
      "Content-Type": "image/png",
      "Cache-Control": "private, no-store",
    },
  });
}
