"use client";

import { useEffect, useRef, useState } from "react";
import type { LogoShape, Template, VisualMode } from "@/lib/types";
import type { VisualWithUrl } from "@/components/VisualsGrid";
import { mmToIn, inToMm } from "@/lib/pdf/units";
import { SpinnerIcon } from "@/components/icons";

export type SourceMode = "upload" | VisualMode;

export const SOURCE_MODES: { value: SourceMode; label: string }[] = [
  { value: "upload", label: "Uploader une image" },
  { value: "full", label: "Visuel — plein format" },
  { value: "tile", label: "Visuel — mosaïque" },
];

export interface ImageSourceValue {
  sourceMode: SourceMode;
  file: File | null;
  visualId: string;
  tileSizeMm: number;
  positionX: number;
  positionY: number;
}

/**
 * Sélection de la source d'une image de produit (upload ou visuel de la
 * banque, plein format ou mosaïque) + aperçu avec repositionnement par
 * glisser-déposer. Réutilisé pour le recto et le verso (voir ProductForm) :
 * `side`/`logo` distinguent les deux (le verso n'a jamais de logo Pico).
 */
export default function ImageSourcePicker({
  side,
  template,
  visuals,
  value,
  onChange,
  currentImageUrl,
  logo,
  previewUnavailableMessage,
}: {
  side: "front" | "back";
  template: Template | null;
  visuals: VisualWithUrl[];
  value: ImageSourceValue;
  onChange: (patch: Partial<ImageSourceValue>) => void;
  currentImageUrl?: string | null;
  logo: { shape: LogoShape; color: string; secondaryColor: string } | null;
  previewUnavailableMessage?: string;
}) {
  const { sourceMode, file, visualId, tileSizeMm, positionX, positionY } = value;
  const [preview, setPreview] = useState<string | null>(null);

  // Le "cadre" (traits de coupe/sécurité, gabarit, logo) est un calque
  // transparent séparé du fond : il ne bouge jamais pendant le glisser.
  const [frameOverlayUrl, setFrameOverlayUrl] = useState<string | null>(null);
  const [frameLoading, setFrameLoading] = useState(false);
  const [frameError, setFrameError] = useState<string | null>(null);
  const frameTokenRef = useRef(0);

  // Le fond, lui, dépend du mode : en upload/plein format, l'image brute est
  // affichée directement côté client (object-position instantané) ; en
  // mosaïque, le motif recadré doit être rendu côté serveur (débouncé).
  const [tileBackgroundUrl, setTileBackgroundUrl] = useState<string | null>(null);
  const [tileBgLoading, setTileBgLoading] = useState(false);
  const [tileBgError, setTileBgError] = useState<string | null>(null);
  const tileBgTokenRef = useRef(0);

  const previewBoxRef = useRef<HTMLDivElement>(null);
  const draggingRef = useRef(false);
  const lastPointRef = useRef<{ x: number; y: number } | null>(null);
  const [dragOffsetPx, setDragOffsetPx] = useState({ x: 0, y: 0 });

  const hasSource = sourceMode === "upload" ? Boolean(file || currentImageUrl) : Boolean(visualId);
  const canPosition = Boolean(template) && hasSource;

  // Aperçu local du fichier uploadé (aperçu brut sous le champ + fond de
  // l'aperçu positionnable).
  useEffect(() => {
    if (!file) {
      setPreview(null);
      return;
    }
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  useEffect(() => {
    if (!template) {
      setFrameOverlayUrl((old) => {
        if (old) URL.revokeObjectURL(old);
        return null;
      });
      setFrameError(null);
      return;
    }

    const token = ++frameTokenRef.current;
    const timeout = setTimeout(async () => {
      setFrameLoading(true);
      setFrameError(null);

      const formData = new FormData();
      formData.append("templateId", template.id);
      formData.append("mode", "frame");
      formData.append("side", side);
      if (logo) {
        formData.append("logoShape", logo.shape);
        formData.append("logoColor", logo.color);
        formData.append("logoSecondaryColor", logo.secondaryColor);
      }

      const res = await fetch("/api/products/preview", { method: "POST", body: formData });
      if (token !== frameTokenRef.current) return;

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setFrameError(data.error ?? "Erreur lors de la génération du cadre.");
        setFrameLoading(false);
        return;
      }
      const blob = await res.blob();
      setFrameOverlayUrl((old) => {
        if (old) URL.revokeObjectURL(old);
        return URL.createObjectURL(blob);
      });
      setFrameLoading(false);
    }, 150);

    return () => clearTimeout(timeout);
  }, [template, side, logo?.shape, logo?.color, logo?.secondaryColor]);

  useEffect(() => {
    return () => {
      if (frameOverlayUrl) URL.revokeObjectURL(frameOverlayUrl);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (sourceMode !== "tile" || !canPosition || !template) {
      setTileBackgroundUrl((old) => {
        if (old) URL.revokeObjectURL(old);
        return null;
      });
      setTileBgError(null);
      return;
    }

    const token = ++tileBgTokenRef.current;
    const timeout = setTimeout(async () => {
      setTileBgLoading(true);
      setTileBgError(null);

      const formData = new FormData();
      formData.append("templateId", template.id);
      formData.append("visualId", visualId);
      formData.append("visualMode", "tile");
      formData.append("tileSizeMm", String(tileSizeMm));
      formData.append("positionX", String(positionX));
      formData.append("positionY", String(positionY));
      formData.append("mode", "background");

      const res = await fetch("/api/products/preview", { method: "POST", body: formData });
      if (token !== tileBgTokenRef.current) return;

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setTileBgError(data.error ?? "Erreur lors de la génération de l'aperçu.");
        setTileBgLoading(false);
        return;
      }
      const blob = await res.blob();
      setTileBackgroundUrl((old) => {
        if (old) URL.revokeObjectURL(old);
        return URL.createObjectURL(blob);
      });
      setTileBgLoading(false);
    }, 400);

    return () => clearTimeout(timeout);
  }, [sourceMode, canPosition, template, visualId, tileSizeMm, positionX, positionY]);

  useEffect(() => {
    return () => {
      if (tileBackgroundUrl) URL.revokeObjectURL(tileBackgroundUrl);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    setDragOffsetPx({ x: 0, y: 0 });
  }, [tileBackgroundUrl]);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0] ?? null;
    onChange({ file: f, positionX: 0.5, positionY: 0.5 });
  }

  function handleVisualChange(id: string) {
    onChange({ visualId: id, positionX: 0.5, positionY: 0.5 });
  }

  function recenter() {
    onChange({ positionX: 0.5, positionY: 0.5 });
    setDragOffsetPx({ x: 0, y: 0 });
  }

  function handlePointerDown(e: React.PointerEvent<HTMLDivElement>) {
    draggingRef.current = true;
    lastPointRef.current = { x: e.clientX, y: e.clientY };
    e.currentTarget.setPointerCapture(e.pointerId);
  }

  function handlePointerMove(e: React.PointerEvent<HTMLDivElement>) {
    if (!draggingRef.current || !lastPointRef.current || !previewBoxRef.current) return;
    const rect = previewBoxRef.current.getBoundingClientRect();
    const dxPx = e.clientX - lastPointRef.current.x;
    const dyPx = e.clientY - lastPointRef.current.y;
    lastPointRef.current = { x: e.clientX, y: e.clientY };
    setDragOffsetPx((o) => ({ x: o.x + dxPx, y: o.y + dyPx }));
    const dx = dxPx / rect.width;
    const dy = dyPx / rect.height;
    onChange({
      positionX: Math.min(1, Math.max(0, positionX - dx)),
      positionY: Math.min(1, Math.max(0, positionY - dy)),
    });
  }

  function handlePointerUp() {
    draggingRef.current = false;
    lastPointRef.current = null;
  }

  const pageAspectRatio = template
    ? (template.width_mm + template.bleed_mm * 2) / (template.height_mm + template.bleed_mm * 2)
    : 1;
  const selectedVisual = visuals.find((v) => v.id === visualId) ?? null;
  const rawBackgroundUrl =
    sourceMode === "upload"
      ? preview ?? currentImageUrl ?? null
      : sourceMode === "full"
      ? selectedVisual?.fileUrl ?? null
      : null;
  const backgroundUrl = sourceMode === "tile" ? tileBackgroundUrl : rawBackgroundUrl;
  const previewLoading = frameLoading || (sourceMode === "tile" && tileBgLoading);
  const previewError = frameError ?? (sourceMode === "tile" ? tileBgError : null);

  return (
    <div className="space-y-4">
      <div>
        <label className="mb-1 block text-sm font-medium">Source de l&apos;image</label>
        <div className="flex rounded-lg border border-neutral-300 p-0.5 text-sm">
          {SOURCE_MODES.map((m) => (
            <button
              key={m.value}
              type="button"
              onClick={() => onChange({ sourceMode: m.value, positionX: 0.5, positionY: 0.5 })}
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
            Image {currentImageUrl ? "(laisser vide pour garder l'actuelle)" : ""}
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
              onChange={(e) => handleVisualChange(e.target.value)}
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
                onChange={(e) => onChange({ tileSizeMm: inToMm(parseFloat(e.target.value) || 0.01) })}
                className="mt-1 w-full rounded border border-neutral-300 px-3 py-2"
              />
            </div>
          )}
        </div>
      )}

      <div>
        <div className="flex items-center justify-between gap-2">
          <label className="flex items-center gap-2 text-sm font-medium">
            Aperçu
            {previewLoading && (
              <span className="inline-flex items-center gap-1 text-xs font-normal text-neutral-400">
                <SpinnerIcon className="h-3.5 w-3.5" /> génération...
              </span>
            )}
          </label>
          {canPosition && (
            <button
              type="button"
              onClick={recenter}
              className="text-xs text-neutral-500 underline hover:text-pico-black"
            >
              Recentrer
            </button>
          )}
        </div>
        {previewError && <p className="mt-1 text-sm text-red-600">{previewError}</p>}
        {canPosition ? (
          <div className="mt-2 rounded-lg border border-neutral-200 bg-neutral-50 p-3">
            <div
              ref={previewBoxRef}
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              onPointerLeave={handlePointerUp}
              className="relative mx-auto w-full max-w-xs touch-none select-none overflow-hidden rounded border border-neutral-200 bg-neutral-200 cursor-grab active:cursor-grabbing"
              style={{ aspectRatio: String(pageAspectRatio) }}
            >
              {/* Fond : bouge pendant le glisser, le cadre (ci-dessous) reste fixe. */}
              {backgroundUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={backgroundUrl}
                  alt=""
                  draggable={false}
                  className="absolute inset-0 h-full w-full object-cover"
                  style={
                    sourceMode === "tile"
                      ? { transform: `translate(${dragOffsetPx.x}px, ${dragOffsetPx.y}px)` }
                      : { objectPosition: `${positionX * 100}% ${positionY * 100}%` }
                  }
                />
              )}
              {/* Cadre : traits de coupe/sécurité + gabarit + logo, fond transparent, jamais déplacé. */}
              {frameOverlayUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={frameOverlayUrl}
                  alt="Aperçu"
                  draggable={false}
                  className="pointer-events-none absolute inset-0 h-full w-full"
                />
              )}
            </div>
            <p className="mt-2 text-center text-xs text-neutral-500">
              Ligne magenta = coupe (fond perdu) · pointillés bleus = marge de protection · glisse
              l&apos;image pour la repositionner.
            </p>
          </div>
        ) : (
          !previewError && (
            <p className="mt-1 text-xs text-neutral-500">
              {!template
                ? previewUnavailableMessage ?? "Choisis un modèle pour voir l'aperçu."
                : sourceMode === "upload"
                ? "Choisis une image pour voir l'aperçu."
                : "Choisis un visuel pour voir l'aperçu."}
            </p>
          )
        )}
      </div>
    </div>
  );
}
