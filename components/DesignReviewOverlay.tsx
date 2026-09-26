"use client";

import { useEffect, useState } from "react";
import type { ImageSourceValue } from "@/components/ImageSourcePicker";
import type { ThemeWithOverlayUrl } from "@/components/ThemesTable";
import type { Category, Sku, Template } from "@/lib/types";
import { ExpandIcon, SpinnerIcon, XIcon } from "@/components/icons";
import { layerImageFieldName, type DesignLayer } from "@/lib/design/layers";

// Ajoute les calques d'un côté au formulaire : un champ JSON (métadonnées
// seulement — un fichier n'est pas sérialisable en JSON) et, pour chaque
// calque image, son fichier dans son propre champ (voir layerImageFieldName)
// — lu par lib/pdf/layers.ts (`resolveLayersFromForm`) côté serveur.
function appendLayersToForm(body: FormData, side: "front" | "back", layers: DesignLayer[]) {
  const descriptors = layers.map((l) =>
    l.type === "image"
      ? {
          id: l.id,
          type: l.type,
          widthRatio: l.widthRatio,
          positionX: l.positionX,
          positionY: l.positionY,
          rotationDeg: l.rotationDeg,
          opacity: l.opacity,
          blendMode: l.blendMode,
        }
      : l
  );
  body.append(`${side}Layers`, JSON.stringify(descriptors));
  for (const l of layers) {
    if (l.type === "image" && l.file) body.append(layerImageFieldName(side, l.id), l.file);
  }
}

function appendMosaicToForm(
  body: FormData,
  value: ImageSourceValue,
  mosaicGrid: { cols: number; rows: number },
  backPrefixed: boolean
) {
  body.append(backPrefixed ? "backMosaicCols" : "mosaicCols", String(mosaicGrid.cols));
  body.append(backPrefixed ? "backMosaicRows" : "mosaicRows", String(mosaicGrid.rows));
  (value.mosaicFiles ?? []).forEach((f, i) => {
    if (f) body.append(backPrefixed ? `backMosaicCell${i}` : `mosaicCell${i}`, f);
  });
}

function appendThemeToForm(body: FormData, value: ImageSourceValue, themeId: string) {
  body.append("themeId", themeId);
  (value.themeSlotFiles ?? []).forEach((f, i) => {
    if (f) body.append(`themeSlot${i}`, f);
  });
  if (value.themeSlotAdjust) body.append("themeSlotAdjust", JSON.stringify(value.themeSlotAdjust));
}

interface GeneratedPdf {
  url: string;
  filename: string;
}

interface MockupState {
  loading: boolean;
  url: string | null;
}

/**
 * Overlay « Vérifier et commander » : remplace l'ancienne étape séparée
 * Résumé (DesignSummary.tsx, supprimé) — même logique de génération (au
 * montage, un PDF prêt-pour-impression via /api/design/pdf, et un mockup par
 * côté via /api/design/mockup), affichée par-dessus DesignEditor plutôt que
 * dans un écran séparé (l'Outil Shopify reste un seul écran, voir
 * DesignTool.tsx). `onClose` revient à l'éditeur sans perdre l'état ;
 * `onRestart` revient au choix de modèle.
 *
 * Pas de prix affiché : aucune vraie donnée de prix (Sku n'en a pas) ni
 * d'intégration commande/panier Shopify — hors de portée, voir le plan.
 */
