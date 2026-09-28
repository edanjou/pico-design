import { NextResponse } from "next/server";
import { createAdminSupabaseClient, createServerSupabaseClient } from "@/lib/supabase/server";
import { grantAllows } from "@/lib/publicDesign";
import { renderPdfFromForm } from "@/lib/design/renderPdf";

export const runtime = "nodejs"; // sharp/pdf-lib ont besoin du runtime Node, pas Edge.
export const maxDuration = 60;

function errorResponse(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

/**
 * Design Shopify (étape Résumé) : le PDF prêt-pour-impression final — pas un
 * aperçu (voir /api/products/preview, capé à 900 px) : pleine résolution,
 * fond perdu compris, recto + verso dans un seul fichier, exactement comme
 * pour un vrai Produit (lib/pdf/productPdf.ts). Contrairement au vrai
 * Produit, jamais de logo Pico ici, même si le modèle a
 * `logo_on_front`/`logo_on_back`.
 *
 * Le rendu lui-même vit dans lib/design/renderPdf.ts : le module Commande le
 * rejoue à l'identique depuis un design enregistré, et deux implémentations
 * finiraient par diverger.
 */
export async function POST(request: Request) {
  const supabase = createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const formData = await request.formData();
  const templateId = formData.get("templateId");
  if (typeof templateId !== "string") return errorResponse("Paramètre manquant (templateId).");
  // Voir /api/design/mockup : lien public accepté, mais seulement pour le
  // modèle que le laissez-passer désigne.
  if (!user && !grantAllows(formData.get("grant"), templateId)) {
    return errorResponse("Non authentifié.", 401);
  }
  const db = user ? supabase : createAdminSupabaseClient();

  try {
    const { pdf, filename } = await renderPdfFromForm(db, formData, templateId);
    return new NextResponse(new Uint8Array(pdf), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch (err) {
    return errorResponse(err instanceof Error ? err.message : "Erreur lors de la génération du PDF.");
  }
}
