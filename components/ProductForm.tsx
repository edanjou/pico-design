"use client";

import { useState } from "react";
import type { Category, Product, Template, VisualMode } from "@/lib/types";
import type { VisualWithUrl } from "@/components/VisualsGrid";
import { formatIn, inToMm, mmToIn } from "@/lib/pdf/units";

type SourceMode = "upload" | VisualMode;

const SOURCE_MODES: { value: SourceMode; label: string }[] = [
  { value: "upload", label: "Uploader une image" },
  { value: "full", label: "Visuel — plein format" },
  { value: "tile", label: "Visuel — mosaïque" },
];

export default function ProductForm({
  templates,
  categories,
  visuals,
  product,
  currentImageUrl,
  onSuccess,
}: {
  templates: Template[];
  categories: Category[];
  visuals: VisualWithUrl[];
  product?: Product;
  currentImageUrl?: string | null;
  onSuccess: () => void;
}) {
  const isEditing = Boolean(product);
  const [name, setName] = useState(product?.name ?? "");
  const [templateId, setTemplateId] = useState(product?.template_id ?? templates[0]?.id ?? "");
  const [sourceMode, setSourceMode] = useState<SourceMode>(product?.visual_mode ?? "upload");
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [visualId, setVisualId] = useState(product?.visual_id ?? visuals[0]?.id ?? "");
  const [tileSizeMm, setTileSizeMm] = useState(product?.tile_size_mm ?? inToMm(1));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0] ?? null;
    setFile(f);
    setPreview(f ? URL.createObjectURL(f) : null);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!isEditing && sourceMode === "upload" && !file) {
      setError("Une image est requise.");
      return;
    }
    if (sourceMode !== "upload" && !visualId) {
      setError("Choisis un visuel dans la banque.");
      return;
    }
    setLoading(true);
    setError(null);

    const formData = new FormData();
    formData.append("name", name);
    formData.append("templateId", templateId);
    if (sourceMode === "upload") {
      if (file) formData.append("image", file);
    } else {
      formData.append("visualId", visualId);
      formData.append("visualMode", sourceMode);
      if (sourceMode === "tile") formData.append("tileSizeMm", String(tileSizeMm));
    }

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

  const selectedVisual = visuals.find((v) => v.id === visualId) ?? null;

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
                    {t.name} — {formatIn(t.width_mm)}×{formatIn(t.height_mm)}
                  </option>
                ))}
              </optgroup>
            );
          })}
        </select>
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium">Source de l&apos;image</label>
        <div className="flex rounded-lg border border-neutral-300 p-0.5 text-sm">
          {SOURCE_MODES.map((m) => (
            <button
              key={m.value}
              type="button"
              onClick={() => setSourceMode(m.value)}
              className={`flex-1 rounded-md px-2 py-1.5 ${
                sourceMode === m.value
                  ? "bg-pico-black text-white"
                  : "text-neutral-600 hover:bg-neutral-100"
              }`}
            >
              {m.label}
            </button>
          ))}
        </div>
      </div>

      {sourceMode === "upload" ? (
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
      ) : visuals.length === 0 ? (
        <p className="rounded border border-amber-300 bg-amber-50 p-4 text-sm text-amber-800">
          Aucun visuel dans la banque. Ajoutes-en d&apos;abord dans{" "}
          <a href="/visuals" className="underline">
            Banque de visuels
          </a>
          .
        </p>
      ) : (
        <div className="space-y-3">
          <div>
            <label className="block text-sm font-medium">Visuel</label>
            <select
              value={visualId}
              onChange={(e) => setVisualId(e.target.value)}
              className="mt-1 w-full rounded border border-neutral-300 px-3 py-2"
            >
              {visuals.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.name}
                </option>
              ))}
            </select>
          </div>

          {sourceMode === "tile" && (
            <div>
              <label className="block text-sm font-medium">Taille de répétition (po)</label>
              <input
                type="number"
                step="0.01"
                min="0.01"
                value={Math.round(mmToIn(tileSizeMm) * 100) / 100}
                onChange={(e) => setTileSizeMm(inToMm(parseFloat(e.target.value) || 0.01))}
                className="mt-1 w-full rounded border border-neutral-300 px-3 py-2"
              />
            </div>
          )}

          {selectedVisual?.fileUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={selectedVisual.fileUrl}
              alt={selectedVisual.name}
              className="max-h-48 rounded border bg-neutral-50 object-contain p-2"
            />
          )}
        </div>
      )}

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
