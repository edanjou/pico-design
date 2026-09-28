import { NextResponse } from "next/server";
import { createAdminSupabaseClient, createServerSupabaseClient } from "@/lib/supabase/server";
import { formDataFromSubmission, type DesignSubmission } from "@/lib/design/submission";
import { renderPdfFromForm } from "@/lib/design/renderPdf";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * Fabrique le PDF d'impression d'un design enregistré, à la demande depuis le
 * module Commande. Rien n'est stocké : la plupart des designs enregistrés ne
 * sont jamais payés, et un correctif de rendu profite ainsi aux commandes
 * déjà passées.
 *
 * Le FormData d'origine est reconstitué puis passé au MÊME chemin de rendu
 * que le téléchargement direct (renderPdfFromForm) : le fichier obtenu ici
 * est celui que le client a vu à l'écran.
 *
 * Réservé aux utilisateurs connectés — c'est un écran interne.
 */
export async function GET(_request: Request, { params }: { params: { id: string } }) {
  const supabase = createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Non authentifié." }, { status: 401 });

  const { data } = await supabase.from("design_submissions").select("*").eq("id", params.id).maybeSingle();
  if (!data) return NextResponse.json({ error: "Design introuvable." }, { status: 404 });
  const submission = data as DesignSubmission;

  // Client admin pour relire les fichiers du bucket, comme le parcours
  // public : les fichiers d'un client anonyme n'appartiennent à personne.
  const admin = createAdminSupabaseClient();
  try {
    const formData = await formDataFromSubmission(admin, submission);
    const { pdf, filename } = await renderPdfFromForm(admin, formData, submission.template_id);
    return new NextResponse(new Uint8Array(pdf), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Erreur lors de la génération du PDF." },
      { status: 500 }
    );
  }
}
