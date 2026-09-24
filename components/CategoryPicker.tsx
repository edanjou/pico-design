"use client";

import type { Category, Template } from "@/lib/types";

/**
 * Étape 1 de Design Shopify : choisir la catégorie de modèle (Étuis de
 * téléphone, Papeterie, ...). Catégories triées comme partout ailleurs
 * (sort_order) ; celles sans aucun modèle ne sont pas proposées. Cliquer
 * une carte sélectionne et avance directement à l'étape 2.
 */
export default function CategoryPicker({
  categories,
  templates,
  onSelect,
}: {
  categories: Category[];
  templates: Template[];
  onSelect: (category: Category) => void;
}) {
  const withCounts = categories
    .map((category) => ({ category, count: templates.filter((t) => t.category_id === category.id).length }))
    .filter((c) => c.count > 0);

  if (withCounts.length === 0) {
    return (
      <p className="rounded-2xl border border-border bg-surface p-6 text-center text-sm text-text-muted">
        Aucun modèle disponible pour l&apos;instant.
      </p>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
      {withCounts.map(({ category, count }) => (
        <button
          key={category.id}
          type="button"
          onClick={() => onSelect(category)}
          className="group flex flex-col items-start gap-1 rounded-2xl border border-border bg-surface p-5 text-left shadow-sm transition-all duration-200 ease-out hover:-translate-y-1 hover:border-transparent hover:shadow-lg"
        >
          <span className="font-heading text-lg font-semibold text-text group-hover:text-primary">
            {category.name}
          </span>
          <span className="text-sm text-text-subtle">
            {count} modèle{count > 1 ? "s" : ""}
          </span>
        </button>
      ))}
    </div>
  );
}
