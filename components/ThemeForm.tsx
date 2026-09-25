"use client";

import { useEffect, useRef, useState } from "react";
import type { Template, ThemeSlot } from "@/lib/types";
import type { ThemeWithOverlayUrl } from "@/components/ThemesTable";
import { CopyIcon, SpinnerIcon } from "@/components/icons";
import FileDropZone from "@/components/FileDropZone";

const MIN_RATIO = 0.05;
const MAX_SLOTS = 3;

// Emplacement par défaut d'un nouveau slot — carré (même taille physique en
// largeur et en hauteur, pas juste widthRatio === heightRatio : ces deux
// ratios sont relatifs à des dimensions différentes de la page — largeur et
// hauteur —, presque toujours inégales, donc un simple 0.35/0.35 donnerait
// un rectangle, pas un carré). Basé sur 35 % de la plus petite dimension de
// la page, pour rester raisonnable même sur un format très étiré (bannière,
// signet) — voir le commentaire de `pageAspectRatio`.
//
// Décalé selon son index pour que plusieurs slots ajoutés d'affilée ne se
// superposent pas exactement, même si l'admin les repositionne presque
// toujours ensuite.
function defaultSlot(index: number, pageAspectRatio: number): ThemeSlot {
  const offsets = [
    { x: 0.5, y: 0.5 },
    { x: 0.3, y: 0.35 },
    { x: 0.7, y: 0.65 },
  ];
  const o = offsets[index % offsets.length];
  const SIZE = 0.35;
  const { widthRatio, heightRatio } =
    pageAspectRatio >= 1
      ? { widthRatio: SIZE / pageAspectRatio, heightRatio: SIZE }
      : { widthRatio: SIZE, heightRatio: SIZE * pageAspectRatio };
  return { positionX: o.x, positionY: o.y, widthRatio, heightRatio };
}

function clampSlot(slot: ThemeSlot): ThemeSlot {
  const widthRatio = Math.min(1, Math.max(MIN_RATIO, slot.widthRatio));
  const heightRatio = Math.min(1, Math.max(MIN_RATIO, slot.heightRatio));
  const positionX = Math.min(1 - widthRatio / 2, Math.max(widthRatio / 2, slot.positionX));
  const positionY = Math.min(1 - heightRatio / 2, Math.max(heightRatio / 2, slot.positionY));
  return { positionX, positionY, widthRatio, heightRatio };
}

/**
 * Éditeur d'un Thème (voir supabase/migrations/0046_themes.sql) : un modèle,
 * un graphisme (PNG avec transparence, affiché par-dessus les photos), et 1
 * à 3 emplacements (`slots`) que l'admin place/redimensionne directement sur
 * un aperçu de la page du modèle, en glissant — même principe que les
 * calques de Design Shopify (voir ImageSourcePicker/LayerHandles), mais sans
 * rotation ici (positions/tailles seulement, suffisant pour un cadre photo).
 *
 * Le graphisme est affiché à opacité réduite pendant l'édition (pas dans le
 * rendu final, voir lib/pdf/theme.ts) : permet de voir à la fois ses zones
 * découpées ET les rectangles des emplacements, pour les aligner précisément.
 */
