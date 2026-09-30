import { NextResponse } from "next/server";
import { readFile } from "fs/promises";
import path from "path";
import { createAdminSupabaseClient, createServerSupabaseClient } from "@/lib/supabase/server";
import {
  ASSET_SLOTS,
  isSettingsScope,
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
export async function GET(_request: Request, { params }: { params: { scope: string; slot: string } }) {
  const scope = params.scope as SettingsScope;
  const slot = params.slot as AssetSlot;
  if (!isSettingsScope(scope) || !ASSET_SLOTS.includes(slot)) {
    return NextResponse.json({ error: "Ressource inconnue." }, { status: 404 });
  }

  // Lecture avec la session de l'utilisateur : les réglages ne sont pas
  // secrets, mais la table est en RLS « authenticated ». Le favicon, lui, est
  // demandé par le navigateur sans session — d'où le repli silencieux sur les
  // valeurs par défaut (voir loadAppSettings).
  const settings = await loadAppSettings(createServerSupabaseClient(), scope);
  const storagePath = assetPathFor(settings, slot);

  if (storagePath) {
    const admin = createAdminSupabaseClient();
    const { data } = await admin.storage.from("assets").download(storagePath);
    if (data) {
      const buffer = Buffer.from(await data.arrayBuffer());
      return new NextResponse(new Uint8Array(buffer), {
        headers: {
          "Content-Type": contentTypeOf(storagePath),
          "Cache-Control": "public, max-age=31536000, immutable",
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
