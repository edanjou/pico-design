"use client";

import { useState } from "react";
import { FilePenIcon, SpinnerIcon, TrashIcon } from "@/components/icons";

interface SimpleCollection {
  id: string;
  name: string;
}

export default function CollectionsManager({
  collections,
  apiBasePath,
  onChanged,
}: {
  collections: SimpleCollection[];
  apiBasePath: string;
  onChanged: () => void;
}) {
  const [newName, setNewName] = useState("");
  const [creating, setCreating] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!newName.trim()) return;
    setCreating(true);
    setError(null);
    const res = await fetch(`${apiBasePath}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newName.trim() }),
    });
    const data = await res.json();
    setCreating(false);
    if (!res.ok) {
      setError(data.error ?? "Erreur lors de la création.");
      return;
    }
    setNewName("");
    onChanged();
  }

  function startEdit(collection: SimpleCollection) {
    setEditingId(collection.id);
    setEditingName(collection.name);
    setError(null);
  }

  async function saveEdit(id: string) {
    if (!editingName.trim()) return;
    setBusyId(id);
    setError(null);
    const res = await fetch(`${apiBasePath}/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: editingName.trim() }),
    });
    const data = await res.json();
    setBusyId(null);
    if (!res.ok) {
      setError(data.error ?? "Erreur lors de l'enregistrement.");
      return;
    }
    setEditingId(null);
    onChanged();
  }

  async function handleDelete(collection: SimpleCollection) {
    if (
      !confirm(
        `Supprimer la collection « ${collection.name} » ? Son contenu ne sera pas supprimé.`
      )
    )
      return;
    setBusyId(collection.id);
    setError(null);
    const res = await fetch(`${apiBasePath}/${collection.id}`, { method: "DELETE" });
    const data = await res.json().catch(() => ({}));
    setBusyId(null);
    if (!res.ok) {
      setError(data.error ?? "Erreur lors de la suppression.");
      return;
    }
    onChanged();
  }

  return (
    <div className="space-y-4">
      <ul className="divide-y divide-neutral-100 rounded-lg border border-neutral-200">
        {collections.map((c) => (
          <li key={c.id} className="flex items-center justify-between gap-2 p-3">
            {editingId === c.id ? (
              <input
                autoFocus
                value={editingName}
                onChange={(e) => setEditingName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") saveEdit(c.id);
                  if (e.key === "Escape") setEditingId(null);
                }}
                className="flex-1 rounded border border-neutral-300 px-2 py-1 text-sm"
              />
            ) : (
              <span className="text-sm text-pico-black">{c.name}</span>
            )}
            <div className="flex shrink-0 gap-1">
              {editingId === c.id ? (
                <button
                  onClick={() => saveEdit(c.id)}
                  disabled={busyId === c.id}
                  title="Enregistrer"
                  aria-label="Enregistrer"
                  className="inline-flex rounded-lg p-1.5 text-neutral-500 hover:bg-neutral-100 hover:text-pico-black disabled:opacity-50"
                >
                  {busyId === c.id ? (
                    <SpinnerIcon className="h-4 w-4" />
                  ) : (
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className="h-4 w-4">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                </button>
              ) : (
                <button
                  onClick={() => startEdit(c)}
                  title="Modifier"
                  aria-label="Modifier"
                  className="inline-flex rounded-lg p-1.5 text-neutral-500 hover:bg-neutral-100 hover:text-pico-black"
                >
                  <FilePenIcon className="h-4 w-4" />
                </button>
              )}
              <button
                onClick={() => handleDelete(c)}
                disabled={busyId === c.id}
                title="Supprimer"
                aria-label="Supprimer"
                className="inline-flex rounded-lg p-1.5 text-neutral-500 hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
              >
                {busyId === c.id ? <SpinnerIcon className="h-4 w-4" /> : <TrashIcon className="h-4 w-4" />}
              </button>
            </div>
          </li>
        ))}
        {collections.length === 0 && (
          <li className="p-3 text-sm text-neutral-500">Aucune collection pour l&apos;instant.</li>
        )}
      </ul>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <form onSubmit={handleCreate} className="flex gap-2">
        <input
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          placeholder="Nouvelle collection..."
          className="flex-1 rounded border border-neutral-300 px-3 py-2 text-sm"
        />
        <button
          type="submit"
          disabled={creating || !newName.trim()}
          className="inline-flex items-center gap-2 rounded-lg bg-pico-maroon px-4 py-2 text-sm font-medium text-white hover:bg-pico-maroon-dark disabled:opacity-50"
        >
          {creating && <SpinnerIcon className="h-4 w-4" />}
          Ajouter
        </button>
      </form>
    </div>
  );
}
