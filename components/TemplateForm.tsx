"use client";

import { useState } from "react";
import type { LogoPosition, Template, TemplateCategory } from "@/lib/types";
import { TEMPLATE_CATEGORY_LABELS } from "@/lib/types";
import { inToMm, mmToIn } from "@/lib/pdf/units";

type Unit = "mm" | "in";

const LOGO_POSITIONS: LogoPosition[] = [
  "top-left",
  "top-right",
  "bottom-left",
  "bottom-right",
  "center",
];

const CATEGORIES = Object.keys(TEMPLATE_CATEGORY_LABELS) as TemplateCategory[];

export default function TemplateForm({
  template,
  onSuccess,
}: {
  template?: Template;
  onSuccess: () => void;
}) {
  const isEditing = Boolean(template);
  const [form, setForm] = useState({
    name: template?.name ?? "",
    category: template?.category ?? ("autre" as TemplateCategory),
    width_mm: template?.width_mm ?? 90,
    height_mm: template?.height_mm ?? 50,
    bleed_mm: template?.bleed_mm ?? 3,
    dpi: template?.dpi ?? 300,
    logo_position: template?.logo_position ?? ("bottom-right" as LogoPosition),
    logo_width_mm: template?.logo_width_mm ?? 20,
    logo_margin_mm: template?.logo_margin_mm ?? 5,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [unit, setUnit] = useState<Unit>("mm");

  function update<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  // Les dimensions sont toujours stockées en mm ; ces helpers ne font que
  // convertir l'affichage/la saisie selon l'unité choisie.
  function toDisplay(mm: number): number {
    if (unit === "mm") return mm;
    return Math.round(mmToIn(mm) * 1000) / 1000;
  }

  function updateFromDisplay(key: "width_mm" | "height_mm" | "bleed_mm" | "logo_width_mm" | "logo_margin_mm", value: number) {
    update(key, unit === "mm" ? value : inToMm(value));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const res = await fetch(
      isEditing ? `/api/templates/${template!.id}` : "/api/templates",
      {
        method: isEditing ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      }
    );
    const data = await res.json();

    setLoading(false);
    if (!res.ok) {
      setError(data.error ?? "Erreur lors de l'enregistrement.");
      return;
    }
    onSuccess();
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-medium">Nom du produit</label>
        <input
          required
          value={form.name}
          onChange={(e) => update("name", e.target.value)}
          placeholder="Ex. Cartes d'affaires 90×50mm"
          className="mt-1 w-full rounded border border-neutral-300 px-3 py-2"
        />
      </div>

      <div>
        <label className="block text-sm font-medium">Catégorie</label>
        <select
          value={form.category}
          onChange={(e) => update("category", e.target.value as TemplateCategory)}
          className="mt-1 w-full rounded border border-neutral-300 px-3 py-2"
        >
          {CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {TEMPLATE_CATEGORY_LABELS[c]}
            </option>
          ))}
        </select>
      </div>

      <div>
        <div className="mb-2 flex items-center justify-between">
          <label className="block text-sm font-medium">Dimensions</label>
          <div className="flex rounded-lg border border-neutral-300 p-0.5 text-xs">
            {(["mm", "in"] as Unit[]).map((u) => (
              <button
                key={u}
                type="button"
                onClick={() => setUnit(u)}
                className={`rounded-md px-2 py-1 ${
                  unit === u ? "bg-pico-black text-white" : "text-neutral-600 hover:bg-neutral-100"
                }`}
              >
                {u === "mm" ? "mm" : "po"}
              </button>
            ))}
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium">Largeur ({unit === "mm" ? "mm" : "po"})</label>
            <input
              type="number"
              step={unit === "mm" ? "0.1" : "0.01"}
              value={toDisplay(form.width_mm)}
              onChange={(e) => updateFromDisplay("width_mm", parseFloat(e.target.value) || 0)}
              className="mt-1 w-full rounded border border-neutral-300 px-3 py-2"
            />
          </div>
          <div>
            <label className="block text-sm font-medium">Hauteur ({unit === "mm" ? "mm" : "po"})</label>
            <input
              type="number"
              step={unit === "mm" ? "0.1" : "0.01"}
              value={toDisplay(form.height_mm)}
              onChange={(e) => updateFromDisplay("height_mm", parseFloat(e.target.value) || 0)}
              className="mt-1 w-full rounded border border-neutral-300 px-3 py-2"
            />
          </div>
          <div>
            <label className="block text-sm font-medium">
              Fond perdu / bleed ({unit === "mm" ? "mm" : "po"})
            </label>
            <input
              type="number"
              step={unit === "mm" ? "0.1" : "0.01"}
              value={toDisplay(form.bleed_mm)}
              onChange={(e) => updateFromDisplay("bleed_mm", parseFloat(e.target.value) || 0)}
              className="mt-1 w-full rounded border border-neutral-300 px-3 py-2"
            />
          </div>
          <div>
            <label className="block text-sm font-medium">Résolution (dpi)</label>
            <input
              type="number"
              value={form.dpi}
              onChange={(e) => update("dpi", parseInt(e.target.value, 10))}
              className="mt-1 w-full rounded border border-neutral-300 px-3 py-2"
            />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div>
          <label className="block text-sm font-medium">Position du logo</label>
          <select
            value={form.logo_position}
            onChange={(e) => update("logo_position", e.target.value as LogoPosition)}
            className="mt-1 w-full rounded border border-neutral-300 px-3 py-2"
          >
            {LOGO_POSITIONS.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium">Largeur logo ({unit === "mm" ? "mm" : "po"})</label>
          <input
            type="number"
            step={unit === "mm" ? "0.1" : "0.01"}
            value={toDisplay(form.logo_width_mm)}
            onChange={(e) => updateFromDisplay("logo_width_mm", parseFloat(e.target.value) || 0)}
            className="mt-1 w-full rounded border border-neutral-300 px-3 py-2"
          />
        </div>
        <div>
          <label className="block text-sm font-medium">Marge logo ({unit === "mm" ? "mm" : "po"})</label>
          <input
            type="number"
            step={unit === "mm" ? "0.1" : "0.01"}
            value={toDisplay(form.logo_margin_mm)}
            onChange={(e) => updateFromDisplay("logo_margin_mm", parseFloat(e.target.value) || 0)}
            className="mt-1 w-full rounded border border-neutral-300 px-3 py-2"
          />
        </div>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <button
        type="submit"
        disabled={loading}
        className="rounded-lg bg-pico-maroon px-4 py-2 text-white hover:bg-pico-maroon-dark disabled:opacity-50"
      >
        {loading ? "Enregistrement..." : isEditing ? "Enregistrer" : "Créer le modèle"}
      </button>
    </form>
  );
}
