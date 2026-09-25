import type { Metadata } from "next";
import { apercu, gelica } from "@/lib/fonts";
import "./globals.css";
import AppShell from "@/components/AppShell";

export const metadata: Metadata = {
  // Nécessaire pour que l'image de partage (app/opengraph-image.tsx) soit
  // résolue en URL absolue dans les balises og:image/twitter:image — sans
  // ça, la plupart des plateformes (Slack, iMessage...) n'affichent rien.
  metadataBase: new URL("https://pico-design.vercel.app"),
  title: "Pico Design",
  description: "Génération de PDF prêts pour impression pour les produits Pico",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr" className={`${apercu.variable} ${gelica.variable}`}>
      <body>
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
