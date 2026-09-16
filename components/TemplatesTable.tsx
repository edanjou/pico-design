"use client";

import { useMemo, useState } from "react";
import TemplateRow from "@/components/TemplateRow";
import { TEMPLATE_CATEGORY_LABELS, type Template, type TemplateCategory } from "@/lib/types";

const CATEGORY_ORDER = Object.keys(TEMPLATE_CATEGORY_LABELS) as TemplateCategory[];

function SortIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className="h-3.5 w-3.5">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 9l4-5 4 5M8 15l4 5 4-5" />
    </svg>
  );
}

export default function TemplatesTable({ templates }: { templates: Template[] }) {
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<TemplateCategory | "">("");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

  const filtered = useMemo(() => {
    return templates
      .filter((t) => (category ? t.category === category : true))
      .filter((t) => t.name.toLowerCase().includes(search.trim().toLowerCase()))
      .sort((a, b) => (sortDir === "asc" ? a.name.localeCompare(b.name) : b.name.localeCompare(a.name)));
  }, [templates, search, category, sortDir]);

  return (
    <div>
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="relative flex-1 sm:max-w-xs">
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M21 21l-4.35-4.35M19 11a8 8 0 1 1-16 0 8 8 0 0 1 16 0Z"
            />
          </svg>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher (nom)..."
            className="w-full rounded-lg border border-neutral-300 bg-white py-2 pl-9 pr-3 text-sm"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-neutral-500">Catégorie</label>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value as TemplateCategory | "")}
            className="mt-1 rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm"
          >
            <option value="">— Toutes —</option>
            {CATEGORY_ORDER.map((c) => (
              <option key={c} value={c}>
                {TEMPLATE_CATEGORY_LABELS[c]}
              </option>
            ))}
          </select>
        </div>
      </div>

      {filtered.length === 0 ? (
        <p className="rounded-xl border border-neutral-200 bg-white p-4 text-sm text-neutral-500">
          Aucun modèle ne correspond.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-neutral-200 bg-white shadow-sm">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-sm font-semibold text-neutral-700">
                <th className="p-4">
                  <button
                    type="button"
                    onClick={() => setSortDir((d) => (d === "asc" ? "desc" : "asc"))}
                    className="flex items-center gap-1 hover:text-pico-black"
                  >
                    Nom <SortIcon />
                  </button>
                </th>
                <th className="p-4">Catégorie</th>
                <th className="p-4">Dimensions</th>
                <th className="p-4">Fond perdu</th>
                <th className="p-4">Résolution</th>
                <th className="p-4">Logo</th>
                <th className="p-4"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((t) => (
                <TemplateRow key={t.id} template={t} />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
