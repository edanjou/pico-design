"use client";

import { useState } from "react";
import type { Sku } from "@/lib/types";
import { SpinnerIcon } from "@/components/icons";

export default function SkuForm({
  sku,
  groupLabels,
  onSuccess,
}: {
  sku?: Sku;
  groupLabels: string[];
  onSuccess: () => void;
}) {
  const isEditing = Boolean(sku);
  const [form, setForm] = useState({
    sku: sku?.sku ?? "",
    name: sku?.name ?? "",
    group_label: sku?.group_label ?? groupLabels[0] ?? "",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const res = await fetch(isEditing ? `/api/skus/${sku!.id}` : "/api/skus", {
      method: isEditing ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
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
        <label className="block text-sm font-medium">SKU</label>
        <input
          required
          value={form.sku}
          onChange={(e) => setForm((f) => ({ ...f, sku: e.target.value }))}
          placeholder="Ex. imp-4x6-1side"
          className="mt-1 w-full rounded border border-neutral-300 px-3 py-2 font-mono text-sm"
        />
      </div>
      <div>
        <label className="block text-sm font-medium">Nom / descriptif</label>
        <input
          required
          value={form.name}
          onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
          placeholder="Ex. Papeterie - 4 x 6 pouces / 1 côté"
          className="mt-1 w-full rounded border border-neutral-300 px-3 py-2"
        />
      </div>
      <div>
        <label className="block text-sm font-medium">Groupe</label>
        <input
          required
          list="sku-group-labels"
          value={form.group_label}
          onChange={(e) => setForm((f) => ({ ...f, group_label: e.target.value }))}
          placeholder="Ex. Tasses + Tumblers"
          className="mt-1 w-full rounded border border-neutral-300 px-3 py-2"
        />
        <datalist id="sku-group-labels">
          {groupLabels.map((g) => (
            <option key={g} value={g} />
          ))}
        </datalist>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <button
        type="submit"
        disabled={loading}
        className="flex w-full items-center justify-center gap-2 rounded-lg bg-pico-maroon px-4 py-2 text-sm font-medium text-white hover:bg-pico-maroon-dark disabled:opacity-50"
      >
        {loading && <SpinnerIcon className="h-4 w-4" />}
        {isEditing ? "Enregistrer" : "Créer le SKU"}
      </button>
    </form>
  );
}
