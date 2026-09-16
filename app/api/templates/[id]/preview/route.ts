import { NextResponse } from "next/server";
import { createServerSupabaseClient, createAdminSupabaseClient } from "@/lib/supabase/server";
import { generateTemplatePreviewPng } from "@/lib/pdf/preview";
import { loadLogoImage } from "@/lib/pdf/logo";
import type { Template } from "@/lib/types";

export const runtime = "nodejs"; // sharp a besoin du runtime Node, pas Edge.

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
  const logoBuffer = await loadLogoImage(admin, "logo", "#000000");

  let overlayBuffer: Buffer | null = null;
  if (template.overlay_path) {
    const { data: overlayData } = await admin.storage.from("overlays").download(template.overlay_path);
    overlayBuffer = overlayData ? Buffer.from(await overlayData.arrayBuffer()) : null;
  }

  const png = await generateTemplatePreviewPng(template, logoBuffer, null, overlayBuffer);

  return new NextResponse(new Uint8Array(png), {
    headers: {
      "Content-Type": "image/png",
      "Cache-Control": "private, no-store",
    },
  });
}