export default function DesignReviewOverlay({
  category,
  template,
  skus,
  rotated,
  front,
  back,
  frontLayers,
  backLayers,
  backFromPdf,
  mosaicGrid,
  selectedTheme,
  onClose,
  onRestart,
}: {
  category: Category;
  template: Template;
  skus: Sku[];
  rotated: boolean;
  front: ImageSourceValue;
  back: ImageSourceValue;
  frontLayers: DesignLayer[];
  backLayers: DesignLayer[];
  backFromPdf: { file: File; page: number } | null;
  mosaicGrid: { cols: number; rows: number };
  selectedTheme: ThemeWithOverlayUrl | null;
  onClose: () => void;
  onRestart: () => void;
}) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pdf, setPdf] = useState<GeneratedPdf | null>(null);
  const [frontMockup, setFrontMockup] = useState<MockupState>({ loading: true, url: null });
  const [backMockup, setBackMockup] = useState<MockupState>({ loading: template.two_sided, url: null });
  // Mockup affiché en grand (plein écran) — cliquer une vignette l'ouvre,
  // Échap/clic la referme. Le mockup est l'élément qu'on vient vraiment
  // regarder dans ce résumé : il doit pouvoir être inspecté de près.
  const [zoomed, setZoomed] = useState<{ url: string; label: string } | null>(null);

  const sku = skus.find((s) => s.id === template.sku_id) ?? null;

  useEffect(() => {
    if (!zoomed) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setZoomed(null);
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [zoomed]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    (async () => {
      try {
        const body = new FormData();
        body.append("templateId", template.id);
        body.append("rotated", String(rotated));
        if (front.sourceMode === "theme" && selectedTheme) {
          appendThemeToForm(body, front, selectedTheme.id);
        } else if (front.sourceMode === "mosaic") {
          appendMosaicToForm(body, front, mosaicGrid, false);
        } else if (front.file) {
          body.append("image", front.file);
        }
        body.append("pdfPage", "1");
        body.append("positionX", String(front.positionX));
        body.append("positionY", String(front.positionY));
        body.append("zoom", String(front.scale ?? 1));
        body.append("imageRotation", String(front.rotation ?? 0));
        appendLayersToForm(body, "front", frontLayers);
        if (template.two_sided) {
          if (back.sourceMode === "mosaic") {
            appendMosaicToForm(body, back, mosaicGrid, true);
          } else if (backFromPdf) {
            body.append("backImage", backFromPdf.file);
            body.append("backPdfPage", String(backFromPdf.page));
          } else if (back.file) {
            body.append("backImage", back.file);
            body.append("backPdfPage", "1");
          }
          body.append("backPositionX", String(back.positionX));
          body.append("backPositionY", String(back.positionY));
          body.append("backZoom", String(back.scale ?? 1));
          body.append("backImageRotation", String(back.rotation ?? 0));
          appendLayersToForm(body, "back", backLayers);
        }

        const res = await fetch("/api/design/pdf", { method: "POST", body });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error ?? "Erreur lors de la génération du PDF.");
        }
        const blob = await res.blob();
        const disposition = res.headers.get("Content-Disposition") ?? "";
        const filename = disposition.match(/filename="([^"]+)"/)?.[1] ?? `${template.name}.pdf`;
        if (!cancelled) setPdf({ url: URL.createObjectURL(blob), filename });
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Erreur lors de la génération du design.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    async function fetchMockup(
      side: "front" | "back",
      value: ImageSourceValue,
      sideLayers: DesignLayer[],
      pdfOverride?: { file: File; page: number }
    ) {
      const setState = side === "front" ? setFrontMockup : setBackMockup;
      setState({ loading: true, url: null });
      try {
        const isMosaic = value.sourceMode === "mosaic";
        const isTheme = value.sourceMode === "theme" && Boolean(selectedTheme);
        const file = pdfOverride?.file ?? value.file;
        const hasMosaicFile = isMosaic && (value.mosaicFiles ?? []).some(Boolean);
        if (!file && !hasMosaicFile && !isTheme && sideLayers.length === 0) {
          setState({ loading: false, url: null });
          return;
        }
        const body = new FormData();
        body.append("templateId", template.id);
        body.append("rotated", String(rotated));
        body.append("side", side);
        if (isTheme && selectedTheme) {
          appendThemeToForm(body, value, selectedTheme.id);
        } else if (isMosaic) {
          appendMosaicToForm(body, value, mosaicGrid, false);
        } else if (file) {
          body.append("image", file);
        }
        body.append("pdfPage", String(pdfOverride?.page ?? 1));
        body.append("positionX", String(value.positionX));
        body.append("positionY", String(value.positionY));
        body.append("zoom", String(value.scale ?? 1));
        body.append("imageRotation", String(value.rotation ?? 0));
        appendLayersToForm(body, side, sideLayers);

        const res = await fetch("/api/design/mockup", { method: "POST", body });
        if (res.status === 204 || !res.ok) {
          setState({ loading: false, url: null });
          return;
        }
        const blob = await res.blob();
        setState({ loading: false, url: URL.createObjectURL(blob) });
      } catch {
        setState({ loading: false, url: null });
      }
    }

    fetchMockup("front", front, frontLayers);
    if (template.two_sided) fetchMockup("back", back, backLayers, backFromPdf ?? undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const hasMockupColumn = frontMockup.loading || frontMockup.url || backMockup.loading || backMockup.url;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="max-h-[90vh] w-full max-w-5xl overflow-y-auto rounded-2xl bg-surface p-6 shadow-lg sm:p-8">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-text-subtle">
              {category.name} — {template.name}
            </p>
            <h2 className="font-heading text-xl font-semibold text-text">Ton design</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fermer et revenir à l'éditeur"
            className="rounded-lg border border-border p-2 text-text-muted hover:bg-surface-muted"
          >
            <XIcon className="h-5 w-5" />
          </button>
        </div>

        {/* Le(s) mockup(s) sont l'élément principal du résumé : ils prennent
            toute la place restante (colonne de détails fixée à ~300px),
            plutôt qu'une moitié chacun comme avant. */}
        <div
          className={`mt-8 ${
            hasMockupColumn
              ? "grid gap-8 lg:grid-cols-[minmax(0,300px)_minmax(0,1fr)] lg:items-start"
              : "mx-auto max-w-xl"
          }`}
        >
          <div className="order-2 space-y-6 lg:order-none">
            <dl className="grid gap-4 rounded-2xl border border-border bg-surface-muted p-5 text-sm sm:grid-cols-3 lg:grid-cols-1">
              <div>
                <dt className="text-text-subtle">Modèle</dt>
                <dd className="mt-0.5 font-medium text-text">{template.name}</dd>
              </div>
              <div>
                <dt className="text-text-subtle">SKU</dt>
                <dd className="mt-0.5 font-medium text-text">{sku?.sku ?? "—"}</dd>
              </div>
              <div>
                <dt className="text-text-subtle">Fichier PDF</dt>
                <dd className="mt-0.5 break-all font-medium text-text">{pdf?.filename ?? (loading ? "…" : "—")}</dd>
              </div>
            </dl>

            {loading && (
              <div className="flex items-center justify-center gap-2 rounded-2xl border border-border p-12 text-text-muted">
                <SpinnerIcon className="h-5 w-5" />
                Préparation de ton PDF...
              </div>
            )}
            {error && <p className="text-sm text-danger">{error}</p>}

            {pdf && (
              <div className="flex justify-center lg:justify-start">
                <a
                  href={pdf.url}
                  download={pdf.filename}
                  className="inline-flex items-center justify-center rounded-full bg-primary px-6 py-3 text-sm font-medium text-text-on-brand hover:bg-primary-hover"
                >
                  Télécharger le PDF
                </a>
              </div>
            )}
          </div>

          {hasMockupColumn && (
            <div className="order-1 flex flex-wrap items-start justify-center gap-4 lg:order-none">
              <MockupCard
                label="Recto"
                state={frontMockup}
                templateName={template.name}
                onZoom={(url) => setZoomed({ url, label: "Recto" })}
              />
              {template.two_sided && (
                <MockupCard
                  label="Verso"
                  state={backMockup}
                  templateName={template.name}
                  onZoom={(url) => setZoomed({ url, label: "Verso" })}
                />
              )}
            </div>
          )}
        </div>

        <div className="mt-8 flex justify-center gap-3 border-t border-border pt-6">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-border px-4 py-2 text-sm text-text-muted hover:bg-surface-muted"
          >
            Continuer à modifier
          </button>
          <button
            type="button"
            onClick={onRestart}
            className="rounded-lg border border-border px-4 py-2 text-sm text-text-muted hover:bg-surface-muted"
          >
            Recommencer un nouveau design
          </button>
        </div>
      </div>

      {/* Mockup en grand — par-dessus la modale de résumé (z plus élevé),
          fermé au clic n'importe où, par le ✕, ou avec Échap (voir l'effet
          plus haut). */}
      {zoomed && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 p-4"
          role="dialog"
          aria-modal="true"
          aria-label={`${zoomed.label} — vue agrandie`}
          onClick={() => setZoomed(null)}
        >
          <button
            type="button"
            onClick={() => setZoomed(null)}
            aria-label="Fermer la vue agrandie"
            className="absolute right-4 top-4 rounded-lg bg-white/10 p-2 text-white hover:bg-white/20"
          >
            <XIcon className="h-5 w-5" />
          </button>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={zoomed.url}
            alt={`${zoomed.label} — vue agrandie`}
            className="max-h-full max-w-full rounded-lg object-contain"
          />
        </div>
      )}
    </div>
  );
}

