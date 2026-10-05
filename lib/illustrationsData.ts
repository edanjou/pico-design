// Chargement de la banque d'illustrations avec leurs adresses signées (le
// bucket est privé). Partagé par le module Illustrations et l'Outil Shopify,
// qui l'appelle aussi en mode public, avec le client administrateur.

import type { createServerSupabaseClient } from "@/lib/supabase/server";
import { ILLUSTRATIONS_BUCKET } from "@/lib/illustrations";
import type { Illustration, IllustrationWithUrl } from "@/lib/types";

type Client = ReturnType<typeof createServerSupabaseClient>;

// Durée de validité des adresses : celle d'une session de design ordinaire,
// comme les visuels et les thèmes (voir app/design/page.tsx).
const SIGNED_URL_SECONDS = 60 * 60;

export async function loadIllustrations(client: Client): Promise<IllustrationWithUrl[]> {
  const { data } = await client.from("illustrations").select("*").order("name", { ascending: true });
  const rows = (data as Illustration[]) ?? [];
  if (rows.length === 0) return [];
  // Une seule requête pour toutes les adresses, plutôt qu'une par illustration.
  const { data: signed } = await client.storage
    .from(ILLUSTRATIONS_BUCKET)
    .createSignedUrls(
      rows.map((r) => r.file_path),
      SIGNED_URL_SECONDS
    );
  const urlByPath = new Map((signed ?? []).map((s) => [s.path, s.signedUrl]));
  return rows.map((r) => ({ ...r, fileUrl: urlByPath.get(r.file_path) ?? null }));
}
