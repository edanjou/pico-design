import type { Metadata } from "next";
import { DM_Sans, Gelasio } from "next/font/google";
import "./globals.css";
import Nav from "@/components/Nav";

const dmSans = DM_Sans({ subsets: ["latin"], variable: "--font-body", display: "swap" });
const gelasio = Gelasio({
  subsets: ["latin"],
  weight: ["400", "700"],
  variable: "--font-heading",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Pico Design",
  description: "Génération de PDF prêts pour impression pour les produits Pico",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr" className={`${dmSans.variable} ${gelasio.variable}`}>
      <body>
        <Nav />
        <main className="mx-auto max-w-4xl px-4 py-8">{children}</main>
      </body>
    </html>
  );
}
