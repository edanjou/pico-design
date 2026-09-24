"use client";

import { formatIn } from "@/lib/pdf/units";
import type { Category, Template } from "@/lib/types";

/**
 * Étape 2 de Design Shopify : choisir le modèle, dans la catégorie choisie à
 * l'étape 1. Grille de cartes, comme l'étape 1. Cliquer une carte sélectionne
 * et avance directement à l'étape 3.
 */
export default function TemplatePicker({
  templates,
  category,
  onSelect,
  onBack,
}: {
  templates: Template[];
  category: Category;
  onSelect: (template: Template) => void;
  onBack: () => void;
}) {
  const items = templates.filter((t) => t.category_id === category.id);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="font-heading text-xl font-semibold text-text">{category.name}</h2>
        <button
          type="button"
          onClick={onBack}
          className="rounded-lg border border-border px-4 py-2 text-sm text-text-muted hover:bg-surface-muted"
        >
          Changer de catégorie
        </button>
      </div>

      {items.length === 0 ? (
        <p className="rounded-2xl border border-border bg-surface p-6 text-center text-sm text-text-muted">
          Aucun modèle dans cette catégorie pour l&apos;instant.
        </p>
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {items.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => onSelect(t)}
              className="group flex flex-col items-start gap-1 rounded-2xl border border-border bg-surface p-4 text-left shadow-sm transition-all duration-200 ease-out hover:-translate-y-1 hover:border-transparent hover:shadow-lg"
            >
              <span className="font-heading text-base font-semibold text-text group-hover:text-primary">
                {t.name}
              </span>
              <span className="text-sm text-text-subtle">
                {formatIn(t.width_mm)}×{formatIn(t.height_mm)}
              </span>
              {t.two_sided && (
                <span className="mt-1 inline-flex items-center rounded-full bg-primary-subtle px-2 py-0.5 text-xs font-medium text-primary">
                  Recto-verso
                </span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
