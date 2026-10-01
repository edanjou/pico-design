import { NextResponse, type NextRequest } from "next/server";

/**
 * Content-Security-Policy, posée ici et non dans next.config.mjs parce
 * qu'elle contient un NONCE : une valeur tirée au hasard à chaque requête,
 * que seuls les scripts de la page portent. Un script injecté par un
 * attaquant ne peut pas la deviner, donc le navigateur refuse de l'exécuter.
 * Un en-tête statique ne peut pas faire ça.
 *
 * Pourquoi `'strict-dynamic'` : Next.js charge ses morceaux de code par des
 * balises <script> créées à l'exécution, qui ne peuvent pas porter le nonce.
 * Cette directive dit « ce qu'un script de confiance charge est de
 * confiance », ce qui les autorise sans rouvrir la porte à tout le reste.
 *
 * Pourquoi `'unsafe-inline'` sur les STYLES : l'éditeur positionne ses
 * calques par des attributs `style` calculés en continu, et un nonce ne
 * couvre pas les attributs de style. L'interdire casserait l'outil. Le
 * risque est sans commune mesure avec celui des scripts : au pire une page
 * déformée, pas du code exécuté.
 *
 * Ce qui reste strictement fermé : `object-src 'none'` (plus de plugins),
 * `base-uri 'self'` (on ne peut pas réécrire la base des URL relatives pour
 * détourner les scripts), `form-action 'self'` (un formulaire ne peut pas
 * être renvoyé vers un site tiers).
 */

// Le stockage et l'authentification Supabase, lus depuis la variable
// publique plutôt qu'écrits en dur : le domaine change avec le projet.
function supabaseOrigin(): string {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!url) return "";
  try {
    return new URL(url).origin;
  } catch {
    return "";
  }
}

export function middleware(request: NextRequest) {
  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");
  const supabase = supabaseOrigin();

  const csp = [
    `default-src 'self'`,
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'`,
    // Google Fonts sert la feuille de style depuis fonts.googleapis.com.
    `style-src 'self' 'unsafe-inline' https://fonts.googleapis.com`,
    // Les polices : les nôtres (/api/settings/…/asset/font-*) et celles de
    // Google, servies depuis un domaine distinct de la feuille.
    `font-src 'self' https://fonts.gstatic.com`,
    // `blob:` et `data:` sont indispensables : l'éditeur prévisualise les
    // fichiers déposés par des URL d'objet, sans jamais les envoyer.
    `img-src 'self' blob: data:${supabase ? ` ${supabase}` : ""}`,
    `connect-src 'self'${supabase ? ` ${supabase}` : ""}`,
    // Le PDF imposé est affiché dans une <iframe> par URL d'objet (blob:).
    // Sans cette ligne, frame-src retombe sur default-src 'self', qui
    // n'admet pas blob:, et l'aperçu reste vide.
    `frame-src 'self' blob:`,
    `object-src 'none'`,
    `base-uri 'self'`,
    `form-action 'self'`,
    `frame-ancestors 'self'`,
    `upgrade-insecure-requests`,
  ].join("; ");

  // Next.js lit ce nonce dans l'en-tête de la REQUÊTE pour en marquer les
  // scripts qu'il émet lui-même — d'où ces deux endroits plutôt qu'un seul.
  const headers = new Headers(request.headers);
  headers.set("x-nonce", nonce);
  headers.set("content-security-policy", csp);

  const response = NextResponse.next({ request: { headers } });
  response.headers.set("content-security-policy", csp);
  return response;
}

export const config = {
  matcher: [
    // Tout sauf les ressources statiques déjà servies par Vercel : le nonce
    // n'a aucun sens pour elles, et les faire passer ici coûterait une
    // exécution par fichier.
    {
      source: "/((?!_next/static|_next/image|favicon.ico).*)",
      missing: [
        { type: "header", key: "next-router-prefetch" },
        { type: "header", key: "purpose", value: "prefetch" },
      ],
    },
  ],
};
