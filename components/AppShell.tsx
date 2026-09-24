"use client";

import { usePathname } from "next/navigation";
import Nav from "@/components/Nav";

// Cadre commun des pages (barre de navigation + halo + colonne centrée). La
// page de connexion et l'outil Design Shopify, eux, occupent tout l'écran
// sans le chrome admin — Design Shopify gère son propre en-tête de marque
// (voir DesignTool.tsx), pensé comme une page cliente plutôt qu'un écran
// d'administration.
export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  if (pathname === "/login" || pathname.startsWith("/design")) return <>{children}</>;

  return (
    <>
      <Nav />
      <div className="page-glow">
        <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6">{children}</main>
      </div>
    </>
  );
}
