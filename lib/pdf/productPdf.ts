import type { SupabaseClient } from "@supabase/supabase-js";
import { generatePrintReadyPdf } from "./generate";
import { loadLogoImage } from "./logo";
import type { LogoShape, Template } from "../types";

export interface GenerateProductPdfInput {
  productId: string;
  templateId: string;
  sourceImage: Buffer;
  logoShape: LogoShape;
  logoColor: string;
  logoSecondaryColor: string;
  positionX?: number;
  positionY?: number;
}

/**
 * Génère le PDF prêt-pour-impression d'un produit et le dépose dans le
 * bucket "outputs", à un chemin déterministe basé sur l'id du produit
 * (écrasé à chaque nouvelle génération). Retourne le chemin stocké.
 */
export async function generateAndStoreProductPdf(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  admin: SupabaseClient<any>,
  input: GenerateProductPdfInput
): Promise<string> {
  const { data: template, error: templateError } = await admin
    .from("templates")
    .select("*")
    .eq("id", input.templateId)
    .single<Template>();
  if (templateError || !template) {
    throw new Error("Modèle introuvable pour la génération du PDF.");
  }

  const logoBuffer = await loadLogoImage(
    admin,
    input.logoShape,
    input.logoColor,
    input.logoSecondaryColor
  );

  const pdfBuffer = await generatePrintReadyPdf({
    template,
    sourceImage: input.sourceImage,
    logoImage: logoBuffer,
    positionX: input.positionX,
    positionY: input.positionY,
  });

  const pdfPath = `products/${input.productId}/output.pdf`;
  const { error: uploadError } = await admin.storage
    .from("outputs")
    .upload(pdfPath, pdfBuffer, { contentType: "application/pdf", upsert: true });
  if (uploadError) throw uploadError;

  return pdfPath;
}
