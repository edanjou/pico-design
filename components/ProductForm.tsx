"use client";

import { useState } from "react";
import type { Category, Product, Template } from "@/lib/types";

export default function ProductForm({
  templates,
  categories,
  product,
  currentImageUrl,
  onSuccess,
}: {
  templates: Template[];
  categories: Category[];
  product?: Product;
  currentImageUrl?: string | null;
  onSuccess: () => void;
}) {
  const isEditing = Boolean(product);
  const [name, setName] = useState(product?.name ?? "");
  const [templateId, setTemplateId] = useState(product?.template_id ?? templates[0]?.id ?? "");
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0] ?? null;
    setFile(f);
    setPreview(f ? URL.createObjectURL(f) : null);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!isEditing && !file) {
      setError("Une image est requise.");
      return;
    }
    setLoading(true);
    setError(null);

    const formData = new FormData();
    formData.append("name", name);
    formData.append("templateId", templateId);
    if (file) formData.append("image", file);

    const res = await fetch(isEditing ? `/api/products/${product!.id}` : "/api/products", {
      method: isEditing ? "PATCH" : "POST",
      body: formData,
    });
    const data = await res.json();

    setLoading(false);
    if (!res.ok) {
      setError(data.error ?? "Erreur lors de l'enregistrement.");
      return;
    }
    onSuccess();
  }

  if (templates.length === 0) {
    return (
      <p className="rounded border border-amber-300 bg-amber-50 p-4 text-sm text-amber-800">
        Aucun modèle configuré. Crée d&apos;abord un modèle dans{" "}
        <a href="/templates" className="underline">
          Modèles
        </a>
        .
      </p>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-medium">Nom du produit</label>
        <input
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Ex. Étui iPhone 15 — motif floral"
          className="mt-1 w-full rounded border border-neutral-300 px-3 py-2"
        />
      </div>

      <div>
        <label className="block text-sm font-medium">Modèle</label>
        <select
          value={templateId}
          onChange={(e) => setTemplateId(e.target.value)}
          className="mt-1 w-full rounded border border-neutral-300 px-3 py-2"
        >
          {categories.map((category) => {
            const items = templates.filter((t) => t.category_id === category.id);
            if (items.length === 0) return null;
            return (
              <optgroup key={category.id} label={category.name}>
                {items.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name} — {t.width_mm}×{t.height_mm}mm
                  </option>
                ))}
              </optgroup>
            );
          })}
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium">
          Image {isEditing ? "(laisser vide pour garder l'actuelle)" : ""}
        </label>
        <input
          type="file"
          accept="image/*"
          onChange={handleFileChange}
          className="mt-1 w-full text-sm"
        />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {preview ? (
          <img src={preview} alt="Aperçu" className="mt-3 max-h-64 rounded border" />
        ) : currentImageUrl ? (
          <img src={currentImageUrl} alt="Image actuelle" className="mt-3 max-h-64 rounded border" />
        ) : null}
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <button
        type="submit"
        disabled={loading}
        className="rounded-lg bg-pico-maroon px-4 py-2 text-white hover:bg-pico-maroon-dark disabled:opacity-50"
      >
        {loading ? "Enregistrement..." : isEditing ? "Enregistrer" : "Créer le produit"}
      </button>
    </form>
  );
}
