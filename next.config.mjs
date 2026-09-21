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
    outputFileTracingIncludes: {
      "/api/**/*": [
        "./node_modules/@napi-rs/canvas/**/*",
        "./node_modules/@napi-rs/canvas-linux-x64-gnu/**/*",
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
