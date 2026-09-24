import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { resolveProductImage } from "@/lib/pdf/productSource";
import { generatePrintReadyPdf } from "@/lib/pdf/generate";
import { coverCropToBuffer, parsePositionValue } from "@/lib/pdf/crop";
import { mmToPx } from "@/lib/pdf/units";
import { applyOrientation } from "@/lib/pdf/orientation";
import { pdfDownloadName } from "@/lib/imposition/saved";
import { resolveLayersFromForm } from "@/lib/pdf/layers";
import type { Template } from "@/lib/types";

export const runtime = "nodejs"; // sharp/pdf-lib ont besoin du runtime Node, pas Edge.
export const maxDuration = 60;

function errorResponse(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

function zoomValue(raw: FormDataEntryValue | null): number {
  const n = parseFloat(String(raw ?? ""));
  return Number.isFinite(n) && n >= 0.1 ? n : 1;
}

// Normalise à un multiple de 90° dans [0, 360) — seuls ces angles sont
// proposés côté client (voir ImageSourcePicker), mais on protège quand même
// contre une valeur arbitraire envoyée directement à la route.
function rotationValue(raw: FormDataEntryValue | null): number {
  const n = Math.round(Number(raw ?? 0) / 90) * 90;
  return Number.isFinite(n) ? ((n % 360) + 360) % 360 : 0;
}

/**
 * Design Shopify (étape Résumé) : le PDF prêt-pour-impression final — pas un
 * aperçu (voir /api/products/preview, capé à 900 px) : pleine résolution,
 * fond perdu compris, recto + verso dans un seul fichier, exactement comme
 * pour un vrai Produit (lib/pdf/productPdf.ts), mais sans rien enregistrer
 * dans Pico Design — le fichier est renvoyé directement au téléchargement.
 * Contrairement au vrai Produit, jamais de logo Pico ici (voir DesignPreview),
 * même si le modèle a `logo_on_front`/`logo_on_back`.
 */
export async function POST(request: Request) {
  const supabase = createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return errorResponse("Non authentifié.", 401);

  const formData = await request.formData();
  const templateId = formData.get("templateId");
  if (typeof templateId !== "string") return errorResponse("Paramètre manquant (templateId).");
  const rotated = formData.get("rotated") === "true";

  // Optionnel : sans fichier, le recto se compose quand même — un canvas
  // blanc (voir coverCropToBuffer), pour permettre un montage fait
  // seulement de calques (texte/image/forme).
  const frontFile = formData.get("image");
  const frontPdfPage = Math.max(1, Math.floor(Number(formData.get("pdfPage"))) || 1);
  const positionX = parsePositionValue(formData.get("positionX"));
  const positionY = parsePositionValue(formData.get("positionY"));
  const zoom = zoomValue(formData.get("zoom"));
  const imageRotation = rotationValue(formData.get("imageRotation"));

  const backFile = formData.get("backImage");
  const backPdfPage = Math.max(1, Math.floor(Number(formData.get("backPdfPage"))) || 1);
  const backPositionX = parsePositionValue(formData.get("backPositionX"));
  const backPositionY = parsePositionValue(formData.get("backPositionY"));
  const backZoom = zoomValue(formData.get("backZoom"));
  const backImageRotation = rotationValue(formData.get("backImageRotation"));
  const layers = await resolveLayersFromForm(formData, "front");
  const backLayers = await resolveLayersFromForm(formData, "back");

  const { data: rawTemplate, error: templateError } = await supabase
    .from("templates")
    .select("*")
    .eq("id", templateId)
    .single<Template>();
  if (templateError || !rawTemplate) return errorResponse("Modèle introuvable.", 404);
  const template = applyOrientation(rawTemplate, rotated);

  // Code SKU (s'il y en a un) préfixé au nom de fichier — c'est justement
  // l'info que l'étape Résumé affiche à côté du bouton de téléchargement,
  // donc le fichier téléchargé porte le même nom.
  let skuCode: string | null = null;
  if (rawTemplate.sku_id) {
    const { data: sku } = await supabase.from("skus").select("sku").eq("id", rawTemplate.sku_id).single<{ sku: string }>();
    skuCode = sku?.sku ?? null;
  }

  let frontBuffer: Buffer | null = null;
  if (frontFile instanceof File && frontFile.size > 0) {
    try {
      const front = await resolveProductImage(supabase, {
        templateId,
        file: frontFile,
        pdfPage: frontPdfPage,
        visualId: null,
        visualMode: null,
        tileSizeMm: null,
        rotated,
      });
      frontBuffer = front.buffer;
    } catch (err) {
      return errorResponse(err instanceof Error ? err.message : "Erreur lors du traitement du recto.");
    }
  }

  let backBuffer: Buffer | null = null;
  if (rawTemplate.two_sided) {
    if (backFile instanceof File && backFile.size > 0) {
      try {
        const back = await resolveProductImage(supabase, {
          templateId,
          file: backFile,
          pdfPage: backPdfPage,
          visualId: null,
          visualMode: null,
          tileSizeMm: null,
          rotated,
        });
        backBuffer = back.buffer;
      } catch (err) {
        return errorResponse(err instanceof Error ? err.message : "Erreur lors du traitement du verso.");
      }
    } else if (backLayers.length > 0) {
      // Pas de fichier pour le verso, mais des calques à y montrer : une
      // page quand même (blanche), sinon `generatePrintReadyPdf` n'ajoute de
      // deuxième page que si `backImage` est fourni (comportement partagé
      // avec les vrais Produits, à ne pas changer là-bas — voir
      // lib/pdf/productPdf.ts, où un verso "vide" ne doit toujours pas
      // ajouter de page).
      const pageWidthMm = template.width_mm + template.bleed_mm * 2;
      const pageHeightMm = template.height_mm + template.bleed_mm * 2;
      backBuffer = await coverCropToBuffer(null, mmToPx(pageWidthMm, template.dpi), mmToPx(pageHeightMm, template.dpi));
    }
  }

  let pdf: Buffer;
  try {
    pdf = await generatePrintReadyPdf({
      template,
      sourceImage: frontBuffer,
      logoImage: null,
      positionX,
      positionY,
      zoom,
      imageRotation,
      layers,
      backImage: backBuffer,
      backPositionX,
      backPositionY,
      backZoom,
      backImageRotation,
      backLayers,
      backLogoImage: null,
    });
  } catch (err) {
    return errorResponse(err instanceof Error ? err.message : "Erreur lors de la génération du PDF.");
  }

  const filename = pdfDownloadName(skuCode ? `${skuCode}-${template.name}` : template.name);
  return new NextResponse(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
