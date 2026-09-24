"use client";

import { useEffect, useState } from "react";
import type { ImageSourceValue } from "@/components/ImageSourcePicker";
import type { Category, Sku, Template } from "@/lib/types";
import { SpinnerIcon } from "@/components/icons";
import { layerImageFieldName, type DesignLayer } from "@/lib/design/layers";

// Ajoute les calques d'un côté au formulaire : un champ JSON (métadonnées
// seulement — un fichier n'est pas sérialisable en JSON) et, pour chaque
// calque image, son fichier dans son propre champ (voir layerImageFieldName)
// — lu par lib/pdf/layers.ts (`resolveLayersFromForm`) côté serveur.
function appendLayersToForm(body: FormData, side: "front" | "back", layers: DesignLayer[]) {
  const descriptors = layers.map((l) =>
    // Seul le calque image porte un `file` (non sérialisable en JSON) à
    // retirer — texte et forme passent tels quels.
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

interface GeneratedPdf {
  url: string;
  filename: string;
}

interface MockupState {
  loading: boolean;
  url: string | null;
}

/**
 * Étape 5 de Design Shopify : résumé. Récapitule la catégorie, le modèle
 * (avec son SKU, si le modèle en a un) et génère (au montage) le PDF
 * prêt-pour-impression final — recto + verso dans un seul fichier, à pleine
 * résolution, fond perdu compris — via /api/design/pdf (route dédiée,
 * distincte de /api/products/preview qui ne sert qu'aux aperçus PNG à
 * l'écran). Le nom du fichier (avec le SKU s'il y en a un) est affiché ici
 * comme info, et repris tel quel au téléchargement.
 *
 * En parallèle, un mockup par côté (recto, et verso si le modèle est
 * recto-verso — un appel /api/design/mockup chacun, avec `side`) : si le
 * modèle a un bundle mockup (beauty shot ou masque/ombrage, voir
 * TemplateForm), un aperçu réaliste façon photo produit — même rendu que le
 * mockup des vrais Produits (`/api/products/[id]/mockup`), mais sans passer
 * par un Produit (toujours recto seul, ces modèles n'ont pas de verso) ;
 * sinon (typiquement la papeterie), un mockup générique — le visuel de ce
 * côté à sa dimension finale avec une ombre portée (voir
 * generateStationeryMockupPng). Deux rendus distincts, plutôt qu'un seul
 * composite, pour que chaque côté reste grand et clairement identifié.
 *
 * Rien n'est enregistré dans Pico Design : « Recommencer » repart de zéro.
 */
export default function DesignSummary({
  category,
  template,
  skus,
  rotated,
  front,
  back,
  frontLayers,
  backLayers,
  backFromPdf,
  onBack,
  onRestart,
}: {
  category: Category;
  // Déjà orienté (voir applyOrientation dans DesignTool) — `rotated` est
  // quand même nécessaire à part : le serveur repart du modèle brut (fetch
  // par templateId) et réapplique la rotation lui-même.
  template: Template;
  skus: Sku[];
  rotated: boolean;
  front: ImageSourceValue;
  back: ImageSourceValue;
  frontLayers: DesignLayer[];
  backLayers: DesignLayer[];
  backFromPdf: { file: File; page: number } | null;
  onBack: () => void;
  onRestart: () => void;
}) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pdf, setPdf] = useState<GeneratedPdf | null>(null);
  const [frontMockup, setFrontMockup] = useState<MockupState>({ loading: true, url: null });
  const [backMockup, setBackMockup] = useState<MockupState>({ loading: template.two_sided, url: null });

  const sku = skus.find((s) => s.id === template.sku_id) ?? null;

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    (async () => {
      try {
        // Outil Shopify : source visuel toujours "upload" (voir DesignPreview,
        // sourceModes={["upload"]}) — on envoie directement les fichiers, pas
        // besoin de gérer les branches "visuel de la banque".
        const body = new FormData();
        body.append("templateId", template.id);
        body.append("rotated", String(rotated));
        if (front.file) body.append("image", front.file);
        body.append("pdfPage", "1");
        body.append("positionX", String(front.positionX));
        body.append("positionY", String(front.positionY));
        body.append("zoom", String(front.scale ?? 1));
        body.append("imageRotation", String(front.rotation ?? 0));
        appendLayersToForm(body, "front", frontLayers);
        if (template.two_sided) {
          if (backFromPdf) {
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

  // Un mockup par côté (voir le commentaire du composant) : même fonction
  // pour le recto et le verso, appelée une fois chacun ci-dessous.
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
        const file = pdfOverride?.file ?? value.file;
        // Rien à montrer pour ce côté (ni visuel, ni calque) — au moins l'un
        // des deux suffit (voir DesignTool, frontReady/backReady) : un
        // montage fait seulement de calques reste un design valide.
        if (!file && sideLayers.length === 0) {
          setState({ loading: false, url: null });
          return;
        }
        const body = new FormData();
        body.append("templateId", template.id);
        body.append("rotated", String(rotated));
        body.append("side", side);
        if (file) body.append("image", file);
        body.append("pdfPage", String(pdfOverride?.page ?? 1));
        body.append("positionX", String(value.positionX));
        body.append("positionY", String(value.positionY));
        body.append("zoom", String(value.scale ?? 1));
        body.append("imageRotation", String(value.rotation ?? 0));
        appendLayersToForm(body, side, sideLayers);

        const res = await fetch("/api/design/mockup", { method: "POST", body });
        // 204 : ce côté n'a pas de mockup à montrer (modèle à bundle réaliste
        // pour le verso, ou modèle recto seul) — pas une erreur.
        if (res.status === 204 || !res.ok) {
          setState({ loading: false, url: null });
          return;
        }
        const blob = await res.blob();
        setState({ loading: false, url: URL.createObjectURL(blob) });
      } catch {
        // Le mockup est une touche en plus, pas critique : un échec n'empêche
        // pas de récupérer son PDF, on masque juste ce côté.
        setState({ loading: false, url: null });
      }
    }

    fetchMockup("front", front, frontLayers);
    if (template.two_sided) fetchMockup("back", back, backLayers, backFromPdf ?? undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const hasMockupColumn = frontMockup.loading || frontMockup.url || backMockup.loading || backMockup.url;

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-text-subtle">
            {category.name} — {template.name}
          </p>
          <h2 className="font-heading text-xl font-semibold text-text">Ton design</h2>
        </div>
        <button
          type="button"
          onClick={onBack}
          className="rounded-lg border border-border px-4 py-2 text-sm text-text-muted hover:bg-surface-muted"
        >
          Modifier
        </button>
      </div>

      {/* Le mockup n'a sa colonne que s'il y en a au moins un (ou en cours de
          chargement) — un modèle sans bundle mockup garde le résumé seul,
          centré, plutôt qu'une colonne vide à droite. Sur mobile, le(s)
          visuel(s) passent avant le résumé (`order-1`) malgré l'ordre du DOM
          (résumé d'abord, pour qu'il reste à gauche en rendu naturel sur
          grand écran sans dépendre de `order` là aussi). */}
      <div className={hasMockupColumn ? "grid gap-8 lg:grid-cols-2 lg:items-start" : "mx-auto max-w-xl"}>
        <div className="order-2 space-y-6 lg:order-none">
          <dl className="grid gap-4 rounded-2xl border border-border bg-surface p-5 text-sm sm:grid-cols-3 lg:grid-cols-1">
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
            <div className="flex items-center justify-center gap-2 rounded-2xl border border-border bg-surface p-12 text-text-muted">
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
          <div className="order-1 flex flex-wrap justify-center gap-4 lg:order-none">
            <MockupCard label="Recto" state={frontMockup} templateName={template.name} />
            {template.two_sided && <MockupCard label="Verso" state={backMockup} templateName={template.name} />}
          </div>
        )}
      </div>

      <div className="flex justify-center border-t border-border pt-6">
        <button
          type="button"
          onClick={onRestart}
          className="rounded-lg border border-border px-4 py-2 text-sm text-text-muted hover:bg-surface-muted"
        >
          Recommencer un nouveau design
        </button>
      </div>
    </div>
  );
}

// Une carte de mockup (recto ou verso) : légendée dès qu'il y en a deux à
// l'écran (un seul modèle, sur les deux — voir le rendu — n'affiche que
// "Recto"). Rien n'est rendu tant que ce côté n'a ni mockup ni chargement
// en cours (ex. verso d'un modèle à bundle réaliste, toujours recto seul).
function MockupCard({ label, state, templateName }: { label: string; state: MockupState; templateName: string }) {
  if (!state.loading && !state.url) return null;
  return (
    <figure className="w-full max-w-xs">
      <figcaption className="mb-1 text-center text-sm font-medium text-text">{label}</figcaption>
      {state.loading ? (
        <div className="flex aspect-square items-center justify-center gap-2 rounded-2xl border border-border bg-surface p-8 text-text-muted">
          <SpinnerIcon className="h-5 w-5" />
        </div>
      ) : (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={state.url ?? undefined}
          alt={`${label} — ${templateName}`}
          className="max-h-72 w-auto max-w-full rounded-2xl border border-border bg-surface shadow-sm"
        />
      )}
    </figure>
  );
}
