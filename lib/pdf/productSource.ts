import type { SupabaseClient } from "@supabase/supabase-js";
import { mmToPx } from "./units";
import { composeFullCoverImage, composeTiledImage } from "./visual";
import type { Template, Visual, VisualMode } from "../types";

export interface ResolveProductImageInput {
  templateId: string;
  file: File | null;
  visualId: string | null;
  visualMode: VisualMode | null;
  tileSizeMm: number | null;
  positionX?: number;
  positionY?: number;
}

export interface ResolvedProductImage {
  buffer: Buffer;
  contentType: string;
  filename: string;
}

/**
 * Détermine l'image source d'un produit : soit le fichier uploadé tel
 * quel, soit un visuel de la banque composé (plein format ou mosaïque)
 * à la taille exacte de la page du modèle choisi.
 */
export async function resolveProductImage(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any>,
  input: ResolveProductImageInput
): Promise<ResolvedProductImage> {
  if (input.file) {
    return {
      buffer: Buffer.from(await input.file.arrayBuffer()),
      contentType: input.file.type || "image/jpeg",
      filename: input.file.name,
    };
  }

  if (!input.visualId || !input.visualMode) {
    throw new Error("Aucune image, ni visuel sélectionné.");
  }

  const { data: template, error: templateError } = await supabase
    .from("templates")
    .select("*")
    .eq("id", input.templateId)
    .single<Template>();
  if (templateError || !template) {
    throw new Error("Modèle introuvable.");
  }

  const { data: visual, error: visualError } = await supabase
    .from("visuals")
    .select("*")
    .eq("id", input.visualId)
    .single<Visual>();
  if (visualError || !visual) {
    throw new Error("Visuel introuvable.");
  }

  const { data: fileData, error: downloadError } = await supabase.storage
    .from("visuals")
    .download(visual.file_path);
  if (downloadError || !fileData) {
    throw new Error("Impossible de télécharger le visuel.");
  }
  const visualBuffer = Buffer.from(await fileData.arrayBuffer());

  const pageWidthMm = template.width_mm + template.bleed_mm * 2;
  const pageHeightMm = template.height_mm + template.bleed_mm * 2;
  const targetWidthPx = mmToPx(pageWidthMm, template.dpi);
  const targetHeightPx = mmToPx(pageHeightMm, template.dpi);

  if (input.visualMode === "tile") {
    const tileSizeMm = input.tileSizeMm ?? 25;
    const tileWidthPx = Math.max(1, mmToPx(tileSizeMm, template.dpi));
    const buffer = await composeTiledImage(
      visualBuffer,
      tileWidthPx,
      targetWidthPx,
      targetHeightPx,
      input.positionX,
      input.positionY
    );
    return { buffer, contentType: "image/jpeg", filename: "visual-tile.jpg" };
  }

  const buffer = await composeFullCoverImage(
    visualBuffer,
    targetWidthPx,
    targetHeightPx,
    input.positionX,
    input.positionY
  );
  return { buffer, contentType: "image/jpeg", filename: "visual-full.jpg" };
}
