import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { MAX_BARCODE_BYTES, MAX_JOB_NO, barcodePath } from "@/lib/imposition/barcodes";
import { detectMarksKind } from "@/lib/imposition/marks";

export const runtime = "nodejs";
export const maxDuration = 60;

// Importe un lot de codes-barres : `files` et `numbers` sont deux listes de même
// longueur (le PDF et le numéro de job auquel il correspond). Un code-barres
// déjà importé pour ce numéro est remplacé.
export async function POST(request: Request) {
  const supabase = createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Non authentifié." }, { status: 401 });

  const formData = await request.formData();
  const files = formData.getAll("files");
  const numbers = formData.getAll("numbers").map((n) => Number(n));
  if (files.length === 0 || files.length !== numbers.length) {
    return NextResponse.json({ error: "Liste de fichiers invalide." }, { status: 400 });
  }

  let count = 0;
  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    const jobNo = numbers[i];
    if (!(file instanceof File) || !Number.isInteger(jobNo) || jobNo < 1 || jobNo > MAX_JOB_NO) {
      return NextResponse.json({ error: "Fichier ou numéro de job invalide." }, { status: 400 });
    }
    const label = file.name;
    if (file.size === 0 || file.size > MAX_BARCODE_BYTES) {
      return NextResponse.json({ error: `« ${label} » est vide ou trop volumineux (2 Mo au plus).` }, { status: 400 });
    }
    const bytes = new Uint8Array(await file.arrayBuffer());
    if (detectMarksKind(bytes) !== "pdf") {
      return NextResponse.json({ error: `« ${label} » n'est pas un PDF.` }, { status: 400 });
    }
    const { error } = await supabase.storage
      .from("imposition")
      .upload(barcodePath(jobNo), bytes, { contentType: "application/pdf", upsert: true });
    if (error) return NextResponse.json({ error: `« ${label} » : ${error.message}` }, { status: 500 });
    count++;
  }
  return NextResponse.json({ count });
}
