import type { Metadata } from "next";
import { apercu, gelica } from "@/lib/fonts";
import "./globals.css";
import AppShell from "@/components/AppShell";
import AppSettingsStyle from "@/components/AppSettingsStyle";

// Le favicon passe par les réglages (module Paramètres) : la route renvoie
// le fichier téléversé, ou le logo d'origine à défaut. D'où `icons` ici
// plutôt qu'un fichier app/icon.svg, que Next servirait en priorité.
export const metadata: Metadata = {
  icons: { icon: "/api/settings/admin/asset/favicon" },
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
        {/* Habillage de l'administration ; l'Outil Shopify pose le sien
            par-dessus dans app/design/layout.tsx. */}
        <AppSettingsStyle scope="admin" />
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
