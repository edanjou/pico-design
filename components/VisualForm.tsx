"use client";

import { useState } from "react";
import type { Visual } from "@/lib/types";

export default function VisualForm({
  visual,
  currentFileUrl,
  onSuccess,
}: {
  visual?: Visual;
  currentFileUrl?: string | null;
  onSuccess: () => void;
}) {
  const isEditing = Boolean(visual);
  const [name, setName] = useState(visual?.name ?? "");
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
      setError("Un fichier est requis.");
      return;
    }
    setLoading(true);
    setError(null);

    const formData = new FormData();
    formData.append("name", name);
    if (file) formData.append("file", file);

    const res = await fetch(isEditing ? `/api/visuals/${visual!.id}` : "/api/visuals", {
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

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-medium">Nom du visuel</label>
        <input
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Ex. Motif pois orange"
          className="mt-1 w-full rounded border border-neutral-300 px-3 py-2"
        />
      </div>

      <div>
        <label className="block text-sm font-medium">
          Fichier (SVG, PNG, JPG) {isEditing ? "(laisser vide pour garder l'actuel)" : ""}
        </label>
        <input
          type="file"
          accept="image/svg+xml,image/png,image/jpeg"
          onChange={handleFileChange}
          className="mt-1 w-full text-sm"
        />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {preview ? (
          <img src={preview} alt="Aperçu" className="mt-3 max-h-48 rounded border" />
        ) : currentFileUrl ? (
          <img src={currentFileUrl} alt="Fichier actuel" className="mt-3 max-h-48 rounded border" />
        ) : null}
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <button
        type="submit"
        disabled={loading}
        className="rounded-lg bg-pico-maroon px-4 py-2 text-white hover:bg-pico-maroon-dark disabled:opacity-50"
      >
        {loading ? "Enregistrement..." : isEditing ? "Enregistrer" : "Ajouter le visuel"}
      </button>
    </form>
  );
}
