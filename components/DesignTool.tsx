"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import CategoryPicker from "@/components/CategoryPicker";
import TemplatePicker from "@/components/TemplatePicker";
import DesignTypePicker from "@/components/DesignTypePicker";
import DesignPreview from "@/components/DesignPreview";
import DesignSummary from "@/components/DesignSummary";
import { DEFAULT_TILE_SIZE_MM, isPdfFile, type ImageSourceValue } from "@/components/ImageSourcePicker";
import type { VisualWithUrl } from "@/components/VisualsGrid";
import type { ThemeWithOverlayUrl } from "@/components/ThemesTable";
import type { Category, Sku, Template } from "@/lib/types";
import { pdfPageCount, planPdfPages } from "@/lib/pdf/pdfPages";
import { applyOrientation } from "@/lib/pdf/orientation";
import type { DesignLayer } from "@/lib/design/layers";

const STEPS = [
  { n: 1, label: "Catégorie" },
  { n: 2, label: "Modèle" },
  { n: 3, label: "Type de design" },
  { n: 4, label: "Design" },
  { n: 5, label: "Résumé" },
] as const;

const DEFAULT_MOSAIC_GRID = { cols: 2, rows: 2 };

const emptySource = (visuals: VisualWithUrl[]): ImageSourceValue => ({
  sourceMode: "upload",
  file: null,
  visualId: visuals[0]?.id ?? "",
  tileSizeMm: DEFAULT_TILE_SIZE_MM,
  positionX: 0.5,
  positionY: 0.5,
  mosaicFiles: [],
  themeSlotFiles: [],
  themeSlotAdjust: [],
  themePhotoBank: [],
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
 * « Type de design » (étape 3, entre Modèle et Design) : une image de fond
 * unique (comportement d'origine, `sourceMode: "upload"`), une mosaïque de
 * plusieurs photos distinctes en grille (`sourceMode: "mosaic"`, voir
 * ImageSourcePicker et lib/pdf/mosaic.ts), ou un Thème — un visuel préfait
 * attribué au modèle, affiché par-dessus 1 à 3 photos du client
 * (`sourceMode: "theme"`, voir lib/pdf/theme.ts) — fait une fois ici puis
 * propagé sur `front`/`back` (leur `sourceMode`) : ni DesignPreview ni
 * DesignSummary n'ont besoin de le connaître autrement qu'au travers de ce
 * champ déjà présent sur chaque valeur. `designTypeChosen` distingue "pas
 * encore choisi" de "single, la valeur par défaut" — sans lui, `maxStep` ne
 * pourrait pas bloquer l'étape Design tant que ce choix n'a pas été fait
 * explicitement.
 *
 * Un Thème étant attribué à UN modèle (jamais aux deux côtés à la fois, un
 * thème n'a qu'un seul graphisme), il ne s'applique qu'au recto — le verso
 * garde son comportement normal (image unique ou blanc), indépendant du
 * choix de thème. `selectedTheme` vit ici (pas dans `front`) car
 * DesignTypePicker et DesignSummary en ont besoin directement (slots, id).
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
  themes,
}: {
  templates: Template[];
  categories: Category[];
  skus: Sku[];
  visuals: VisualWithUrl[];
  themes: ThemeWithOverlayUrl[];
}) {
  const [step, setStep] = useState<1 | 2 | 3 | 4 | 5>(1);
  const [category, setCategory] = useState<Category | null>(null);
  const [template, setTemplate] = useState<Template | null>(null);
  // Portrait/Paysage — seulement quand le modèle le permet (allow_orientation_change).
  const [rotated, setRotated] = useState(false);
  const [front, setFront] = useState<ImageSourceValue>(() => emptySource(visuals));
  const [back, setBack] = useState<ImageSourceValue>(() => emptySource(visuals));
  // Type de design (étape 3) — voir le commentaire du composant.
  const [designType, setDesignType] = useState<"single" | "mosaic" | "theme">("single");
  const [mosaicGrid, setMosaicGrid] = useState(DEFAULT_MOSAIC_GRID);
  const [selectedTheme, setSelectedTheme] = useState<ThemeWithOverlayUrl | null>(null);
  const [designTypeChosen, setDesignTypeChosen] = useState(false);
  // Thèmes attribués au modèle en cours (un thème n'appartient qu'à un seul
  // modèle) — DesignTypePicker ne propose l'option « Thème » que si cette
  // liste n'est pas vide.
  const themesForTemplate = themes.filter((t) => t.template_id === template?.id);
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
    setDesignType("single");
    setMosaicGrid(DEFAULT_MOSAIC_GRID);
    setSelectedTheme(null);
    setDesignTypeChosen(false);
    setStep(3);
  }

  // Propage le choix (une image / mosaïque / thème) sur front (et, pour la
  // mosaïque seulement, sur back aussi — un thème, lui, ne s'applique qu'au
  // recto, voir le commentaire du composant). Repart d'un tableau de
  // cases/emplacements vide (plutôt que de garder d'anciennes cases d'une
  // grille/d'un thème différent) : changer de type de design repart à zéro
  // sur le visuel, comme changer de modèle.
  function handleSelectDesignType(
    type: "single" | "mosaic" | "theme",
    extra?: { grid?: { cols: number; rows: number }; theme?: ThemeWithOverlayUrl }
  ) {
    const nextGrid = extra?.grid ?? mosaicGrid;
    setDesignType(type);
    if (type === "mosaic") setMosaicGrid(nextGrid);
    setSelectedTheme(type === "theme" ? extra?.theme ?? null : null);

    const mosaicCellCount = type === "mosaic" ? nextGrid.cols * nextGrid.rows : 0;
    const themeSlotCount = type === "theme" ? extra?.theme?.slots.length ?? 0 : 0;
    const frontSourceMode = type === "mosaic" ? "mosaic" : type === "theme" ? "theme" : "upload";
    setFront((f) => ({
      ...f,
      sourceMode: frontSourceMode,
      file: null,
      mosaicFiles: Array.from({ length: mosaicCellCount }, () => null),
      themeSlotFiles: Array.from({ length: themeSlotCount }, () => null),
      themeSlotAdjust: Array.from({ length: themeSlotCount }, () => ({ positionX: 0.5, positionY: 0.5, scale: 1 })),
      themePhotoBank: [],
      positionX: 0.5,
      positionY: 0.5,
      scale: undefined,
      rotation: 0,
    }));
    // Le verso n'a pas de notion de thème (voir le commentaire du
    // composant) : seule la mosaïque, qui s'applique aux deux côtés, le
    // fait basculer de mode ; un thème le laisse en upload normal.
    const backSourceMode = type === "mosaic" ? "mosaic" : "upload";
    setBack((b) => ({
      ...b,
      sourceMode: backSourceMode,
      file: null,
      mosaicFiles: type === "mosaic" ? Array.from({ length: mosaicCellCount }, () => null) : [],
      positionX: 0.5,
      positionY: 0.5,
      scale: undefined,
      rotation: 0,
    }));
    setDesignTypeChosen(true);
    setStep(4);
  }

  function handleRestart() {
    setCategory(null);
    setTemplate(null);
    setRotated(false);
    setFront(emptySource(visuals));
    setBack(emptySource(visuals));
    setFrontLayers([]);
    setBackLayers([]);
    setDesignType("single");
    setMosaicGrid(DEFAULT_MOSAIC_GRID);
    setSelectedTheme(null);
    setDesignTypeChosen(false);
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
  // A-t-on un visuel de fond de ce côté ? Selon le mode courant : un fichier
  // (upload), un visuel de banque (full/tile), au moins une case remplie
  // (mosaic) ou au moins un emplacement rempli (theme) — voir
  // ImageSourcePicker/composeMosaicImage/composeThemeImage : une case/un
  // emplacement vide reste simplement blanc, pas besoin que tout soit pris.
  function hasVisualSource(value: ImageSourceValue): boolean {
    if (value.sourceMode === "upload") return Boolean(value.file);
    if (value.sourceMode === "mosaic") return (value.mosaicFiles ?? []).some(Boolean);
    if (value.sourceMode === "theme") return (value.themeSlotFiles ?? []).some(Boolean);
    return Boolean(value.visualId);
  }

  const hasOwnBack = hasVisualSource(back);
  const pdfPlan =
    frontPdf && template
      ? planPdfPages({ pageCount: frontPdfPages, twoSided: template.two_sided, hasOwnBack: template.two_sided && hasOwnBack })
      : null;
  const backFromPdf = template?.two_sided && pdfPlan?.backPage ? { file: frontPdf!, page: pdfPlan.backPage } : null;

  // Prêt dès qu'il y a un visuel de fond OU au moins un calque — un montage
  // fait seulement de calques (texte/image/forme), sans visuel de fond,
  // reste un design valide (voir ImageSourcePicker, qui affiche un canvas
  // blanc tant qu'aucun visuel n'est choisi).
  const frontReady = hasVisualSource(front) || frontLayers.length > 0;
  const backReady = !template?.two_sided || Boolean(backFromPdf) || hasOwnBack || backLayers.length > 0;

  // Étape la plus avancée déjà atteignable avec l'état actuel — sert à
  // permettre de cliquer sur la liste d'étapes pour naviguer directement,
  // sans pouvoir sauter au Résumé sans visuel prêt (le Design, lui, reste
  // atteignable dès qu'un modèle ET un type de design sont choisis — c'est
  // justement là qu'on choisit ce visuel).
  const maxStep: 1 | 2 | 3 | 4 | 5 = !category
    ? 1
    : !template
    ? 2
    : !designTypeChosen
    ? 3
    : !frontReady || !backReady
    ? 4
    : 5;

  function goToStep(n: 1 | 2 | 3 | 4 | 5) {
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

        {step === 3 && template && (
          <DesignTypePicker
            themes={themesForTemplate}
            onSelect={handleSelectDesignType}
            onBack={() => setStep(2)}
          />
        )}

        {step === 4 && template && effectiveTemplate && (
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
            designType={designType}
            mosaicGrid={mosaicGrid}
            selectedTheme={selectedTheme}
            onBack={() => setStep(3)}
            onNext={() => setStep(5)}
          />
        )}

        {step === 5 && category && effectiveTemplate && (
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
            mosaicGrid={mosaicGrid}
            selectedTheme={selectedTheme}
            onBack={() => setStep(4)}
            onRestart={handleRestart}
          />
        )}
      </main>
    </div>
  );
}
