"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import TemplateRow from "@/components/TemplateRow";
import TemplateForm from "@/components/TemplateForm";
import CategoriesManager from "@/components/CategoriesManager";
import Modal from "@/components/Modal";
import type { Category, Template } from "@/lib/types";

function SortIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className="h-3.5 w-3.5">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 9l4-5 4 5M8 15l4 5 4-5" />
    </svg>
  );
}

type ModalState = { mode: "create" } | { mode: "edit"; template: Template } | { mode: "categories" } | null;

export default function TemplatesTable({
  templates,
  categories,
}: {
  templates: Template[];
  categories: Category[];
}) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [modal, setModal] = useState<ModalState>(null);

  const categoryName = useMemo(() => {
    const map = new Map(categories.map((c) => [c.id, c.name]));
    return (id: string) => map.get(id) ?? "—";
  }, [categories]);

  const filtered = useMemo(() => {
    return templates
      .filter((t) => (categoryId ? t.category_id === categoryId : true))
      .filter((t) => t.name.toLowerCase().includes(search.trim().toLowerCase()))
      .sort((a, b) => (sortDir === "asc" ? a.name.localeCompare(b.name) : b.name.localeCompare(a.name)));
  }, [templates, search, categoryId, sortDir]);

  function handleSuccess() {
    setModal(null);
    router.refresh();
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-pico-black">Modèles</h1>
          <p className="text-sm text-neutral-500">
            {templates.length} modèle{templates.length > 1 ? "s" : ""} au catalogue.
          </p>
        </div>
        <button
          onClick={() => setModal({ mode: "create" })}
          className="flex items-center gap-2 rounded-lg bg-pico-maroon px-4 py-2 text-sm font-medium text-white hover:bg-pico-maroon-dark"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className="h-4 w-4">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v14m-7-7h14" />
          </svg>
          Nouveau modèle
        </button>
      </div>

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
        <div className="flex items-end gap-3">
          <div>
            <label className="block text-xs font-medium text-neutral-500">Catégorie</label>
            <select
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
              className="mt-1 rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm"
            >
              <option value="">— Toutes —</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          <button
            type="button"
            onClick={() => setModal({ mode: "categories" })}
            className="rounded-lg border border-neutral-300 px-3 py-2 text-sm text-neutral-600 hover:bg-neutral-50"
          >
            Gérer les catégories
          </button>
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
                <th className="p-4"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((t) => (
                <TemplateRow
                  key={t.id}
                  template={t}
                  categoryName={categoryName(t.category_id)}
                  onEdit={(tpl) => setModal({ mode: "edit", template: tpl })}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}

      {modal?.mode === "categories" && (
        <Modal title="Gérer les catégories" onClose={() => setModal(null)}>
          <CategoriesManager
            categories={categories}
            onChanged={() => {
              router.refresh();
            }}
          />
        </Modal>
      )}

      {(modal?.mode === "create" || modal?.mode === "edit") && (
        <Modal
          title={modal.mode === "create" ? "Nouveau modèle" : `Modifier « ${modal.template.name} »`}
          onClose={() => setModal(null)}
        >
          <TemplateForm
            template={modal.mode === "edit" ? modal.template : undefined}
            categories={categories}
            onSuccess={handleSuccess}
          />
        </Modal>
      )}
    </div>
  );
}
