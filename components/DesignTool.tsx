"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import CategoryPicker from "@/components/CategoryPicker";
import TemplatePicker from "@/components/TemplatePicker";
import DesignPreview from "@/components/DesignPreview";
import DesignSummary from "@/components/DesignSummary";
import { DEFAULT_TILE_SIZE_MM, isPdfFile, type ImageSourceValue } from "@/components/ImageSourcePicker";
import type { VisualWithUrl } from "@/components/VisualsGrid";
import type { Category, Sku, Template } from "@/lib/types";
import { pdfPageCount, planPdfPages } from "@/lib/pdf/pdfPages";
import { applyOrientation } from "@/lib/pdf/orientation";
import type { DesignLayer } from "@/lib/design/layers";

const STEPS = [
  { n: 1, label: "Catégorie" },
  { n: 2, label: "Modèle" },
  { n: 3, label: "Design" },
  { n: 4, label: "Résumé" },
] as const;

const emptySource = (visuals: VisualWithUrl[]): ImageSourceValue => ({
  sourceMode: "upload",
  file: null,
  visualId: visuals[0]?.id ?? "",
  tileSizeMm: DEFAULT_TILE_SIZE_MM,
  positionX: 0.5,
  positionY: 0.5,
});

/**
 * Design Shopify (/design) : outil en quatre étapes pour préparer un design
 * personnalisé sur un de nos modèles — catégorie, modèle, design (choix du
 * visuel, repères, zoom et calques, tout dans la même étape), résumé
 * (aperçu final + téléchargement). Ne crée rien dans Pico Design (pas de
 * Produit).
 *
 * L'étape « Design » regroupait à l'origine deux étapes séparées (choisir le
 * visuel, puis l'ajuster) — fusionnées en une seule : DesignPreview reçoit
 * directement front/back et gère aussi bien le choix du fichier que son
 * cadrage (voir sa section « Visuel »), plutôt que deux composants avec un
 * aller-retour entre eux.
 *
 * Page sans le chrome admin (voir AppShell.tsx) : son propre en-tête, dans
 * le ton et les couleurs de la boutique (picolabo.ca) plutôt que celui de
 * l'administration Pico Design.
 *
 * Le recto/verso (ImageSourceValue) est possédé ici, pas dans l'étape : elle
 * ajuste l'état déjà possédé ici plutôt qu'un état déconnecté.
 */
