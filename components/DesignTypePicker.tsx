"use client";

import { useState } from "react";
import { ImageIcon, LayoutGridIcon, PaintbrushVerticalIcon } from "@/components/icons";
import type { ThemeWithOverlayUrl } from "@/components/ThemesTable";

// La disposition "masonry" (cases de tailles différentes) est reportée à
// plus tard — voir la conversation : pas encore de modèle de données pour
// des cases inégales, seulement des grilles uniformes cols×rows.
const GRID_PRESETS: { cols: number; rows: number }[] = [
  { cols: 1, rows: 2 },
  { cols: 1, rows: 3 },
  { cols: 2, rows: 1 },
  { cols: 3, rows: 1 },
  { cols: 2, rows: 2 },
];

type View = "root" | "grid" | "theme";

/**
 * Étape 3 de Design Shopify : choisir le type de design, entre « Modèle » et
 * « Design » — une seule image de fond (comportement d'origine), une
 * mosaïque de plusieurs photos distinctes assemblées en grille (voir
 * lib/pdf/mosaic.ts), ou un Thème — un visuel préfait attribué au modèle,
 * affiché par-dessus 1 à 3 photos du client (voir lib/pdf/theme.ts).
 *
 * L'option « Thème » n'apparaît que si le modèle en cours en a au moins un
 * (`themes`, déjà filtré par DesignTool) — un modèle sans thème ne montre
 * que les deux premières options, comme avant leur ajout.
 *
 * Clic sur « Une image » avance directement (comme CategoryPicker/
 * TemplatePicker) ; la mosaïque et le thème demandent un choix
 * supplémentaire (grille, ou lequel des thèmes) avant d'avancer.
 */
export default function DesignTypePicker({
  themes,
  onSelect,
  onBack,
}: {
  themes: ThemeWithOverlayUrl[];
  onSelect: (
    designType: "single" | "mosaic" | "theme",
    extra?: { grid?: { cols: number; rows: number }; theme?: ThemeWithOverlayUrl }
  ) => void;
  onBack: () => void;
}) {
  const [view, setView] = useState<View>("root");

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="font-heading text-xl font-semibold text-text">Type de design</h2>
        <button
          type="button"
          onClick={view === "root" ? onBack : () => setView("root")}
          className="rounded-lg border border-border px-4 py-2 text-sm text-text-muted hover:bg-surface-muted"
        >
          {view === "root" ? "Changer de modèle" : "Retour"}
        </button>
      </div>

      {view === "root" ? (
        <div className={`grid grid-cols-1 gap-4 ${themes.length > 0 ? "sm:grid-cols-3" : "sm:grid-cols-2"}`}>
          <button
            type="button"
            onClick={() => onSelect("single")}
            className="group flex flex-col items-start gap-2 rounded-2xl border border-border bg-surface p-6 text-left shadow-sm transition-all duration-200 ease-out hover:-translate-y-1 hover:border-transparent hover:shadow-lg"
          >
            <ImageIcon className="h-8 w-8 text-primary" />
            <span className="font-heading text-lg font-semibold text-text group-hover:text-primary">
              Une image
            </span>
            <span className="text-sm text-text-subtle">
              Un seul visuel de fond, que tu peux cadrer, zoomer et pivoter.
            </span>
          </button>
          <button
            type="button"
            onClick={() => setView("grid")}
            className="group flex flex-col items-start gap-2 rounded-2xl border border-border bg-surface p-6 text-left shadow-sm transition-all duration-200 ease-out hover:-translate-y-1 hover:border-transparent hover:shadow-lg"
          >
            <LayoutGridIcon className="h-8 w-8 text-primary" />
            <span className="font-heading text-lg font-semibold text-text group-hover:text-primary">
              Mosaïque de photos
            </span>
            <span className="text-sm text-text-subtle">
              Plusieurs photos assemblées côte à côte, en grille.
            </span>
          </button>
          {themes.length > 0 && (
            <button
              type="button"
              onClick={() => setView("theme")}
              className="group flex flex-col items-start gap-2 rounded-2xl border border-border bg-surface p-6 text-left shadow-sm transition-all duration-200 ease-out hover:-translate-y-1 hover:border-transparent hover:shadow-lg"
            >
              <PaintbrushVerticalIcon className="h-8 w-8 text-primary" />
              <span className="font-heading text-lg font-semibold text-text group-hover:text-primary">
                Thème
              </span>
              <span className="text-sm text-text-subtle">
                Un visuel préfait, avec tes photos placées dedans.
              </span>
            </button>
          )}
        </div>
      ) : view === "grid" ? (
        <div className="space-y-4">
          <p className="text-sm text-text-muted">Choisis la disposition de la grille.</p>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            {GRID_PRESETS.map(({ cols, rows }) => (
              <button
                key={`${cols}x${rows}`}
                type="button"
                onClick={() => onSelect("mosaic", { grid: { cols, rows } })}
                className="group flex flex-col items-center gap-3 rounded-2xl border border-border bg-surface p-5 shadow-sm transition-all duration-200 ease-out hover:-translate-y-1 hover:border-transparent hover:shadow-lg"
              >
                {/* Boîte extérieure de taille fixe, identique pour toutes
                    les cartes (même format) — mais chaque case à
                    l'intérieur a elle aussi une taille fixe (20px), la même
                    partout : c'est le nombre de cases qui varie d'une carte
                    à l'autre, jamais la taille d'une case. Un seul encadré
                    (bordure + fond) autour de TOUT le groupe d'icônes,
                    plutôt qu'un encadré par icône — pour montrer qu'elles
                    forment ensemble une seule mosaïque, pas des cases
                    indépendantes. */}
                <div className="flex h-24 w-24 shrink-0 items-center justify-center">
                  <div
                    className="grid gap-1 rounded-lg border border-border bg-surface-muted p-1.5 group-hover:border-primary"
                    style={{
                      gridTemplateColumns: `repeat(${cols}, 20px)`,
                      gridTemplateRows: `repeat(${rows}, 20px)`,
                    }}
                  >
                    {Array.from({ length: cols * rows }, (_, i) => (
                      <ImageIcon key={i} className="h-5 w-5 text-text-subtle group-hover:text-primary" />
                    ))}
                  </div>
                </div>
                <span className="text-sm font-medium text-text">
                  {cols}×{rows}
                </span>
              </button>
            ))}
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <p className="text-sm text-text-muted">Choisis un thème.</p>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            {themes.map((theme) => (
              <button
                key={theme.id}
                type="button"
                onClick={() => onSelect("theme", { theme })}
                className="group flex flex-col items-center gap-2 rounded-2xl border border-border bg-surface p-4 shadow-sm transition-all duration-200 ease-out hover:-translate-y-1 hover:border-transparent hover:shadow-lg"
              >
                <div className="flex h-24 w-24 items-center justify-center rounded-lg border border-border bg-surface-muted p-2">
                  {theme.overlayUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={theme.overlayUrl} alt="" className="max-h-full max-w-full object-contain" />
                  ) : (
                    <PaintbrushVerticalIcon className="h-8 w-8 text-text-subtle" />
                  )}
                </div>
                <span className="text-sm font-medium text-text">{theme.name}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
