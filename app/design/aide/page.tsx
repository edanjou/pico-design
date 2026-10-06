import type { Metadata } from "next";
import DesignHelpContent from "@/components/DesignHelpContent";
import { HelpCircleIcon } from "@/components/icons";

// Aide de l'Outil Shopify en page publique (/design/aide) : le client n'a pas
// de compte, et AppShell n'affiche pas ici le cadre de l'administration. Le
// contenu est celui de la fenêtre « Aide ? » de l'éditeur (DesignHelpContent).

export const metadata: Metadata = {
  title: "Aide — Outil de personnalisation",
  description: "Comment créer ton design, l'ajuster et l'ajouter au panier.",
};

export default function DesignHelpPage() {
  return (
    <main className="min-h-dvh bg-background px-4 py-10 sm:px-6">
      <div className="mx-auto max-w-2xl space-y-6">
        <header className="space-y-2">
          <p className="flex items-center gap-2 text-sm font-medium text-primary">
            <HelpCircleIcon className="h-4 w-4" />
            Aide
          </p>
          <h1 className="font-display text-3xl text-text sm:text-4xl">Créer ton design, pas à pas</h1>
        </header>
        <DesignHelpContent />
      </div>
    </main>
  );
}
