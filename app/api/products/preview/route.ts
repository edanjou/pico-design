import { NextResponse } from "next/server";
import { createServerSupabaseClient, createAdminSupabaseClient } from "@/lib/supabase/server";
import { resolveProductImage } from "@/lib/pdf/productSource";
import { generateTemplatePreviewPng } from "@/lib/pdf/preview";
import type { Template, VisualMode } from "@/lib/types";

export const runtime = "nodejs"; // sharp a besoin du runtime Node, pas Edge.

const LOGO_STORAGE_PATH = "pico-noir.svg"; // dans le bucket "assets"

export async function POST(request: Request) {
  const supabase = createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Non authentifié." }, { status: 401 });

  const formData = await request.formData();
  const templateId = formData.get("templateId");
  const file = formData.get("image");
  const visualId = formData.get("visualId");
  const visualMode = formData.get("visualMode");
  const tileSizeMm = formData.get("tileSizeMm");

  if (typeof templateId !== "string") {
    return NextResponse.json({ error: "Paramètre manquant (templateId)." }, { status: 400 });
  }

  const { data: template, error: templateError } = await supabase
    .from("templates")
    .select("*")
    .eq("id", templateId)
    .single<Template>();
  if (templateError || !template) {
    return NextResponse.json({ error: "Modèle introuvable." }, { status: 404 });
  }

  let resolved;
  try {
    resolved = await resolveProductImage(supabase, {
      templateId,
      file: file instanceof File && file.size > 0 ? file : null,
      visualId: typeof visualId === "string" ? visualId : null,
      visualMode: typeof visualMode === "string" ? (visualMode as VisualMode) : null,
      tileSizeMm: typeof tileSizeMm === "string" ? parseFloat(tileSizeMm) : null,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erreur lors du traitement de l'image.";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  const admin = createAdminSupabaseClient();
  const { data: logoData } = await admin.storage.from("assets").download(LOGO_STORAGE_PATH);
  const logoBuffer = logoData ? Buffer.from(await logoData.arrayBuffer()) : null;

  const png = await generateTemplatePreviewPng(template, logoBuffer, resolved.buffer);

  return new NextResponse(new Uint8Array(png), {
    headers: {
      "Content-Type": "image/png",
      "Cache-Control": "private, no-store",
    },
  });
}
