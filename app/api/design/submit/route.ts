import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { createAdminSupabaseClient, createServerSupabaseClient } from "@/lib/supabase/server";
import { grantAllows } from "@/lib/publicDesign";
import { splitFormData } from "@/lib/design/submission";

export const runtime = "nodejs";
export const maxDuration = 60;

function errorResponse(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

/**
 * Enregistre le design d'un client avant qu'il retourne payer sur Shopify
 * (module Commande, voir supabase/migrations/0055_orders.sql).
 *
 * Reçoit exactement le FormData que l'outil compose déjà pour le PDF : les
 * champs partent en base, les fichiers dans le bucket. Le PDF, lui, n'est PAS
 * fabriqué ici — il le sera à la demande depuis le module, et la plupart des
 * designs enregistrés ne seront jamais payés (paniers abandonnés).
 *
 * Même garde que le reste du parcours public : un laissez-passer valable pour
 * ce modèle précis (voir lib/publicDesign.ts).
 */
export async function POST(request: Request) {
  const supabase = createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const formData = await request.formData();
  const templateId = formData.get("templateId");
  if (typeof templateId !== "string") return errorResponse("Paramètre manquant (templateId).");
  if (!user && !grantAllows(formData.get("grant"), templateId)) {
    return errorResponse("Non authentifié.", 401);
  }

  // Écriture par la clé de service : le client public n'a pas de session, et
  // la RLS de design_submissions n'ouvre rien à l'anonyme.
  const admin = createAdminSupabaseClient();
  const id = randomUUID();
  const { fields, files } = splitFormData(formData);

  const sourcePaths: { field: string; path: string; name: string; type: string }[] = [];
  for (const [index, entry] of files.entries()) {
    const extension = entry.file.name.split(".").pop()?.toLowerCase() ?? "bin";
    const path = `submissions/${id}/${index}-${entry.field}.${extension}`;
    const { error } = await admin.storage
      .from("uploads")
      .upload(path, Buffer.from(await entry.file.arrayBuffer()), {
        contentType: entry.file.type || "application/octet-stream",
        upsert: true,
      });
    if (error) return errorResponse(`Impossible d'enregistrer le fichier : ${error.message}`, 500);
    sourcePaths.push({ field: entry.field, path, name: entry.file.name, type: entry.file.type });
  }

  const quantityRaw = Number(formData.get("quantity"));
  const variantId = formData.get("variantId");

  const { data, error } = await admin
    .from("design_submissions")
    .insert({
      id,
      template_id: templateId,
      rotated: formData.get("rotated") === "true",
      payload: fields,
      source_paths: sourcePaths,
      shopify_variant_id: typeof variantId === "string" && variantId ? variantId : null,
      quantity: Number.isFinite(quantityRaw) && quantityRaw > 0 ? Math.floor(quantityRaw) : 1,
    })
    .select()
    .single();

  if (error) return errorResponse(error.message, 500);
  return NextResponse.json({ id: (data as { id: string }).id });
}