function MockupCard({
  label,
  state,
  templateName,
  onZoom,
}: {
  label: string;
  state: MockupState;
  templateName: string;
  onZoom: (url: string) => void;
}) {
  if (!state.loading && !state.url) return null;
  return (
    // `flex-1 basis-64` : deux mockups (recto-verso) se partagent la
    // largeur, un seul prend toute celle disponible (jusqu'à max-w-xl) —
    // c'est l'élément principal du résumé, il doit être grand.
    <figure className="w-full min-w-0 flex-1 basis-64 md:max-w-xl">
      <figcaption className="mb-1 text-center text-sm font-medium text-text">{label}</figcaption>
      {state.loading ? (
        <div className="flex aspect-square items-center justify-center gap-2 rounded-2xl border border-border bg-surface-muted p-8 text-text-muted">
          <SpinnerIcon className="h-5 w-5" />
        </div>
      ) : (
        <button
          type="button"
          onClick={() => state.url && onZoom(state.url)}
          aria-label={`Agrandir le mockup ${label.toLowerCase()}`}
          className="group relative mx-auto block cursor-zoom-in"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={state.url ?? undefined}
            alt={`${label} — ${templateName}`}
            className="mx-auto max-h-[55vh] w-auto max-w-full rounded-2xl border border-border bg-surface-muted shadow-sm"
          />
          <span className="pointer-events-none absolute bottom-2 right-2 flex items-center gap-1.5 rounded-full bg-black/55 px-2.5 py-1 text-xs font-medium text-white opacity-0 transition-opacity group-hover:opacity-100">
            <ExpandIcon className="h-3.5 w-3.5" />
            Agrandir
          </span>
        </button>
      )}
    </figure>
  );
}
