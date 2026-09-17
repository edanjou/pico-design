import type { SupabaseClient } from "@supabase/supabase-js";
import { generatePrintReadyPdf } from "./generate";
import { loadLogoImage } from "./logo";
import { applyOrientation } from "./orientation";
import type { LogoShape, Template } from "../types";

export interface GenerateProductPdfInput {
  productId: string;
  templateId: string;
  sourceImage: Buffer;
  logoShape: LogoShape;
  logoColor: string;
  logoSecondaryColor: string;
  showLogo?: boolean;
  rotated?: boolean;
  positionX?: number;
  positionY?: number;
  // Image de verso (optionnelle, modèles recto-verso uniquement) — ajoutée
  // comme deuxième page, sans logo.
  backImage?: Buffer | null;
  backPositionX?: number;
  backPositionY?: number;
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
  const { data: rawTemplate, error: templateError } = await admin
    .from("templates")
    .select("*")
    .eq("id", input.templateId)
    .single<Template>();
  if (templateError || !rawTemplate) {
    throw new Error("Modèle introuvable pour la génération du PDF.");
  }
  const template = applyOrientation(rawTemplate, input.rotated ?? false);

  const showLogo = input.showLogo ?? true;
  const needsLogo =
    showLogo && (template.logo_on_front || (template.two_sided && template.logo_on_back));
  const logoBuffer = needsLogo
    ? await loadLogoImage(admin, input.logoShape, input.logoColor, input.logoSecondaryColor)
    : null;

  const pdfBuffer = await generatePrintReadyPdf({
    template,
    sourceImage: input.sourceImage,
    logoImage: showLogo && template.logo_on_front ? logoBuffer : null,
    positionX: input.positionX,
    positionY: input.positionY,
    backImage: template.two_sided ? input.backImage ?? null : null,
    backPositionX: input.backPositionX,
    backPositionY: input.backPositionY,
    backLogoImage: showLogo && template.two_sided && template.logo_on_back ? logoBuffer : null,
  });

  const pdfPath = `products/${input.productId}/output.pdf`;
  const { error: uploadError } = await admin.storage
    .from("outputs")
    .upload(pdfPath, pdfBuffer, { contentType: "application/pdf", upsert: true });
  if (uploadError) throw uploadError;

  return pdfPath;
}
