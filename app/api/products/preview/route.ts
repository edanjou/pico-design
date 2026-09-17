import { NextResponse } from "next/server";
import { createServerSupabaseClient, createAdminSupabaseClient } from "@/lib/supabase/server";
import { resolveProductImage } from "@/lib/pdf/productSource";
import { generateTemplatePreviewPng } from "@/lib/pdf/preview";
import { loadLogoImage } from "@/lib/pdf/logo";
import { parsePositionValue } from "@/lib/pdf/crop";
import type { LogoShape, Template, VisualMode } from "@/lib/types";

export const runtime = "nodejs"; // sharp a besoin du runtime Node, pas Edge.

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
  const logoShape = formData.get("logoShape");
  const logoColor = formData.get("logoColor");
  const logoSecondaryColor = formData.get("logoSecondaryColor");
  const positionX = formData.get("positionX");
  const positionY = formData.get("positionY");
  const existingImagePath = formData.get("existingImagePath");

  if (typeof templateId !== "string") {
    return NextResponse.json({ error: "Paramètre manquant (templateId)." }, { status: 400 });
  }

  const clampedPositionX = parsePositionValue(positionX);
  const clampedPositionY = parsePositionValue(positionY);

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
      positionX: clampedPositionX,
      positionY: clampedPositionY,
      existingImagePath: typeof existingImagePath === "string" ? existingImagePath : null,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erreur lors du traitement de l'image.";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  const admin = createAdminSupabaseClient();
  const shape: LogoShape = logoShape === "pastille" ? "pastille" : "logo";
  const color = typeof logoColor === "string" ? logoColor : "#000000";
  const secondaryColor = typeof logoSecondaryColor === "string" ? logoSecondaryColor : "#FFFFFF";
  const logoBuffer = await loadLogoImage(admin, shape, color, secondaryColor);

  let overlayBuffer: Buffer | null = null;
  if (template.overlay_path) {
    const { data: overlayData } = await admin.storage.from("overlays").download(template.overlay_path);
    overlayBuffer = overlayData ? Buffer.from(await overlayData.arrayBuffer()) : null;
  }

  const png = await generateTemplatePreviewPng(
    template,
    logoBuffer,
    resolved.buffer,
    overlayBuffer,
    clampedPositionX,
    clampedPositionY
  );

  return new NextResponse(new Uint8Array(png), {
    headers: {
      "Content-Type": "image/png",
      "Cache-Control": "private, no-store",
    },
  });
}
