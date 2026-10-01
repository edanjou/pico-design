/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverComponentsExternalPackages: [
      "sharp",
      "pdf-lib",
      "pdf-to-png-converter",
      "pdfjs-dist",
      "@napi-rs/canvas",
    ],
    // pdf.js charge @napi-rs/canvas par un require dynamique (pour disposer de
    // DOMMatrix et Path2D hors navigateur) que le traçage de fichiers de Vercel
    // ne voit pas : sans cette liste, la fonction déployée n'embarque ni le
    // module ni son binaire natif Linux, et rasteriser un PDF échoue avec
    // « DOMMatrix is not defined ».
    //
    // Même piège pour son worker : hors navigateur, pdf.js retombe sur un
    // « fake worker » qu'il charge par un import dynamique de
    // pdf.worker.mjs — invisible au traçage lui aussi. Sans lui, rasteriser
    // un PDF échoue en production (et seulement là) avec « Setting up fake
    // worker failed: Cannot find module .../pdf.worker.mjs ».
    outputFileTracingIncludes: {
      "/api/**/*": [
        "./node_modules/@napi-rs/canvas/**/*",
        "./node_modules/@napi-rs/canvas-linux-x64-gnu/**/*",
        "./node_modules/pdfjs-dist/legacy/build/pdf.worker.mjs",
      ],
    },
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "nexhrabvgsplczdbiklk.supabase.co",
        pathname: "/storage/v1/object/**",
      },
    ],
  },

  // En-têtes de sécurité. Vercel ne posait que HSTS ; rien n'empêchait
  // d'afficher l'outil dans une iframe sur un site tiers, ce qui permet de
  // faire cliquer un utilisateur connecté sur des commandes qu'il ne voit
  // pas (détournement de clic).
  //
  // La Content-Security-Policy n'est PLUS ici : elle porte un nonce tiré à
  // chaque requête, ce qu'un en-tête statique ne peut pas faire. Elle vit
  // dans middleware.ts, et `frame-ancestors` y a été reprise — deux en-têtes
  // CSP s'additionnent, et en laisser une ici rendrait la règle réelle
  // impossible à lire.
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          // Doublon assumé de `frame-ancestors` (voir middleware.ts), pour
          // les navigateurs trop anciens pour la connaître.
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          // Empêche un navigateur de « deviner » un type différent de celui
          // annoncé — ce qui transformerait un fichier déposé en page HTML.
          { key: "X-Content-Type-Options", value: "nosniff" },
          // Une URL de l'outil porte le jeton du lien public : elle ne doit
          // pas partir en Referer vers un autre domaine.
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
        ],
      },
    ];
  },
};

export default nextConfig;
