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
  // Pas de Content-Security-Policy complète ici : l'app charge des polices
  // Google, des URL signées Supabase et injecte un <style> pour l'habillage
  // (voir AppSettingsStyle). Une CSP écrite sans éprouver chaque page
  // casserait la production plus sûrement qu'elle ne protégerait. Seule
  // `frame-ancestors` est posée, qui ne restreint rien d'autre.
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          // Les deux disent la même chose : frame-ancestors pour les
          // navigateurs modernes, X-Frame-Options pour les plus anciens.
          { key: "Content-Security-Policy", value: "frame-ancestors 'self'" },
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
