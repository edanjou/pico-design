import { SpinnerIcon } from "@/components/icons";

// Écran d'attente de l'outil de design, le temps que le serveur prépare le
// modèle (thèmes, mockups, illustrations). Les couleurs suivent l'habillage
// « tool » posé par app/design/layout.tsx.
export default function Loading() {
  return (
    // Par-dessus toute la page, barre de navigation comprise : le client
    // venant d'une boutique ne voit que l'attente, puis l'outil.
    <div
      className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-4 bg-background px-4 text-center"
      role="status"
      aria-live="polite"
    >
      <SpinnerIcon className="h-10 w-10 text-primary" />
      <p className="text-sm font-medium text-text">Préparation de l&apos;outil de création…</p>
      <p className="text-xs text-text-subtle">Encore quelques secondes.</p>
    </div>
  );
}
