"use client";

import { useEffect } from "react";
import { SpinnerIcon } from "@/components/icons";

export default function Modal({
  title,
  onClose,
  children,
  wide,
  busy,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  wide?: boolean;
  // Affiche un voile "Enregistrement en cours..." par-dessus la modale et
  // bloque sa fermeture (Échap, clic sur le fond, bouton "X") — évite qu'un
  // envoi un peu long (traitement d'image, génération de PDF...) donne
  // l'impression que l'app a planté, et qu'une fermeture accidentelle
  // pendant l'envoi laisse l'utilisateur dans le doute sur le résultat.
  busy?: boolean;
}) {
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape" && !busy) onClose();
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onClose, busy]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={() => !busy && onClose()} />
      <div
        className={`relative max-h-[90vh] w-full overflow-y-auto rounded-2xl bg-white p-6 shadow-xl ${
          wide ? "max-w-4xl" : "max-w-lg"
        }`}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-heading text-lg font-semibold text-pico-black">{title}</h2>
          <button
            onClick={onClose}
            disabled={busy}
            aria-label="Fermer"
            className="rounded-lg p-1.5 text-neutral-400 hover:bg-neutral-100 hover:text-pico-black disabled:opacity-30 disabled:hover:bg-transparent"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className="h-5 w-5">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        </div>
        {children}

        {busy && (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 rounded-2xl bg-white/85 backdrop-blur-[1px]">
            <SpinnerIcon className="h-6 w-6 text-pico-maroon" />
            <p className="text-sm font-medium text-neutral-600">Enregistrement en cours...</p>
          </div>
        )}
      </div>
    </div>
  );
}
