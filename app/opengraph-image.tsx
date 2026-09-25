import { ImageResponse } from "next/og";
import { readFile } from "node:fs/promises";
import path from "node:path";

// Image affichée quand le lien du site est partagé (Slack, iMessage,
// Twitter/X, aperçu de lien en général) — convention App Router : Next.js
// génère automatiquement les balises og:image/twitter:image correspondantes
// pour tout le site (voir metadata dans app/layout.tsx, qui n'a pas besoin
// de les déclarer lui-même).
export const runtime = "nodejs"; // lecture de fichiers locaux (logo, police).

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function OpengraphImage() {
  const [logoSvg, gelica] = await Promise.all([
    readFile(path.join(process.cwd(), "public/pico-noir.svg"), "utf8"),
    readFile(path.join(process.cwd(), "public/fonts/gelica-semibold.otf")),
  ]);
  const logoDataUri = `data:image/svg+xml;base64,${Buffer.from(logoSvg).toString("base64")}`;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: "#f8f1e9",
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={logoDataUri} width={340} height={168} alt="" />
        <div
          style={{
            marginTop: 28,
            fontFamily: "Gelica",
            fontSize: 64,
            fontWeight: 600,
            color: "#631028",
          }}
        >
          Design
        </div>
        <div
          style={{
            marginTop: 18,
            fontFamily: "Gelica",
            fontSize: 26,
            color: "#7a6a5f",
          }}
        >
          Génération de PDF prêts pour impression
        </div>
      </div>
    ),
    {
      ...size,
      fonts: [{ name: "Gelica", data: gelica, weight: 600, style: "normal" }],
    }
  );
}
