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
