"use client";

import { useRef, useState } from "react";
import ColorPickerButton from "@/components/ColorPickerButton";
import {
  ChevronDownIcon,
  ChevronUpIcon,
  CircleIcon,
  GripVerticalIcon,
  ImageIcon,
  SquareIcon,
  TrashIcon,
  TypeIcon,
} from "@/components/icons";
import { FONT_OPTIONS } from "@/lib/design/fonts";
import { BLEND_MODES, newImageLayer, newShapeLayer, newTextLayer, type DesignLayer, type ShapeKind } from "@/lib/design/layers";

const SHAPE_OPTIONS: { value: ShapeKind; icon: (props: { className?: string }) => JSX.Element; label: string }[] = [
  { value: "rectangle", icon: SquareIcon, label: "Rectangle" },
  { value: "ellipse", icon: CircleIcon, label: "Ellipse" },
];

/**
 * Panneau "Calques" de l'étape Aperçu de Design Shopify (recto ou verso,
 * l'appelant — DesignPreview — passe déjà les calques du bon côté) : liste
 * empilée (le premier de `layers` est tout en bas, le dernier tout en
 * haut — la liste ici l'affiche dans l'autre sens, "haut de la pile"
 * d'abord, plus intuitif), réordonnable par glisser-déposer (ou chevrons,
 * plus précis) ; boutons pour ajouter texte/image/forme et pour supprimer ;
 * éditeur du calque sélectionné (police/taille/gras/italique/espacement/
 * couleur/bordure pour le texte, forme/taille/remplissage/bordure pour une
 * forme, rien de plus pour une image — sa taille/position se règlent en la
 * glissant sur l'aperçu, voir ImageSourcePicker) ; opacité et mode de fusion
 * réglables pour les trois types, en bas de l'éditeur.
 */