export default function DesignTool({
  templates,
  categories,
  skus,
  visuals,
}: {
  templates: Template[];
  categories: Category[];
  skus: Sku[];
  visuals: VisualWithUrl[];
}) {
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const [category, setCategory] = useState<Category | null>(null);
  const [template, setTemplate] = useState<Template | null>(null);
  // Portrait/Paysage — seulement quand le modèle le permet (allow_orientation_change).
  const [rotated, setRotated] = useState(false);
  const [front, setFront] = useState<ImageSourceValue>(() => emptySource(visuals));
  const [back, setBack] = useState<ImageSourceValue>(() => emptySource(visuals));
  // Calques additionnels (texte/image), un tableau ordonné par côté — voir
  // lib/design/layers.ts. Possédés ici comme front/back : l'étape 4 continue
  // d'ajuster ce que l'étape précédente a laissé, pas un état déconnecté.
  const [frontLayers, setFrontLayers] = useState<DesignLayer[]>([]);
  const [backLayers, setBackLayers] = useState<DesignLayer[]>([]);

  // Modèle avec largeur/hauteur (et marges) inversées si `rotated` — c'est
  // celui-ci qui va aux étapes suivantes (ImageSourcePicker en a besoin pour
  // le bon ratio de page), jamais le modèle brut une fois choisi.
  const effectiveTemplate = template ? applyOrientation(template, rotated) : null;

  function handleSelectCategory(c: Category) {
    setCategory(c);
    setTemplate(null);
    setStep(2);
  }

  function handleSelectTemplate(t: Template) {
    setTemplate(t);
    setRotated(false);
    setFront(emptySource(visuals));
    setBack(emptySource(visuals));
    setFrontLayers([]);
    setBackLayers([]);
    setStep(3);
  }

  function handleRestart() {
    setCategory(null);
    setTemplate(null);
    setRotated(false);
    setFront(emptySource(visuals));
    setBack(emptySource(visuals));
    setFrontLayers([]);
    setBackLayers([]);
    setStep(1);
  }

  // Un PDF de deux pages téléversé pour le recto fournit aussi le verso d'un
  // modèle recto-verso (page 2) — même règle partagée que ProductForm (voir
  // lib/pdf/pdfPages.ts). Calculé ici : utile à l'étape 3 (avis, active
  // "Continuer"), à l'étape 4 (aperçu du verso) et à l'étape 5 (téléchargement).
  const [frontPdfPages, setFrontPdfPages] = useState(1);
  const frontPdf = front.sourceMode === "upload" && isPdfFile(front.file) ? front.file : null;
  useEffect(() => {
    if (!frontPdf) {
      setFrontPdfPages(1);
      return;
    }
    let cancelled = false;
    frontPdf
      .arrayBuffer()
      .then(pdfPageCount)
      .then((n) => {
        if (!cancelled) setFrontPdfPages(n);
      });
    return () => {
      cancelled = true;
    };
  }, [frontPdf]);
  const hasOwnBack = back.sourceMode === "upload" ? Boolean(back.file) : Boolean(back.visualId);
  const pdfPlan =
    frontPdf && template
      ? planPdfPages({ pageCount: frontPdfPages, twoSided: template.two_sided, hasOwnBack: template.two_sided && hasOwnBack })
      : null;
  const backFromPdf = template?.two_sided && pdfPlan?.backPage ? { file: frontPdf!, page: pdfPlan.backPage } : null;

  // Prêt dès qu'il y a un visuel de fond OU au moins un calque — un montage
  // fait seulement de calques (texte/image/forme), sans visuel de fond,
  // reste un design valide (voir ImageSourcePicker, qui affiche un canvas
  // blanc tant qu'aucun visuel n'est choisi).
  const frontHasSource = front.sourceMode === "upload" ? Boolean(front.file) : Boolean(front.visualId);
  const frontReady = frontHasSource || frontLayers.length > 0;
  const backReady = !template?.two_sided || Boolean(backFromPdf) || hasOwnBack || backLayers.length > 0;

  // Étape la plus avancée déjà atteignable avec l'état actuel — sert à
  // permettre de cliquer sur la liste d'étapes pour naviguer directement,
  // sans pouvoir sauter au Résumé sans visuel prêt (le Design, lui, reste
  // atteignable dès qu'un modèle est choisi — c'est justement là qu'on
  // choisit ce visuel).
  const maxStep: 1 | 2 | 3 | 4 = !category ? 1 : !template ? 2 : !frontReady || !backReady ? 3 : 4;

  function goToStep(n: 1 | 2 | 3 | 4) {
    if (n <= maxStep) setStep(n);
  }

  return (
    <div className="min-h-dvh bg-background">
      <header className="page-glow border-b border-border">
        <div className="mx-auto max-w-none px-4 py-8 sm:px-6">
          <Link href="/" className="inline-block">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/pico-noir.svg" alt="Pico" className="h-6 w-auto" />
          </Link>
          <h1 className="mt-4 font-heading text-3xl font-bold text-text sm:text-4xl">Outil Shopify</h1>
          <p className="mt-2 max-w-xl text-text-muted">
            Prépare ton design personnalisé — choisis un modèle, puis place ton visuel.
          </p>

          <ol className="mt-6 flex flex-wrap items-center gap-3 text-sm">
            {STEPS.map((s, i) => {
              const reachable = s.n <= maxStep;
              return (
                <li key={s.n} className="flex items-center gap-3">
                  {i > 0 && <span className="h-px w-6 bg-border" aria-hidden="true" />}
                  <button
                    type="button"
                    onClick={() => goToStep(s.n)}
                    disabled={!reachable}
                    aria-current={step === s.n ? "step" : undefined}
                    className={`flex items-center gap-2 rounded-full ${
                      reachable ? "cursor-pointer hover:opacity-80" : "cursor-not-allowed"
                    }`}
                  >
                    <span
                      className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold ${
                        step >= s.n ? "bg-primary text-text-on-brand" : "bg-surface-muted text-text-subtle"
                      }`}
                    >
                      {s.n}
                    </span>
                    <span className={step >= s.n ? "font-medium text-text" : "text-text-subtle"}>{s.label}</span>
                  </button>
                </li>
              );
            })}
          </ol>
        </div>
      </header>

      <main className="mx-auto max-w-none px-4 py-10 sm:px-6">
        {step === 1 && (
          <CategoryPicker categories={categories} templates={templates} onSelect={handleSelectCategory} />
        )}

        {step === 2 && category && (
          <TemplatePicker
            templates={templates}
            category={category}
            onSelect={handleSelectTemplate}
            onBack={() => setStep(1)}
          />
        )}

        {step === 3 && template && effectiveTemplate && (
          <DesignPreview
            key={template.id}
            template={effectiveTemplate}
            rawTemplate={template}
            rotated={rotated}
            onRotatedChange={setRotated}
            visuals={visuals}
            front={front}
            back={back}
            onChangeFront={(patch) => setFront((f) => ({ ...f, ...patch }))}
            onChangeBack={(patch) => setBack((b) => ({ ...b, ...patch }))}
            frontLayers={frontLayers}
            backLayers={backLayers}
            onChangeFrontLayers={setFrontLayers}
            onChangeBackLayers={setBackLayers}
            backFromPdf={backFromPdf}
            pdfWarning={pdfPlan?.warning ?? null}
            frontReady={frontReady}
            backReady={backReady}
            onBack={() => setStep(2)}
            onNext={() => setStep(4)}
          />
        )}

        {step === 4 && category && effectiveTemplate && (
          <DesignSummary
            category={category}
            template={effectiveTemplate}
            skus={skus}
            rotated={rotated}
            front={front}
            back={back}
            frontLayers={frontLayers}
            backLayers={backLayers}
            backFromPdf={backFromPdf}
            onBack={() => setStep(3)}
            onRestart={handleRestart}
          />
        )}
      </main>
    </div>
  );
}
