"use client";

import { useEffect, useRef, useState } from "react";
import { isPdfFile } from "@/components/ImageSourcePicker";
import { ImageIcon, UploadIcon, XIcon } from "@/components/icons";

/**
 * Carte « Image arrière-plan » du panneau Visuel de l'Outil Shopify — reprend
 * le Figma (vignette + nom + indicateur de qualité + « Remplacer », puis une
 * zone de dépôt en dessous) plutôt que la zone de dépôt générique
 * d'ImageSourcePicker (`FileDropZone`, partagée avec les formulaires admin —
 * volontairement pas touchée ici, voir DesignEditor). N'est utilisé que pour
 * `sourceMode === "upload"` : mosaïque/thème gardent le rendu d'
 * ImageSourcePicker (banque, cases...), trop différent pour ce même gabarit.
 *
 * L'indicateur de qualité est un vrai calcul, pas une pastille décorative :
 * un fichier est « Excellente qualité » si sa résolution native suffit à
 * couvrir la zone d'impression (fond perdu compris) au zoom courant SANS
 * être agrandi au-delà de sa taille native — mêmes dimensions cible
 * (`targetWidthPx`/`targetHeightPx`, mm→px via lib/pdf/units.ts) que celles
 * utilisées pour le rendu final, calculées par l'appelant (DesignEditor).
 * Un PDF n'a pas de résolution native accessible côté client (il est rendu
 * côté serveur) : pas d'indicateur pour lui, plutôt qu'un faux résultat.
 */
export default function FileVisualCard({
  file,
  pairedPdfLabel,
  targetWidthPx,
  targetHeightPx,
  scale,
  onFileChange,
}: {
  file: File | null;
  // Nom à afficher quand ce côté n'a pas son propre fichier mais hérite
  // d'une page du PDF du recto (voir DesignTool, `backFromPdf`) — ex. "Page
  // 2 du PDF (recto)". `null`/`undefined` : rien à afficher tant qu'aucun
  // fichier n'existe.
  pairedPdfLabel?: string | null;
  targetWidthPx: number;
  targetHeightPx: number;
  scale: number;
  onFileChange: (file: File | null) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [natural, setNatural] = useState<{ width: number; height: number } | null>(null);
  const isPdf = isPdfFile(file);

  useEffect(() => {
    setNatural(null);
    if (!file || isPdf) {
      setPreviewUrl(null);
      return;
    }
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file, isPdf]);

  const displayName = file?.name ?? pairedPdfLabel ?? null;

  function handleFiles(files: FileList | null) {
    const f = files?.[0] ?? null;
    if (f) onFileChange(f);
  }

  const quality =
    natural && targetWidthPx > 0 && targetHeightPx > 0
      ? Math.max((targetWidthPx * scale) / natural.width, (targetHeightPx * scale) / natural.height) <= 1
        ? "good"
        : "low"
      : null;

  return (
    <div className="space-y-2">
      {displayName && (
        <div className="flex items-center gap-3 rounded-xl border border-border bg-surface-muted py-2.5 pl-2.5 pr-3">
          {/* Jetons pleins (`*-subtle`) plutôt qu'un modificateur d'opacité
              (`from-accent/40`) : les couleurs du projet sont des variables
              CSS contenant une couleur complète, pas des canaux RGB — le
              modificateur produit du CSS invalide, ignoré par le navigateur
              (même piège que l'encadré d'aide, voir DesignEditor). */}
          <div className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-gradient-to-br from-accent-subtle to-primary-subtle">
            {previewUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={previewUrl}
                alt=""
                className="h-full w-full object-cover"
                onLoad={(e) => {
                  const img = e.currentTarget;
                  if (!img) return;
                  setNatural({ width: img.naturalWidth, height: img.naturalHeight });
                }}
              />
            ) : (
              <ImageIcon className="h-5 w-5 text-primary" />
            )}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-text">{displayName}</p>
            {quality && (
              <p
                className={`mt-0.5 flex items-center gap-1.5 text-xs ${
                  quality === "good" ? "text-success" : "text-warning"
                }`}
              >
                <span className={`h-1.5 w-1.5 rounded-full ${quality === "good" ? "bg-success" : "bg-warning"}`} />
                {quality === "good" ? "Excellente qualité" : "Résolution un peu faible"}
              </p>
            )}
          </div>
          {/* Plus de bouton « Remplacer » séparé : cliquer/glisser sur la
              zone de dépôt juste en dessous fait déjà ça. Seulement « ✕ »
              pour retirer — seulement si CE côté a son propre fichier (pas
              pour le simple rappel « Page N du PDF (recto) » — rien à
              retirer de ce côté dans ce cas, voir pairedPdfLabel). */}
          {file && (
            <button
              type="button"
              onClick={() => onFileChange(null)}
              aria-label="Retirer l'image"
              title="Retirer l'image"
              className="shrink-0 text-text-subtle hover:text-danger"
            >
              <XIcon className="h-4 w-4" />
            </button>
          )}
        </div>
      )}

      <div
        onDragOver={(e) => {
          if (!e.dataTransfer.types.includes("Files")) return;
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          if (e.dataTransfer.files.length === 0) return;
          e.preventDefault();
          setDragOver(false);
          handleFiles(e.dataTransfer.files);
        }}
        onClick={() => inputRef.current?.click()}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            inputRef.current?.click();
          }
        }}
        className={`flex cursor-pointer items-center justify-center gap-2.5 rounded-xl border-2 border-dashed px-4 py-4 text-center transition-colors ${
          dragOver ? "border-primary bg-primary-subtle" : "border-border-strong bg-surface hover:border-text-subtle"
        }`}
      >
        <UploadIcon className="h-4 w-4 shrink-0 text-text-subtle" />
        <span className="text-sm font-medium text-text-subtle">Glisse un fichier ou parcours</span>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/*,application/pdf"
        className="hidden"
        onChange={(e) => {
          handleFiles(e.target.files);
          e.target.value = "";
        }}
      />
    </div>
  );
}