export default function LayersPanel({
  layers,
  onChangeLayers,
  selectedLayerId,
  onSelectLayer,
  maxFontSizeMm,
}: {
  layers: DesignLayer[];
  onChangeLayers: (layers: DesignLayer[]) => void;
  selectedLayerId: string | null;
  onSelectLayer: (id: string | null) => void;
  // Plafond du curseur de taille — dépend du format du modèle (voir
  // DesignPreview). 40 par défaut si jamais omis.
  maxFontSizeMm?: number;
}) {
  const effectiveMaxFontSizeMm = maxFontSizeMm ?? 40;
  const fileInputRef = useRef<HTMLInputElement>(null);
  // Index (dans la liste affichée, "haut de la pile" d'abord) du calque en
  // cours de glissement — voir handleDrop.
  const draggedDisplayedIndexRef = useRef<number | null>(null);
  const [dragOverDisplayedIndex, setDragOverDisplayedIndex] = useState<number | null>(null);

  function addText() {
    const layer = newTextLayer();
    onChangeLayers([...layers, layer]);
    onSelectLayer(layer.id);
  }

  function addImage(file: File) {
    const layer = newImageLayer(file);
    onChangeLayers([...layers, layer]);
    onSelectLayer(layer.id);
  }

  function addShape() {
    const layer = newShapeLayer();
    onChangeLayers([...layers, layer]);
    onSelectLayer(layer.id);
  }

  function updateLayer(id: string, patch: Record<string, unknown>) {
    onChangeLayers(layers.map((l) => (l.id === id ? ({ ...l, ...patch } as DesignLayer) : l)));
  }

  function removeLayer(id: string) {
    onChangeLayers(layers.filter((l) => l.id !== id));
    if (selectedLayerId === id) onSelectLayer(null);
  }

  // "up"/"down" au sens de la pile (dessus/dessous), pas de la liste
  // affichée (inversée, voir plus bas).
  function moveLayer(id: string, direction: "up" | "down") {
    const index = layers.findIndex((l) => l.id === id);
    if (index === -1) return;
    const targetIndex = direction === "up" ? index + 1 : index - 1;
    if (targetIndex < 0 || targetIndex >= layers.length) return;
    const next = [...layers];
    [next[index], next[targetIndex]] = [next[targetIndex], next[index]];
    onChangeLayers(next);
  }

  const selectedLayer = layers.find((l) => l.id === selectedLayerId) ?? null;
  // Affichée du dessus de la pile vers le dessous — plus naturel à lire
  // qu'à l'envers de l'ordre de rendu.
  const stackedTopFirst = [...layers].reverse();

  // Glisser-déposer d'une rangée sur une autre : reproduit le déplacement
  // dans l'ordre AFFICHÉ (plus simple à raisonner que l'ordre de pile
  // inversé), puis ré-inverse avant d'appeler onChangeLayers.
  function handleDrop(dropDisplayedIndex: number) {
    const from = draggedDisplayedIndexRef.current;
    draggedDisplayedIndexRef.current = null;
    setDragOverDisplayedIndex(null);
    if (from === null || from === dropDisplayedIndex) return;
    const displayed = [...stackedTopFirst];
    const [moved] = displayed.splice(from, 1);
    displayed.splice(dropDisplayedIndex, 0, moved);
    onChangeLayers([...displayed].reverse());
  }

  return (
    <div className="space-y-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-text-subtle">Calques</p>

      {layers.length > 0 && (
        <ul className="space-y-1">
          {stackedTopFirst.map((layer, displayedIndex) => {
            const index = layers.findIndex((l) => l.id === layer.id);
            const selected = selectedLayerId === layer.id;
            const label =
              layer.type === "text"
                ? layer.content.trim() || "Texte vide"
                : layer.type === "image"
                ? layer.fileName ?? "Image"
                : layer.shape === "ellipse"
                ? "Ellipse"
                : "Rectangle";
            const Icon = layer.type === "text" ? TypeIcon : layer.type === "image" ? ImageIcon : SquareIcon;
            return (
              <li
                key={layer.id}
                draggable
                onDragStart={() => {
                  draggedDisplayedIndexRef.current = displayedIndex;
                }}
                onDragOver={(e) => {
                  e.preventDefault();
                  if (dragOverDisplayedIndex !== displayedIndex) setDragOverDisplayedIndex(displayedIndex);
                }}
                onDragEnd={() => {
                  draggedDisplayedIndexRef.current = null;
                  setDragOverDisplayedIndex(null);
                }}
                onDrop={() => handleDrop(displayedIndex)}
                className={`flex items-center gap-1 rounded-lg border px-2 py-1.5 text-sm ${
                  selected ? "border-primary bg-primary-subtle" : "border-border"
                } ${dragOverDisplayedIndex === displayedIndex ? "border-dashed border-accent" : ""}`}
              >
                <GripVerticalIcon className="h-4 w-4 shrink-0 cursor-grab text-text-subtle active:cursor-grabbing" />
                <button
                  type="button"
                  onClick={() => onSelectLayer(selected ? null : layer.id)}
                  className="flex flex-1 items-center gap-2 overflow-hidden text-left"
                >
                  <Icon className="h-4 w-4 shrink-0 text-text-muted" />
                  <span className="truncate">{label}</span>
                </button>
                <button
                  type="button"
                  onClick={() => moveLayer(layer.id, "up")}
                  disabled={index === layers.length - 1}
                  aria-label="Monter"
                  className="text-text-subtle hover:text-text disabled:opacity-30"
                >
                  <ChevronUpIcon className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => moveLayer(layer.id, "down")}
                  disabled={index === 0}
                  aria-label="Descendre"
                  className="text-text-subtle hover:text-text disabled:opacity-30"
                >
                  <ChevronDownIcon className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => removeLayer(layer.id)}
                  aria-label="Supprimer le calque"
                  className="text-text-subtle hover:text-danger"
                >
                  <TrashIcon className="h-4 w-4" />
                </button>
              </li>
            );
          })}
        </ul>
      )}

      <p className="text-xs font-semibold uppercase tracking-wide text-text-subtle">Ajouter un calque</p>

      {/* Les trois boutons empilés (un par rangée) plutôt que côte à côte :
          à trois sur une même ligne, "Texte"/"Image"/"Forme" (icône + texte
          chacun) ne tiennent plus dans la colonne latérale étroite
          (sm:w-48) et débordent sur l'aperçu — même famille de bug que les
          rangées de l'éditeur plus bas, voir leurs commentaires. */}
      <div className="space-y-2">
        <button
          type="button"
          onClick={addText}
          className="flex w-full items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-sm text-text-muted hover:bg-surface-muted hover:text-text"
        >
          <TypeIcon className="h-4 w-4" />
          Texte
        </button>
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="flex w-full items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-sm text-text-muted hover:bg-surface-muted hover:text-text"
        >
          <ImageIcon className="h-4 w-4" />
          Image
        </button>
        <button
          type="button"
          onClick={addShape}
          className="flex w-full items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-sm text-text-muted hover:bg-surface-muted hover:text-text"
        >
          <SquareIcon className="h-4 w-4" />
          Forme
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) addImage(f);
            e.target.value = "";
          }}
        />
      </div>

      {selectedLayer?.type === "text" && (
        <div className="space-y-3 rounded-lg border border-border p-3">
          <textarea
            value={selectedLayer.content}
            onChange={(e) => updateLayer(selectedLayer.id, { content: e.target.value })}
            rows={2}
            className="w-full resize-none rounded-lg border border-border px-2 py-1.5 text-sm"
            placeholder="Ton texte"
          />

          <select
            value={selectedLayer.fontId}
            onChange={(e) => updateLayer(selectedLayer.id, { fontId: e.target.value })}
            className="w-full rounded-lg border border-border px-2 py-1.5 text-sm"
          >
            {FONT_OPTIONS.map((f) => (
              <option key={f.id} value={f.id}>
                {f.label}
              </option>
            ))}
          </select>

          <div className="flex items-center gap-3">
            <span className="text-xs text-text-subtle">Taille</span>
            <input
              type="range"
              min={3}
              max={effectiveMaxFontSizeMm}
              step={0.5}
              value={selectedLayer.fontSizeMm}
              onChange={(e) => updateLayer(selectedLayer.id, { fontSizeMm: parseFloat(e.target.value) })}
              className="flex-1"
              style={{ accentColor: "var(--accent)" }}
              aria-label="Taille du texte"
            />
            <span className="w-12 shrink-0 text-right text-xs text-text-subtle">
              {Math.round(selectedLayer.fontSizeMm)} mm
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => updateLayer(selectedLayer.id, { bold: !selectedLayer.bold })}
              className={`flex-1 rounded-lg border px-2 py-1.5 text-sm font-bold ${
                selectedLayer.bold ? "border-primary bg-primary text-text-on-brand" : "border-border text-text-muted hover:bg-surface-muted"
              }`}
            >
              Gras
            </button>
            <button
              type="button"
              onClick={() => updateLayer(selectedLayer.id, { italic: !selectedLayer.italic })}
              className={`flex-1 rounded-lg border px-2 py-1.5 text-sm italic ${
                selectedLayer.italic ? "border-primary bg-primary text-text-on-brand" : "border-border text-text-muted hover:bg-surface-muted"
              }`}
            >
              Italique
            </button>
          </div>

          <div className="flex items-center gap-3">
            <span className="w-14 shrink-0 text-xs text-text-subtle">Espacement</span>
            <input
              type="range"
              min={-2}
              max={15}
              step={0.1}
              value={selectedLayer.letterSpacingMm}
              onChange={(e) => updateLayer(selectedLayer.id, { letterSpacingMm: parseFloat(e.target.value) })}
              className="min-w-0 flex-1"
              style={{ accentColor: "var(--accent)" }}
              aria-label="Espacement entre les lettres"
            />
            <span className="w-12 shrink-0 text-right text-xs text-text-subtle">
              {selectedLayer.letterSpacingMm.toFixed(1)} mm
            </span>
          </div>

          <div className="flex items-center justify-between gap-2">
            <span className="text-xs text-text-subtle">Couleur du texte</span>
            <ColorPickerButton
              value={selectedLayer.color}
              onChange={(hex) => updateLayer(selectedLayer.id, { color: hex })}
              label="Couleur du texte"
            />
          </div>

          {/* Comme le bloc Gras/Italique plus haut : une
              rangée par élément qui ne peut pas rétrécir (curseur, bouton
              couleur) plutôt que tout ensemble, sinon le curseur (largeur
              minimale native d'un <input type="range">) écrase le bouton
              couleur à presque rien dans une colonne aussi étroite. */}
          <div className="flex items-center gap-3 border-t border-border pt-3">
            <span className="shrink-0 text-xs text-text-subtle">Bordure</span>
            <input
              type="range"
              min={0}
              max={3}
              step={0.1}
              value={selectedLayer.strokeWidthMm}
              onChange={(e) => updateLayer(selectedLayer.id, { strokeWidthMm: parseFloat(e.target.value) })}
              className="min-w-0 flex-1"
              style={{ accentColor: "var(--accent)" }}
              aria-label="Épaisseur de la bordure du texte"
            />
            <span className="w-12 shrink-0 text-right text-xs text-text-subtle">
              {selectedLayer.strokeWidthMm.toFixed(1)} mm
            </span>
          </div>
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs text-text-subtle">Couleur de la bordure</span>
            <ColorPickerButton
              value={selectedLayer.strokeColor}
              onChange={(hex) => updateLayer(selectedLayer.id, { strokeColor: hex })}
              label="Couleur de la bordure"
            />
          </div>
        </div>
      )}

      {selectedLayer?.type === "image" && (
        <div className="space-y-3 rounded-lg border border-border p-3">
          <p className="truncate text-sm text-text-muted">{selectedLayer.fileName}</p>
          <div className="flex items-center gap-3">
            <span className="text-xs text-text-subtle">Taille</span>
            <input
              type="range"
              min={0.05}
              max={1}
              step={0.01}
              value={selectedLayer.widthRatio}
              onChange={(e) => updateLayer(selectedLayer.id, { widthRatio: parseFloat(e.target.value) })}
              className="flex-1"
              style={{ accentColor: "var(--accent)" }}
              aria-label="Taille de l'image"
            />
            <span className="w-12 shrink-0 text-right text-xs text-text-subtle">
              {Math.round(selectedLayer.widthRatio * 100)}%
            </span>
          </div>
          <p className="text-xs text-text-subtle">Glisse l&apos;image sur l&apos;aperçu pour la repositionner.</p>
        </div>
      )}

      {selectedLayer?.type === "shape" && (
        <div className="space-y-3 rounded-lg border border-border p-3">
          <div className="flex overflow-hidden rounded-lg border border-border">
            {/* Icône seule (sans texte) — comme ALIGN_OPTIONS plus bas :
                avec un libellé, "Rectangle"/"Ellipse" ne tiennent pas côte à
                côte dans la colonne étroite (le texte se fait couper par
                l'overflow-hidden du conteneur). */}
            {SHAPE_OPTIONS.map(({ value, icon: Icon, label }) => (
              <button
                key={value}
                type="button"
                onClick={() => updateLayer(selectedLayer.id, { shape: value })}
                aria-label={label}
                title={label}
                className={`flex flex-1 items-center justify-center px-2 py-1.5 ${
                  selectedLayer.shape === value ? "bg-primary text-text-on-brand" : "text-text-muted hover:bg-surface-muted"
                }`}
              >
                <Icon className="h-4 w-4" />
              </button>
            ))}
          </div>

          <div className="flex items-center gap-3">
            <span className="w-14 shrink-0 text-xs text-text-subtle">Largeur</span>
            <input
              type="range"
              min={0.05}
              max={1.5}
              step={0.01}
              value={selectedLayer.widthRatio}
              onChange={(e) => updateLayer(selectedLayer.id, { widthRatio: parseFloat(e.target.value) })}
              className="min-w-0 flex-1"
              style={{ accentColor: "var(--accent)" }}
              aria-label="Largeur de la forme"
            />
            <span className="w-12 shrink-0 text-right text-xs text-text-subtle">
              {Math.round(selectedLayer.widthRatio * 100)}%
            </span>
          </div>
          <div className="flex items-center gap-3">
            <span className="w-14 shrink-0 text-xs text-text-subtle">Hauteur</span>
            <input
              type="range"
              min={0.05}
              max={1.5}
              step={0.01}
              value={selectedLayer.heightRatio}
              onChange={(e) => updateLayer(selectedLayer.id, { heightRatio: parseFloat(e.target.value) })}
              className="min-w-0 flex-1"
              style={{ accentColor: "var(--accent)" }}
              aria-label="Hauteur de la forme"
            />
            <span className="w-12 shrink-0 text-right text-xs text-text-subtle">
              {Math.round(selectedLayer.heightRatio * 100)}%
            </span>
          </div>

          <div className="flex items-center justify-between gap-2 border-t border-border pt-3">
            <button
              type="button"
              onClick={() => updateLayer(selectedLayer.id, { fillEnabled: !selectedLayer.fillEnabled })}
              className={`rounded-lg border px-3 py-1.5 text-sm ${
                selectedLayer.fillEnabled ? "border-primary bg-primary text-text-on-brand" : "border-border text-text-muted hover:bg-surface-muted"
              }`}
            >
              Remplir
            </button>
            <ColorPickerButton
              value={selectedLayer.fillColor}
              onChange={(hex) => updateLayer(selectedLayer.id, { fillColor: hex })}
              label="Couleur de remplissage"
            />
          </div>

          <div className="flex items-center gap-3 border-t border-border pt-3">
            <span className="shrink-0 text-xs text-text-subtle">Bordure</span>
            <input
              type="range"
              min={0}
              max={3}
              step={0.1}
              value={selectedLayer.strokeWidthMm}
              onChange={(e) => updateLayer(selectedLayer.id, { strokeWidthMm: parseFloat(e.target.value) })}
              className="min-w-0 flex-1"
              style={{ accentColor: "var(--accent)" }}
              aria-label="Épaisseur de la bordure de la forme"
            />
            <span className="w-12 shrink-0 text-right text-xs text-text-subtle">
              {selectedLayer.strokeWidthMm.toFixed(1)} mm
            </span>
          </div>
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs text-text-subtle">Couleur de la bordure</span>
            <ColorPickerButton
              value={selectedLayer.strokeColor}
              onChange={(hex) => updateLayer(selectedLayer.id, { strokeColor: hex })}
              label="Couleur de la bordure"
            />
          </div>
        </div>
      )}

      {/* Opacité + mode de fusion : communs aux trois types, en bas de
          l'éditeur plutôt que dupliqués dans chacun des trois blocs ci-dessus. */}
      {selectedLayer && (
        <div className="space-y-3 rounded-lg border border-border p-3">
          <div className="flex items-center gap-3">
            <span className="w-14 shrink-0 text-xs text-text-subtle">Opacité</span>
            <input
              type="range"
              min={0}
              max={1}
              step={0.01}
              value={selectedLayer.opacity}
              onChange={(e) => updateLayer(selectedLayer.id, { opacity: parseFloat(e.target.value) })}
              className="min-w-0 flex-1"
              style={{ accentColor: "var(--accent)" }}
              aria-label="Opacité du calque"
            />
            <span className="w-12 shrink-0 text-right text-xs text-text-subtle">
              {Math.round(selectedLayer.opacity * 100)}%
            </span>
          </div>
          <div className="flex items-center gap-3">
            <span className="w-14 shrink-0 text-xs text-text-subtle">Fondu</span>
            <select
              value={selectedLayer.blendMode}
              onChange={(e) => updateLayer(selectedLayer.id, { blendMode: e.target.value })}
              className="min-w-0 flex-1 rounded-lg border border-border px-2 py-1.5 text-sm"
              aria-label="Mode de fusion du calque"
            >
              {BLEND_MODES.map((m) => (
                <option key={m.value} value={m.value}>
                  {m.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      )}
    </div>
  );
}
