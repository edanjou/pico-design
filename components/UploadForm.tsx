"use client";

import { useState } from "react";
import type { Template } from "@/lib/types";

export default function UploadForm({ templates }: { templates: Template[] }) {
  const [templateId, setTemplateId] = useState(templates[0]?.id ?? "");
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0] ?? null;
    setFile(f);
    setDownloadUrl(null);
    setError(null);
    setPreview(f ? URL.createObjectURL(f) : null);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!file || !templateId) return;

    setLoading(true);
    setError(null);
    setDownloadUrl(null);

    const formData = new FormData();
    formData.append("templateId", templateId);
    formData.append("image", file);

    try {
      const res = await fetch("/api/generate", { method: "POST", body: formData });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Erreur lors de la génération.");
      setDownloadUrl(data.downloadUrl);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur inconnue.");
    } finally {
      setLoading(false);
    }
  }

  if (templates.length === 0) {
    return (
      <p className="rounded border border-amber-300 bg-amber-50 p-4 text-sm text-amber-800">
        Aucun modèle configuré. Crée d'abord un modèle dans{" "}
        <a href="/templates" className="underline">
          Modèles
        </a>
        .
      </p>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div>
        <label className="block text-sm font-medium">Modèle de produit</label>
        <select
          value={templateId}
          onChange={(e) => setTemplateId(e.target.value)}
          className="mt-1 w-full rounded border border-neutral-300 px-3 py-2"
        >
          {templates.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name} — {t.width_mm}×{t.height_mm}mm ({t.dpi} dpi)
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium">Image source</label>
        <input
          type="file"
          accept="image/*"
          required
          onChange={handleFileChange}
          className="mt-1 w-full text-sm"
        />
        {preview && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={preview} alt="Aperçu" className="mt-3 max-h-64 rounded border" />
        )}
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <button
        type="submit"
        disabled={loading || !file}
        className="rounded bg-pico-700 px-4 py-2 text-white hover:bg-pico-600 disabled:opacity-50"
      >
        {loading ? "Génération en cours..." : "Générer le PDF"}
      </button>

      {downloadUrl && (
        <div className="rounded border border-green-300 bg-green-50 p-4">
          <p className="mb-2 text-sm text-green-800">PDF généré avec succès.</p>
          <a
            href={downloadUrl}
            target="_blank"
            rel="noreferrer"
            className="text-sm font-medium text-pico-700 underline"
          >
            Télécharger le PDF prêt pour impression
          </a>
        </div>
      )}
    </form>
  );
}
