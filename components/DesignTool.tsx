"use client";

import { useEffect, useState } from "react";
import TemplateGallery from "@/components/TemplateGallery";
import DesignEditor from "@/components/DesignEditor";
import DesignReviewOverlay from "@/components/DesignReviewOverlay";
import { useHideChrome } from "@/components/ChromeVisibility";
import { DEFAULT_TILE_SIZE_MM, isPdfFile, type ImageSourceValue } from "@/components/ImageSourcePicker";
import type { VisualWithUrl } from "@/components/VisualsGrid";
import type { ThemeWithOverlayUrl } from "@/components/ThemesTable";
import type { Category, Sku, Template } from "@/lib/types";
import { pdfPageCount, planPdfPages } from "@/lib/pdf/pdfPages";
import { applyOrientation } from "@/lib/pdf/orientation";
import type { DesignLayer } from "@/lib/design/layers";

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
 * Design Shopify (/design) : outil en deux temps pour préparer un design
 * personnalisé sur un de nos modèles — un choix de modèle léger
 * (TemplateGallery), puis un éditeur unique (DesignEditor) qui regroupe le
 * type de design (image/mosaïque/thème), l'ajustement du visuel et les
 * calques, avec « Vérifier et commander » ouvrant un aperçu final en
 * overlay (DesignReviewOverlay) — jamais un écran séparé, l'outil reste un
 * seul écran du début à la fin (voir le plan, refonte suivant le Figma
 * « Éditeur v2 »). Ne crée rien dans Pico Design (pas de Produit).
 *
 * Le type de design (`designType`) était autrefois choisi une seule fois à
 * une étape dédiée (DesignTypePicker, supprimé) ; il vit maintenant
 * directement dans la section Visuel de DesignEditor et reste modifiable en
 * tout temps — plus besoin d'un drapeau "déjà choisi" pour bloquer l'accès à
 * une étape suivante, puisqu'il n'y a plus d'étape suivante séparée.
 *
 * Un Thème étant attribué à UN modèle (jamais aux deux côtés à la fois, un
 * thème n'a qu'un seul graphisme), il ne s'applique qu'au recto — le verso
 * garde son comportement normal (image unique ou blanc), indépendant du
 * choix de thème. `selectedTheme` vit ici (pas dans `front`) car
 * DesignEditor et DesignReviewOverlay en ont besoin directement (slots, id).
 *
 * Chrome admin (Nav, voir AppShell.tsx) : gardé comme les autres modules
 * tant qu'on choisit un modèle (phase "pick") — seul l'éditeur plein écran
 * (phase "editor") le masque, via useHideChrome (voir ChromeVisibility.tsx),
 * le temps d'avoir sa propre barre du haut (DesignEditor).
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
  const [phase, setPhase] = useState<"pick" | "editor">("pick");
  const [category, setCategory] = useState<Category | null>(null);
  const [template, setTemplate] = useState<Template | null>(null);
  const [rotated, setRotated] = useState(false);
  const [front, setFront] = useState<ImageSourceValue>(() => emptySource(visuals));
  const [back, setBack] = useState<ImageSourceValue>(() => emptySource(visuals));
  const [designType, setDesignType] = useState<"single" | "mosaic" | "theme">("single");
  const [mosaicGrid, setMosaicGrid] = useState(DEFAULT_MOSAIC_GRID);
  const [selectedTheme, setSelectedTheme] = useState<ThemeWithOverlayUrl | null>(null);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [frontLayers, setFrontLayers] = useState<DesignLayer[]>([]);
  const [backLayers, setBackLayers] = useState<DesignLayer[]>([]);

  const effectiveTemplate = template ? applyOrientation(template, rotated) : null;
  const themesForTemplate = themes.filter((t) => t.template_id === template?.id);

  function handleSelectTemplate(t: Template, c: Category) {
    setCategory(c);
    setTemplate(t);
    setRotated(false);
    setFront(emptySource(visuals));
    setBack(emptySource(visuals));
    setFrontLayers([]);
    setBackLayers([]);
    setDesignType("single");
    setMosaicGrid(DEFAULT_MOSAIC_GRID);
    setSelectedTheme(null);
    setPhase("editor");
  }

  // Propage le choix (une image / mosaïque / thème) sur front (et, pour la
  // mosaïque seulement, sur back aussi — un thème, lui, ne s'applique qu'au
  // recto, voir le commentaire du composant). Repart d'un tableau de
  // cases/emplacements vide (plutôt que de garder d'anciennes cases d'une
  // grille/d'un thème différent) : changer de type de design repart à zéro
  // sur le visuel, comme changer de modèle.
  // Bascule le type de design (Image/Mosaïque/Thème). Autrefois choisi une
  // seule fois à une étape dédiée (DesignTypePicker), donc systématiquement
  // repartir à zéro sur le visuel n'était pas gênant — c'est maintenant un
  // onglet toujours visible dans DesignEditor, qu'on peut cliquer plusieurs
  // fois par erreur ou pour comparer : tout réinitialiser à chaque clic
  // ferait perdre le travail déjà fait dans un mode dès qu'on le quitte des
  // yeux. `file`/`mosaicFiles`/`themeSlotFiles`/`themePhotoBank` sont des
  // champs INDÉPENDANTS d'ImageSourceValue (un par mode) : on ne touche donc
  // que ceux du mode qu'on rejoint, et seulement s'ils ne correspondent déjà
  // pas à ce qu'on demande (mauvaise taille de grille, thème différent) —
  // jamais ceux des autres modes, qui restent intacts pour un retour
  // ultérieur.
  function handleSelectDesignType(
    type: "single" | "mosaic" | "theme",
    extra?: { grid?: { cols: number; rows: number }; theme?: ThemeWithOverlayUrl }
  ) {
    const nextGrid = extra?.grid ?? mosaicGrid;
    const previousTheme = selectedTheme;
    setDesignType(type);
    if (type === "mosaic") setMosaicGrid(nextGrid);
    setSelectedTheme(type === "theme" ? extra?.theme ?? null : null);

    const mosaicCellCount = type === "mosaic" ? nextGrid.cols * nextGrid.rows : 0;
    const themeSlotCount = type === "theme" ? extra?.theme?.slots.length ?? 0 : 0;
    const sameThemeAsBefore = type === "theme" && previousTheme?.id === extra?.theme?.id;
    const frontSourceMode = type === "mosaic" ? "mosaic" : type === "theme" ? "theme" : "upload";
    setFront((f) => ({
      ...f,
      sourceMode: frontSourceMode,
      mosaicFiles:
        type === "mosaic" && f.mosaicFiles?.length === mosaicCellCount
          ? f.mosaicFiles
          : Array.from({ length: mosaicCellCount }, () => null),
      themeSlotFiles:
        sameThemeAsBefore && f.themeSlotFiles?.length === themeSlotCount
          ? f.themeSlotFiles
          : Array.from({ length: themeSlotCount }, () => null),
      themeSlotAdjust:
        sameThemeAsBefore && f.themeSlotAdjust?.length === themeSlotCount
          ? f.themeSlotAdjust
          : Array.from({ length: themeSlotCount }, () => ({ positionX: 0.5, positionY: 0.5, scale: 1 })),
    }));
    // Le verso n'a pas de notion de thème (voir le commentaire du
    // composant) : seule la mosaïque, qui s'applique aux deux côtés, le
    // fait basculer de mode ; un thème le laisse en upload normal.
    const backSourceMode = type === "mosaic" ? "mosaic" : "upload";
    setBack((b) => ({
      ...b,
      sourceMode: backSourceMode,
      mosaicFiles:
        type === "mosaic"
          ? b.mosaicFiles?.length === mosaicCellCount
            ? b.mosaicFiles
            : Array.from({ length: mosaicCellCount }, () => null)
          : b.mosaicFiles,
    }));
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
    setReviewOpen(false);
    setPhase("pick");
  }

  // Un PDF de deux pages téléversé pour le recto fournit aussi le verso d'un
  // modèle recto-verso (page 2) — même règle partagée que ProductForm (voir
  // lib/pdf/pdfPages.ts).
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

  const frontReady = hasVisualSource(front) || frontLayers.length > 0;
  const backReady = !template?.two_sided || Boolean(backFromPdf) || hasOwnBack || backLayers.length > 0;

  // Chrome admin masqué seulement pendant l'édition plein écran — voir le
  // commentaire du composant.
  useHideChrome(phase === "editor");

  return (
    <>
      {phase === "pick" && (
        <div>
          <div className="mb-6">
            <h1 className="text-page-title font-semibold text-pico-black">Outil Shopify</h1>
            <p className="text-sm text-neutral-500">
              Prépare ton design personnalisé — choisis un modèle pour commencer.
            </p>
          </div>
          <TemplateGallery templates={templates} categories={categories} onSelect={handleSelectTemplate} />
        </div>
      )}

      {phase === "editor" && template && effectiveTemplate && category && (
        <DesignEditor
          key={template.id}
          category={category}
          template={effectiveTemplate}
          rawTemplate={template}
          rotated={rotated}
          onRotatedChange={setRotated}
          visuals={visuals}
          themesForTemplate={themesForTemplate}
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
          onChangeDesignType={handleSelectDesignType}
          onChangeModel={() => setPhase("pick")}
          onReview={() => setReviewOpen(true)}
        />
      )}

      {reviewOpen && category && effectiveTemplate && (
        <DesignReviewOverlay
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
          onClose={() => setReviewOpen(false)}
          onRestart={handleRestart}
        />
      )}
    </>
  );
}
