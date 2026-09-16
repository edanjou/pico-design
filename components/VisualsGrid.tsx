"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import VisualForm from "@/components/VisualForm";
import Modal from "@/components/Modal";
import { FilePenIcon, TrashIcon } from "@/components/icons";
import type { Visual } from "@/lib/types";

export type VisualWithUrl = Visual & { fileUrl: string | null };

type ModalState = { mode: "create" } | { mode: "edit"; visual: VisualWithUrl } | null;

export default function VisualsGrid({ visuals }: { visuals: VisualWithUrl[] }) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [modal, setModal] = useState<ModalState>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const filtered = useMemo(
    () => visuals.filter((v) => v.name.toLowerCase().includes(search.trim().toLowerCase())),
    [visuals, search]
  );

  function handleSuccess() {
    setModal(null);
    router.refresh();
  }

  async function handleDelete(visual: VisualWithUrl) {
    if (!confirm(`Supprimer le visuel « ${visual.name} » ?`)) return;
    setDeletingId(visual.id);
    const res = await fetch(`/api/visuals/${visual.id}`, { method: "DELETE" });
    setDeletingId(null);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      alert(data.error ?? "Erreur lors de la suppression.");
      return;
    }
    router.refresh();
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-pico-black">Banque de visuels</h1>
          <p className="text-sm text-neutral-500">
            {visuals.length} visuel{visuals.length > 1 ? "s" : ""} disponible
            {visuals.length > 1 ? "s" : ""}.
          </p>
        </div>
        <button
          onClick={() => setModal({ mode: "create" })}
          className="flex items-center gap-2 rounded-lg bg-pico-maroon px-4 py-2 text-sm font-medium text-white hover:bg-pico-maroon-dark"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className="h-4 w-4">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v14m-7-7h14" />
          </svg>
          Nouveau visuel
        </button>
      </div>

      <div className="relative mb-4 max-w-xs">
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

      {filtered.length === 0 ? (
        <p className="rounded-xl border border-neutral-200 bg-white p-4 text-sm text-neutral-500">
          Aucun visuel ne correspond.
        </p>
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {filtered.map((v) => (
            <div
              key={v.id}
              className="overflow-hidden rounded-xl border border-neutral-200 bg-white shadow-sm"
            >
              <div className="flex h-32 items-center justify-center bg-neutral-50 p-3">
                {v.fileUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={v.fileUrl} alt={v.name} className="max-h-full max-w-full object-contain" />
                ) : (
                  <div className="h-full w-full rounded bg-neutral-100" />
                )}
              </div>
              <div className="flex items-center justify-between gap-2 p-3">
                <span className="truncate text-sm font-medium text-pico-black">{v.name}</span>
                <div className="flex shrink-0 gap-1">
                  <button
                    onClick={() => setModal({ mode: "edit", visual: v })}
                    title="Modifier"
                    aria-label="Modifier"
                    className="inline-flex rounded-lg p-1.5 text-neutral-500 hover:bg-neutral-100 hover:text-pico-black"
                  >
                    <FilePenIcon className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => handleDelete(v)}
                    disabled={deletingId === v.id}
                    title="Supprimer"
                    aria-label="Supprimer"
                    className="inline-flex rounded-lg p-1.5 text-neutral-500 hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
                  >
                    <TrashIcon className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {modal && (
        <Modal
          title={modal.mode === "create" ? "Nouveau visuel" : `Modifier « ${modal.visual.name} »`}
          onClose={() => setModal(null)}
        >
          <VisualForm
            visual={modal.mode === "edit" ? modal.visual : undefined}
            currentFileUrl={modal.mode === "edit" ? modal.visual.fileUrl : null}
            onSuccess={handleSuccess}
          />
        </Modal>
      )}
    </div>
  );
}
