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
};

export default nextConfig;
