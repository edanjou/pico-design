import { NextResponse } from "next/server";
import { createAdminSupabaseClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

/**
 * Aperçu d'un design enregistré, pour le panier Shopify : la boutique
 * l'affiche avec une simple balise <img> (voir le bloc Liquid du panier), à
 * partir de la propriété cachée `_design` de l'article.
 *
 * Public, sans session ni laissez-passer : le panier n'en a pas. Ce n'est
 * qu'une image réduite (800 px, voir app/api/design/submit) de ce que le
 * client a lui-même composé, et l'identifiant est un UUID aléatoire qu'on ne
 * devine pas. Rien d'autre du design (fichiers source, PDF) n'est servi ici.
 */
export async function GET(_request: Request, { params }: { params: { id: string } }) {
  if (!/^[0-9a-f-]{36}$/i.test(params.id)) return new NextResponse(null, { status: 404 });

  const admin = createAdminSupabaseClient();
  const { data } = await admin
    .from("design_submissions")
    .select("mockup_path")
    .eq("id", params.id)
    .maybeSingle<{ mockup_path: string | null }>();
  if (!data?.mockup_path) return new NextResponse(null, { status: 404 });

  const { data: file } = await admin.storage.from("uploads").download(data.mockup_path);
  if (!file) return new NextResponse(null, { status: 404 });

  return new NextResponse(new Uint8Array(await file.arrayBuffer()), {
    headers: {
      "Content-Type": "image/webp",
      // Un design enregistré ne change plus : le navigateur et le CDN peuvent le garder.
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
}
