import { NextResponse } from "next/server";
import { readFile } from "fs/promises";
import path from "path";
import { createAdminSupabaseClient, createServerSupabaseClient } from "@/lib/supabase/server";
import {
  ASSET_SLOTS,
  isSettingsScope,
  isShopScope,
  assetPathFor,
  loadAppSettings,
  type AssetSlot,
  type SettingsScope,
} from "@/lib/appSettings";

export const runtime = "nodejs";

// Repli quand rien n'est configuré : les fichiers historiques, pour que
// l'outil ne se retrouve jamais sans logo ni favicon.
const FALLBACKS: Partial<Record<AssetSlot, { file: string; type: string }>> = {
  logo: { file: "pico-noir.svg", type: "image/svg+xml" },
  favicon: { file: "pico-noir.svg", type: "image/svg+xml" },
};

const CONTENT_TYPES: Record<string, string> = {
  svg: "image/svg+xml",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  webp: "image/webp",
  ico: "image/x-icon",
  woff2: "font/woff2",
  woff: "font/woff",
  otf: "font/otf",
  ttf: "font/ttf",
};

function contentTypeOf(storagePath: string): string {
  const ext = storagePath.split(".").pop()?.toLowerCase() ?? "";
  return CONTENT_TYPES[ext] ?? "application/octet-stream";
}

/**
 * Sert un fichier d'identité visuelle (logo, favicon, image de partage,
 * polices d'interface). Les buckets du projet sont tous PRIVÉS : rien ne peut
 * être référencé par une URL publique, d'où cette route qui lit le fichier
 * avec le client admin et le renvoie elle-même.
 *
 * Le cache est long : l'URL porte un `?v=` tiré de `updated_at` (voir
 * assetUrl), donc elle change dès qu'un réglage change.
 */
export async function GET(request: Request, { params }: { params: { scope: string; slot: string } }) {
  const scope = params.scope as SettingsScope;
  const slot = params.slot as AssetSlot;
  if (!isSettingsScope(scope) || !ASSET_SLOTS.includes(slot)) {
    return NextResponse.json({ error: "Ressource inconnue." }, { status: 404 });
  }

  // Lecture par la clé de service quand il n'y a pas de session : la RLS de
  // app_settings n'ouvre rien à l'anonyme, et un visiteur public du lien
  // Shopify n'aurait donc JAMAIS le logo ni le favicon réglés — pas même
  // ceux du jeu par défaut. Or c'est précisément lui que ces réglages
  // habillent. Ce ne sont ni l'un ni l'autre des secrets : ils sont visibles
  // de quiconque ouvre la page (même raisonnement que AppSettingsStyle).
  const session = createServerSupabaseClient();
  const {
    data: { user },
  } = await session.auth.getUser();
  const client = user ? session : createAdminSupabaseClient();

  // Une boutique hérite du jeu « tool » pour ce qu'elle n'a pas défini —
  // comme les couleurs, qui l'obtiennent par la cascade CSS. Un fichier n'a
  // pas de cascade : l'URL désigne UN jeu, d'où ce repli explicite, sans
  // lequel une boutique sans logo propre sauterait directement au fichier
  // d'origine en ignorant celui de l'Outil Shopify.
  const chain: SettingsScope[] = isShopScope(scope) ? [scope, "tool"] : [scope];
  let storagePath: string | null = null;
  for (const candidate of chain) {
    const settings = await loadAppSettings(client, candidate);
    storagePath = assetPathFor(settings, slot);
    if (storagePath) break;
  }

  // Cache long seulement si l'URL porte le `?v=` d'assetUrl : elle change
  // alors à chaque enregistrement. Sans lui (le logo de la barre de
  // navigation, qui ne connaît pas `updated_at`), un cache immuable ferait
  // resservir l'ancien fichier pendant un an après un remplacement.
  const versioned = new URL(request.url).searchParams.has("v");
  const cache = versioned
    ? "public, max-age=31536000, immutable"
    : "public, max-age=60, must-revalidate";

  if (storagePath) {
    const admin = createAdminSupabaseClient();
    const { data } = await admin.storage.from("assets").download(storagePath);
    if (data) {
      const buffer = Buffer.from(await data.arrayBuffer());
      return new NextResponse(new Uint8Array(buffer), {
        headers: {
          "Content-Type": contentTypeOf(storagePath),
          "Cache-Control": cache,
        },
      });
    }
  }

  const fallback = FALLBACKS[slot];
  if (!fallback) return new NextResponse(null, { status: 404 });
  try {
    const buffer = await readFile(path.join(process.cwd(), "public", fallback.file));
    return new NextResponse(new Uint8Array(buffer), {
      headers: { "Content-Type": fallback.type, "Cache-Control": "public, max-age=3600" },
    });
  } catch {
    return new NextResponse(null, { status: 404 });
  }
}
