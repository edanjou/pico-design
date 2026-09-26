"use client";

import { usePathname } from "next/navigation";
import Nav from "@/components/Nav";
import { ChromeVisibilityProvider, useChromeHidden } from "@/components/ChromeVisibility";

// Cadre commun des pages (barre de navigation + halo + colonne centrée). La
// page de connexion occupe tout l'écran sans ce chrome. L'Outil Shopify
// (/design), lui, le garde comme les autres modules SAUF pendant l'édition
// plein écran — voir ChromeVisibility.tsx/useHideChrome, appelé depuis
// DesignTool.tsx (l'écran « Choisir un modèle », avant l'éditeur, n'a pas
// besoin de masquer le chrome).
function AppShellContent({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const chromeHidden = useChromeHidden();
  const showChrome = pathname !== "/login" && !chromeHidden;

  // `{children}` (donc la page, ex. DesignTool) reste TOUJOURS à la même
  // place dans l'arbre — seuls Nav et les classes du conteneur autour
  // apparaissent/disparaissent. Si `{children}` changeait de parent selon
  // `showChrome` (ex. wrappé ici, direct enfant du Fragment là), React
  // démonterait puis remonterait toute la page à chaque bascule (position
  // différente dans l'arbre = nouvelle identité) — perdant l'état interne de
  // DesignTool (dont `phase`) pile au moment où l'Outil Shopify entre dans
  // l'éditeur (ce qui déclenche justement cette bascule, via useHideChrome).
  return (
    <>
      {showChrome && <Nav />}
      <div className={showChrome ? "page-glow" : undefined}>
        <main className={showChrome ? "mx-auto max-w-6xl px-4 py-8 sm:px-6" : undefined}>{children}</main>
      </div>
    </>
  );
}

export default function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <ChromeVisibilityProvider>
      <AppShellContent>{children}</AppShellContent>
    </ChromeVisibilityProvider>
  );
}
