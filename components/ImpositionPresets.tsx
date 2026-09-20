"use client";

import { useState } from "react";
import MeasureField, { UnitToggle, type Unit } from "@/components/MeasureField";
import CutterSettingsFields, { cutterSettingsOf, type CutterSettings } from "@/components/CutterSettingsFields";
import { SpinnerIcon, TrashIcon, FilePenIcon } from "@/components/icons";
import { sheetLabel } from "@/lib/imposition/presets";
import type { ImpositionCutter, ImpositionSheet } from "@/lib/types";

const inputClass = "mt-1 w-full rounded border border-neutral-300 px-3 py-2 text-sm";

function mmLabel(mm: number): string {
  return `${Math.round(mm * 100) / 100} mm`;
}

function RowActions({ onEdit, onDelete, busy }: { onEdit: () => void; onDelete: () => void; busy: boolean }) {
  return (
    <div className="flex shrink-0 items-center gap-1">
      <button
        type="button"
        onClick={onEdit}
        aria-label="Modifier"
        className="rounded-lg p-1.5 text-neutral-400 hover:bg-neutral-100 hover:text-pico-black"
      >
        <FilePenIcon className="h-4 w-4" />
      </button>
      <button
        type="button"
        onClick={onDelete}
        disabled={busy}
        aria-label="Supprimer"
        className="rounded-lg p-1.5 text-neutral-400 hover:bg-red-50 hover:text-red-600 disabled:opacity-40"
      >
        {busy ? <SpinnerIcon className="h-4 w-4" /> : <TrashIcon className="h-4 w-4" />}
      </button>
    </div>
  );
}

function SubmitButton({ loading, children }: { loading: boolean; children: React.ReactNode }) {
  return (
    <button
      type="submit"
      disabled={loading}
      className="flex w-full items-center justify-center gap-2 rounded-lg bg-pico-maroon px-4 py-2 text-sm font-medium text-white hover:bg-pico-maroon-dark disabled:opacity-50"
    >
      {loading && <SpinnerIcon className="h-4 w-4" />}
      {children}
    </button>
  );
}

// ---------------------------------------------------------------- Feuilles

function SheetForm({
  sheet,
  onSuccess,
  onCancel,
}: {
  sheet?: ImpositionSheet;
  onSuccess: () => void;
  onCancel: () => void;
}) {
  const [width, setWidth] = useState(sheet?.width_mm ?? 304.8);
  const [height, setHeight] = useState(sheet?.height_mm ?? 457.2);
  const [unit, setUnit] = useState<Unit>("in");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const res = await fetch(sheet ? `/api/imposition/sheets/${sheet.id}` : "/api/imposition/sheets", {
      method: sheet ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ width_mm: width, height_mm: height }),
    });
    const data = await res.json().catch(() => ({}));
    setLoading(false);
    if (!res.ok) {
      setError(data.error ?? "Erreur lors de l'enregistrement.");
      return;
    }
    onSuccess();
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">Dimensions</span>
        <UnitToggle unit={unit} onChange={setUnit} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <MeasureField key={`w-${unit}`} label="Largeur" valueMm={width} unit={unit} onChange={setWidth} />
        <MeasureField key={`h-${unit}`} label="Hauteur" valueMm={height} unit={unit} onChange={setHeight} />
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <div className="flex gap-2">
        <button
          type="button"
          onClick={onCancel}
          className="rounded-lg border border-neutral-300 px-4 py-2 text-sm text-neutral-600 hover:bg-neutral-50"
        >
          Annuler
        </button>
        <SubmitButton loading={loading}>{sheet ? "Enregistrer" : "Créer la feuille"}</SubmitButton>
      </div>
    </form>
  );
}

export function SheetsManager({
  sheets,
  onChanged,
}: {
  sheets: ImpositionSheet[];
  onChanged: () => void;
}) {
  const [editing, setEditing] = useState<ImpositionSheet | "new" | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  async function handleDelete(sheet: ImpositionSheet) {
    if (!confirm(`Supprimer la feuille ${sheetLabel(sheet.width_mm, sheet.height_mm)} ?`)) return;
    setDeletingId(sheet.id);
    const res = await fetch(`/api/imposition/sheets/${sheet.id}`, { method: "DELETE" });
    setDeletingId(null);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      alert(data.error ?? "La suppression a échoué.");
      return;
    }
    onChanged();
  }

  if (editing) {
    return (
      <SheetForm
        sheet={editing === "new" ? undefined : editing}
        onCancel={() => setEditing(null)}
        onSuccess={() => {
          setEditing(null);
          onChanged();
        }}
      />
    );
  }

  return (
    <div className="space-y-3">
      {sheets.length === 0 && <p className="text-sm text-neutral-500">Aucune feuille pour l&apos;instant.</p>}
      <ul className="divide-y divide-neutral-100 rounded-lg border border-neutral-200">
        {sheets.map((s) => (
          <li key={s.id} className="flex items-center justify-between gap-3 px-3 py-2.5">
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">{sheetLabel(s.width_mm, s.height_mm)}</p>
              <p className="text-xs text-neutral-500">
                {mmLabel(s.width_mm)} × {mmLabel(s.height_mm)}
              </p>
            </div>
            <RowActions onEdit={() => setEditing(s)} onDelete={() => handleDelete(s)} busy={deletingId === s.id} />
          </li>
        ))}
      </ul>
      <button
        type="button"
        onClick={() => setEditing("new")}
        className="w-full rounded-lg border border-dashed border-neutral-300 px-4 py-2 text-sm text-neutral-600 hover:bg-neutral-50"
      >
        + Nouvelle feuille
      </button>
    </div>
  );
}

