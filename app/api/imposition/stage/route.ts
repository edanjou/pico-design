import { randomUUID } from "crypto";
import { NextResponse } from "next/server";
import { createAdminSupabaseClient, createServerSupabaseClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

/**
 * Adresse d'envoi à usage unique pour déposer un PDF à imposer DIRECTEMENT
 * dans le stockage, depuis le navigateur. La plateforme (Vercel) refuse toute
 * requête de plus de 4,5 Mo avant même d'atteindre la route : un document de
 * plusieurs pages ne pouvait pas passer. Le navigateur envoie le fichier au
 * stockage, puis seulement son chemin à l'aperçu ou à l'enregistrement.
 *
 * Le dépôt se fait sous staging/<utilisateur>/ ; l'enregistrement d'une
 * imposition le range ensuite avec elle et retire la copie de dépôt.
 */
export async function POST() {
  const supabase = createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Non authentifié." }, { status: 401 });

  const path = `staging/${user.id}/${randomUUID()}.pdf`;
  const { data, error } = await createAdminSupabaseClient().storage.from("imposition").createSignedUploadUrl(path);
  if (error || !data) {
    return NextResponse.json({ error: error?.message ?? "Préparation de l'envoi impossible." }, { status: 500 });
  }
  return NextResponse.json({ path, token: data.token });
}