export default function ThemeForm({
  theme,
  templates,
  currentOverlayUrl,
  onSuccess,
  onBusyChange,
}: {
  theme?: ThemeWithOverlayUrl;
  templates: Template[];
  currentOverlayUrl?: string | null;
  onSuccess: () => void;
  onBusyChange?: (busy: boolean) => void;
}) {
  const isEditing = Boolean(theme);
  const [templateId, setTemplateId] = useState(theme?.template_id ?? templates[0]?.id ?? "");
  const [name, setName] = useState(theme?.name ?? "");
  // Calculés avant l'état `slots` (juste en dessous) : son initialisation
  // (defaultSlot) en a besoin pour un premier emplacement carré dès le
  // départ — sans template (aucun modèle disponible), 1 = carré par défaut.
  const template = templates.find((t) => t.id === templateId) ?? null;
  const pageAspectRatio = template ? (template.width_mm + template.bleed_mm * 2) / (template.height_mm + template.bleed_mm * 2) : 1;
  const [slots, setSlots] = useState<ThemeSlot[]>(() => theme?.slots ?? [defaultSlot(0, pageAspectRatio)]);
  const [overlayFile, setOverlayFile] = useState<File | null>(null);
  const [overlayPreview, setOverlayPreview] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    onBusyChange?.(loading);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading]);

  function handleOverlayChange(f: File | null) {
    setOverlayFile(f);
    setOverlayPreview((old) => {
      if (old) URL.revokeObjectURL(old);
      return f ? URL.createObjectURL(f) : null;
    });
  }

  const overlayUrl = overlayPreview ?? currentOverlayUrl ?? null;

  const previewBoxRef = useRef<HTMLDivElement>(null);
  const [boxSize, setBoxSize] = useState({ width: 0, height: 0 });
  useEffect(() => {
    const el = previewBoxRef.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => {
      if (entry) setBoxSize({ width: entry.contentRect.width, height: entry.contentRect.height });
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const dragRef = useRef<{
    index: number;
    mode: "move" | "resize";
    startX: number;
    startY: number;
    startSlot: ThemeSlot;
  } | null>(null);

  function updateSlot(index: number, patch: Partial<ThemeSlot>) {
    setSlots((prev) => prev.map((s, i) => (i === index ? clampSlot({ ...s, ...patch }) : s)));
  }

  function beginDrag(e: React.PointerEvent<HTMLDivElement>, index: number, mode: "move" | "resize") {
    e.stopPropagation();
    dragRef.current = { index, mode, startX: e.clientX, startY: e.clientY, startSlot: slots[index] };
    e.currentTarget.setPointerCapture(e.pointerId);
  }

  function handleDragMove(e: React.PointerEvent<HTMLDivElement>) {
    const d = dragRef.current;
    if (!d || boxSize.width === 0 || boxSize.height === 0) return;
    const dx = (e.clientX - d.startX) / boxSize.width;
    const dy = (e.clientY - d.startY) / boxSize.height;
    if (d.mode === "move") {
      updateSlot(d.index, { positionX: d.startSlot.positionX + dx, positionY: d.startSlot.positionY + dy });
    } else {
      updateSlot(d.index, {
        widthRatio: d.startSlot.widthRatio + dx * 2,
        heightRatio: d.startSlot.heightRatio + dy * 2,
      });
    }
  }

  function endDrag() {
    dragRef.current = null;
  }

  function addSlot() {
    setSlots((prev) => (prev.length >= MAX_SLOTS ? prev : [...prev, defaultSlot(prev.length, pageAspectRatio)]));
  }

  function removeSlot(index: number) {
    setSlots((prev) => (prev.length <= 1 ? prev : prev.filter((_, i) => i !== index)));
  }

  // Copie l'emplacement `index` tel quel (même position/taille) — pratique
  // pour partir d'un réglage déjà bon plutôt que de repositionner un
  // nouvel emplacement à partir de zéro (voir defaultSlot). Légèrement
  // décalée pour rester visible/attrapable par-dessus l'original — sans ce
  // décalage, le duplicata serait invisible (pile sur l'original) tant
  // qu'on ne le glisse pas.
  function duplicateSlot(index: number) {
    setSlots((prev) => {
      if (prev.length >= MAX_SLOTS) return prev;
      const source = prev[index];
      const offset = 0.04;
      return [...prev, clampSlot({ ...source, positionX: source.positionX + offset, positionY: source.positionY + offset })];
    });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!templateId) {
      setError("Choisis un modèle.");
      return;
    }
    if (!isEditing && !overlayFile) {
      setError("Choisis un graphisme.");
      return;
    }
    setLoading(true);
    setError(null);

    const formData = new FormData();
    formData.append("templateId", templateId);
    formData.append("name", name);
    formData.append("slots", JSON.stringify(slots));
    if (overlayFile) formData.append("overlay", overlayFile);

    const res = await fetch(isEditing ? `/api/themes/${theme!.id}` : "/api/themes", {
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
        <label className="block text-sm font-medium">Nom du thème</label>
        <input
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Ex. Cadre Noël"
          className="mt-1 w-full rounded border border-neutral-300 px-3 py-2"
        />
      </div>

      <div>
        <label className="block text-sm font-medium">Modèle</label>
        <select
          required
          value={templateId}
          onChange={(e) => setTemplateId(e.target.value)}
          className="mt-1 w-full rounded border border-neutral-300 px-3 py-2"
        >
          {templates.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium">
          Graphisme (PNG avec transparence){currentOverlayUrl ? " — laisser vide pour garder l'actuel" : ""}
        </label>
        <div className="mt-1">
          <FileDropZone
            file={overlayFile}
            onFileChange={handleOverlayChange}
            accept="image/png,image/svg+xml"
            previewUrl={overlayPreview ?? currentOverlayUrl ?? null}
          />
        </div>
        <p className="mt-1 text-xs text-neutral-500">
          Zones transparentes = là où les photos du client apparaîtront ; le reste (cadre, décor) reste
          visible par-dessus.
        </p>
      </div>

      <div>
        <div className="mb-2 flex items-center justify-between">
          <label className="block text-sm font-medium">
            Emplacements photo ({slots.length}/{MAX_SLOTS})
          </label>
          <button
            type="button"
            onClick={addSlot}
            disabled={slots.length >= MAX_SLOTS}
            className="rounded-lg border border-neutral-300 px-3 py-1.5 text-xs text-neutral-700 hover:bg-neutral-50 disabled:opacity-40"
          >
            + Ajouter un emplacement
          </button>
        </div>
        {!template ? (
          <p className="text-xs text-neutral-500">Choisis un modèle pour placer les emplacements.</p>
        ) : (
          <div
            ref={previewBoxRef}
            className="relative mx-auto touch-none select-none overflow-hidden rounded-lg border border-neutral-200 bg-[repeating-conic-gradient(#e5e5e5_0%_25%,#ffffff_0%_50%)] bg-[length:16px_16px]"
            style={{ aspectRatio: String(pageAspectRatio), maxWidth: 480 }}
          >
            {slots.map((slot, i) => (
              <div
                key={i}
                onPointerDown={(e) => beginDrag(e, i, "move")}
                onPointerMove={handleDragMove}
                onPointerUp={endDrag}
                onPointerLeave={endDrag}
                className="absolute flex cursor-move items-center justify-center border-2 border-dashed border-blue-500 bg-blue-500/20 text-xs font-medium text-blue-700"
                style={{
                  left: `${(slot.positionX - slot.widthRatio / 2) * 100}%`,
                  top: `${(slot.positionY - slot.heightRatio / 2) * 100}%`,
                  width: `${slot.widthRatio * 100}%`,
                  height: `${slot.heightRatio * 100}%`,
                }}
              >
                Photo {i + 1}
              </div>
            ))}
            {/* Boutons (dupliquer/retirer) et poignée de redimensionnement de
                chaque emplacement : une passe SÉPARÉE, rendue après (donc
                au-dessus de) TOUS les emplacements ci-dessus — sinon un
                emplacement ajouté plus tard (peint par-dessus dans l'ordre
                naturel du DOM) peut recouvrir les contrôles d'un emplacement
                antérieur qu'il chevauche, les rendant incliquables (vécu :
                dupliquer/supprimer ne répondaient plus une fois deux
                emplacements superposés, comme juste après une duplication).
                `pointer-events-none` sur le conteneur (sauf les contrôles
                eux-mêmes, `pointer-events-auto`) : sinon CE conteneur-ci
                bloquerait à son tour le glisser des emplacements en dessous
                sur toute sa zone, pas seulement ses boutons. */}
            {slots.map((slot, i) => (
              <div
                key={`controls-${i}`}
                className="pointer-events-none absolute"
                style={{
                  left: `${(slot.positionX - slot.widthRatio / 2) * 100}%`,
                  top: `${(slot.positionY - slot.heightRatio / 2) * 100}%`,
                  width: `${slot.widthRatio * 100}%`,
                  height: `${slot.heightRatio * 100}%`,
                }}
              >
                <div className="pointer-events-auto absolute right-1 top-1 flex gap-1">
                  {slots.length < MAX_SLOTS && (
                    <button
                      type="button"
                      // `onPointerDown` doit aussi être arrêté ici, pas
                      // seulement `onClick` : l'emplacement (dessous) écoute
                      // `onPointerDown` pour démarrer le glisser (beginDrag),
                      // qui se déclenche AVANT le `click` (pointerdown →
                      // pointerup → click) — sans ce stopPropagation, cliquer
                      // ce bouton démarrerait quand même un glisser, qui
                      // capture le pointeur et empêche le clic d'aboutir.
                      onPointerDown={(e) => e.stopPropagation()}
                      onClick={(e) => {
                        e.stopPropagation();
                        duplicateSlot(i);
                      }}
                      title="Dupliquer cet emplacement"
                      className="flex h-5 w-5 items-center justify-center rounded-full bg-white/90 text-neutral-600 hover:bg-white"
                    >
                      <CopyIcon className="h-3 w-3" />
                    </button>
                  )}
                  {slots.length > 1 && (
                    <button
                      type="button"
                      onPointerDown={(e) => e.stopPropagation()}
                      onClick={(e) => {
                        e.stopPropagation();
                        removeSlot(i);
                      }}
                      title="Retirer cet emplacement"
                      className="flex h-5 w-5 items-center justify-center rounded-full bg-white/90 text-[10px] text-neutral-600 hover:bg-white"
                    >
                      ✕
                    </button>
                  )}
                </div>
                <div
                  onPointerDown={(e) => beginDrag(e, i, "resize")}
                  onPointerMove={handleDragMove}
                  onPointerUp={endDrag}
                  className="pointer-events-auto absolute bottom-0 right-0 h-3 w-3 -translate-x-1/2 -translate-y-1/2 cursor-nwse-resize rounded-sm border border-white bg-blue-600"
                  style={{ right: 0, bottom: 0, transform: "translate(50%, 50%)" }}
                />
              </div>
            ))}
            {overlayUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={overlayUrl}
                alt=""
                draggable={false}
                className="pointer-events-none absolute inset-0 h-full w-full object-fill opacity-70"
              />
            )}
          </div>
        )}
        <p className="mt-2 text-xs text-neutral-500">
          Glisse chaque case pour la positionner, la poignée du coin pour la redimensionner.
        </p>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="flex justify-end gap-3 pt-2">
        <button
          type="submit"
          disabled={loading}
          className="flex items-center gap-2 rounded-lg bg-pico-maroon px-4 py-2 text-sm font-medium text-white hover:bg-pico-maroon-dark disabled:opacity-60"
        >
          {loading && <SpinnerIcon className="h-4 w-4" />}
          {isEditing ? "Enregistrer" : "Créer le thème"}
        </button>
      </div>
    </form>
  );
}