// ------------------------------------------------------------ Découpeuses

function CutterForm({
  cutter,
  onSuccess,
  onCancel,
}: {
  cutter?: ImpositionCutter;
  onSuccess: () => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState(cutter?.name ?? "");
  const [settings, setSettings] = useState<CutterSettings>(cutterSettingsOf(cutter));
  const [marksFile, setMarksFile] = useState<File | null>(null);
  const [removeMarks, setRemoveMarks] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const body = new FormData();
    body.append("name", name);
    for (const [key, value] of Object.entries(settings)) body.append(key, String(value));
    if (marksFile) body.append("marks", marksFile);
    if (removeMarks) body.append("removeMarks", "true");
    const res = await fetch(cutter ? `/api/imposition/cutters/${cutter.id}` : "/api/imposition/cutters", {
      method: cutter ? "PATCH" : "POST",
      body,
    });
    const data = await res.json().catch(() => ({}));
    setLoading(false);
    if (!res.ok) {
      setError(data.error ?? "Erreur lors de l'enregistrement.");
      return;
    }
    onSuccess();
  }

  const hasStoredMarks = Boolean(cutter?.marks_path) && !removeMarks;

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-medium">Nom du profil</label>
        <input
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Ex. Découpeuse atelier"
          className={inputClass}
        />
      </div>

      <CutterSettingsFields value={settings} onChange={setSettings} />

      <div>
        <p className="text-sm font-medium">Marques de la découpeuse</p>
        <p className="text-xs text-neutral-500">
          PDF (recommandé), PNG ou JPEG. Un PDF est placé au centre de la feuille à sa taille réelle ; une
          image est étirée à la taille de la feuille. Les marques sont ajoutées sur le recto seulement.
        </p>
        {hasStoredMarks && !marksFile && (
          <p className="mt-2 text-xs text-neutral-600">
            Un fichier de marques est déjà enregistré.{" "}
            <button type="button" onClick={() => setRemoveMarks(true)} className="text-red-600 underline">
              Retirer
            </button>
          </p>
        )}
        {removeMarks && !marksFile && (
          <p className="mt-2 text-xs text-neutral-600">
            Les marques seront retirées à l&apos;enregistrement.{" "}
            <button type="button" onClick={() => setRemoveMarks(false)} className="underline">
              Annuler
            </button>
          </p>
        )}
        <input
          type="file"
          accept="application/pdf,image/png,image/jpeg"
          onChange={(e) => setMarksFile(e.target.files?.[0] ?? null)}
          className="mt-2 block w-full text-sm"
        />
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}
      <div className="flex gap-2">
        <button
          type="button"
          onClick={onCancel}
          className="rounded-lg border border-neutral-300 px-4 py-2 text-sm text-neutral-600 hover:bg-neutral-50"
        >
          Annuler
        </button>
        <SubmitButton loading={loading}>{cutter ? "Enregistrer" : "Créer le profil"}</SubmitButton>
      </div>
    </form>
  );
}

export function CuttersManager({
  cutters,
  onChanged,
}: {
  cutters: ImpositionCutter[];
  onChanged: () => void;
}) {
  const [editing, setEditing] = useState<ImpositionCutter | "new" | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  async function handleDelete(cutter: ImpositionCutter) {
    if (!confirm(`Supprimer le profil « ${cutter.name} » ?`)) return;
    setDeletingId(cutter.id);
    const res = await fetch(`/api/imposition/cutters/${cutter.id}`, { method: "DELETE" });
    setDeletingId(null);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      alert(data.error ?? "La suppression a échoué.");
      return;
    }
    onChanged();
  }

  if (editing) {
    return (
      <CutterForm
        cutter={editing === "new" ? undefined : editing}
        onCancel={() => setEditing(null)}
        onSuccess={() => {
          setEditing(null);
          onChanged();
        }}
      />
    );
  }

  return (
    <div className="space-y-3">
      {cutters.length === 0 && (
        <p className="text-sm text-neutral-500">Aucun profil de découpeuse pour l&apos;instant.</p>
      )}
      <ul className="divide-y divide-neutral-100 rounded-lg border border-neutral-200">
        {cutters.map((c) => (
          <li key={c.id} className="flex items-center justify-between gap-3 px-3 py-2.5">
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">{c.name}</p>
              <p className="text-xs text-neutral-500">
                Marges {mmLabel(c.margin_top_mm)} / {mmLabel(c.margin_right_mm)} / {mmLabel(c.margin_bottom_mm)} /{" "}
                {mmLabel(c.margin_left_mm)} · espacement {mmLabel(c.gutter_x_mm)} × {mmLabel(c.gutter_y_mm)} ·{" "}
                {c.marks_path ? "avec marques" : "sans marques"}
              </p>
            </div>
            <RowActions onEdit={() => setEditing(c)} onDelete={() => handleDelete(c)} busy={deletingId === c.id} />
          </li>
        ))}
      </ul>
      <button
        type="button"
        onClick={() => setEditing("new")}
        className="w-full rounded-lg border border-dashed border-neutral-300 px-4 py-2 text-sm text-neutral-600 hover:bg-neutral-50"
      >
        + Nouveau profil de découpeuse
      </button>
    </div>
  );
}
