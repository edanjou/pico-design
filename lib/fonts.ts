import localFont from "next/font/local";

// Polices de PICO OS (Apercu / Gelica), déposées dans public/fonts —
// remplacent DM Sans / Gelasio pour aligner l'identité visuelle sur celle
// de la plateforme sœur.
export const apercu = localFont({
  src: [
    { path: "../public/fonts/apercu-light.otf", weight: "300", style: "normal" },
    { path: "../public/fonts/apercu-light-italic.otf", weight: "300", style: "italic" },
    { path: "../public/fonts/apercu-regular.otf", weight: "400", style: "normal" },
    { path: "../public/fonts/apercu-italic.otf", weight: "400", style: "italic" },
    { path: "../public/fonts/apercu-medium.otf", weight: "500", style: "normal" },
    { path: "../public/fonts/apercu-medium-italic.otf", weight: "500", style: "italic" },
    { path: "../public/fonts/apercu-bold.otf", weight: "700", style: "normal" },
    { path: "../public/fonts/apercu-bold-italic.otf", weight: "700", style: "italic" },
  ],
  variable: "--font-body",
  display: "swap",
});

export const gelica = localFont({
  src: [{ path: "../public/fonts/gelica-semibold.otf", weight: "600", style: "normal" }],
  variable: "--font-heading",
  display: "swap",
});
