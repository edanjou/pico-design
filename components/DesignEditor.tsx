"use client";

import { useState } from "react";
import Link from "next/link";
import ImageSourcePicker, { type ImageSourceValue } from "@/components/ImageSourcePicker";
import type { VisualWithUrl } from "@/components/VisualsGrid";
import type { ThemeWithOverlayUrl } from "@/components/ThemesTable";
import type { Category, Template, ThemeSlotAdjust } from "@/lib/types";
import { isLandscape } from "@/lib/pdf/orientation";
import { formatIn, mmToPx } from "@/lib/pdf/units";
import {
  BoldIcon,
  CheckIcon,
  CopyIcon,
  ExpandIcon,
  HelpCircleIcon,
  ImageIcon,
  ItalicIcon,
  LayoutGridIcon,
  PaintbrushVerticalIcon,
  RectangleHorizontalIcon,
  RectangleVerticalIcon,
  RefreshCcwIcon,
  RotateCwIcon,
  TrashIcon,
} from "@/components/icons";
import Switch from "@/components/ui/Switch";
import { rangeFillStyle } from "@/components/ui/rangeFill";
import FileVisualCard from "@/components/ui/FileVisualCard";
import LayersPanel from "@/components/LayersPanel";
import ColorPickerButton from "@/components/ColorPickerButton";
import { FONT_OPTIONS } from "@/lib/design/fonts";
import {
  layersFullyCoverCanvas,
  maxTextSizeMmForTemplate,
  nextLayerId,
  type DesignLayer,
  type TextLayer,
} from "@/lib/design/layers";
import type { PdfPagePlan } from "@/lib/pdf/pdfPages";

// En dessous de ce zoom (voir ImageSourcePicker : 1 = cadrage "cover", pile
// à la limite), une marge blanche apparaît autour du visuel — il ne couvre
// plus toute la zone d'impression (fond perdu compris).
const COVERAGE_ZOOM_THRESHOLD = 0.999;

// Cinq dispositions fixes (masonry — cases de tailles différentes —
// reportée à plus tard, voir la conversation).
const GRID_PRESETS: { cols: number; rows: number }[] = [
  { cols: 1, rows: 2 },
  { cols: 1, rows: 3 },
  { cols: 2, rows: 1 },
  { cols: 3, rows: 1 },
  { cols: 2, rows: 2 },
];

function themeSlotCovers(value: ImageSourceValue, index: number): boolean {
  if (!value.themeSlotFiles?.[index]) return true;
  return (value.themeSlotAdjust?.[index]?.scale ?? 1) >= COVERAGE_ZOOM_THRESHOLD;
}

function coversPrintArea(value: ImageSourceValue): boolean {
  if (value.sourceMode === "theme") {
    return (value.themeSlotFiles ?? []).every((_, i) => themeSlotCovers(value, i));
  }
  if (value.sourceMode !== "upload") return true;
  return (value.scale ?? 1) >= COVERAGE_ZOOM_THRESHOLD;
}

function SidebarButton({
  icon: Icon,
  label,
  onClick,
  active = false,
}: {
  icon?: (props: { className?: string }) => JSX.Element;
  label: string;
  onClick: () => void;
  active?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex w-full items-center gap-2 rounded-lg border px-3 py-2 text-sm ${
        active
          ? "border-primary bg-primary text-text-on-brand"
          : "border-border text-text-muted hover:bg-surface-muted hover:text-text"
      }`}
    >
      {Icon && <Icon className="h-4 w-4 shrink-0" />}
      {label}
    </button>
  );
}

function SidebarGroup({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-3">
      <p className="text-[11px] font-semibold uppercase text-text-subtle">{title}</p>
      {children}
    </div>
  );
}

// Pastille de la légende sous le canevas — un trait de la même couleur que
// le repère qu'elle désigne (voir lib/pdf/preview.ts pour les couleurs
// exactes des traits eux-mêmes) + son libellé.
function LegendPill({ color, dashed, label }: { color: string; dashed?: boolean; label: string }) {
  return (
    <span className="inline-flex items-center gap-2 rounded-full border border-border bg-surface px-3 py-1.5 text-xs text-text-muted">
      <span
        className="h-0 w-4 border-t-[1.5px]"
        style={{ borderColor: color, borderStyle: dashed ? "dashed" : "solid" }}
        aria-hidden="true"
      />
      {label}
    </span>
  );
}

/**
 * Écran unique de l'Outil Shopify (après le choix du modèle, voir
 * TemplateGallery/DesignTool) — inspiré du Figma « Éditeur v2 » : barre du
 * haut (modèle + Recto/Verso + Vérifier et commander), panneau gauche
 * (Visuel — avec le choix du type de design directement dedans, plus Plan de
 * travail), canevas central, panneau droit (Calques + Propriétés + état de
 * préparation). Remplace les anciennes étapes séparées DesignTypePicker,
 * DesignPreview et l'écran Résumé (DesignSummary → DesignReviewOverlay,
 * ouvert par-dessus cet écran plutôt que d'y remplacer le contenu — voir
 * DesignTool).
 *
 * Le type de design (Image/Mosaïque/Thème) n'a de sens QUE pour le recto —
 * le verso, lui, suit automatiquement (mosaïque aussi côté verso, ou upload
 * simple sinon ; un thème ne s'applique jamais au verso, voir DesignTool) :
 * le sélecteur de type n'apparaît donc que quand le recto est affiché.
 *
 * Déviations assumées par rapport au Figma (voir le plan) : pas de bouton
 * Annuler/Refaire ni Enregistrer (aucun historique/brouillon aujourd'hui),
 * pas d'alignement de texte (retiré ailleurs dans le projet comme sans effet
 * visible tant que le bloc reste centré — lib/pdf/textLayer.ts), pas de prix
 * dans le résumé (aucune donnée de prix nulle part), barre de texte
 * flottante simplifiée (Gras/Dupliquer/Supprimer, ancrée au-dessus du
 * canevas plutôt que suivant le calque au pixel près — ImageSourcePicker
 * n'expose pas la position écran d'un calque en dehors de lui-même).
 */
export default function DesignEditor({
  category,
  template,
  rawTemplate,
  rotated,
  onRotatedChange,
  visuals,
  themesForTemplate,
  front,
  back,
  onChangeFront,
  onChangeBack,
  frontLayers,
  backLayers,
  onChangeFrontLayers,
  onChangeBackLayers,
  backFromPdf,
  pdfWarning,
  frontReady,
  backReady,
  designType,
  mosaicGrid,
  selectedTheme,
  onChangeDesignType,
  onChangeModel,
  onReview,
}: {
  category: Category;
  template: Template;
  rawTemplate: Template;
  rotated: boolean;
  onRotatedChange: (rotated: boolean) => void;
  visuals: VisualWithUrl[];
  themesForTemplate: ThemeWithOverlayUrl[];
  front: ImageSourceValue;
  back: ImageSourceValue;
  onChangeFront: (patch: Partial<ImageSourceValue>) => void;
  onChangeBack: (patch: Partial<ImageSourceValue>) => void;
  frontLayers: DesignLayer[];
  backLayers: DesignLayer[];
  onChangeFrontLayers: (layers: DesignLayer[]) => void;
  onChangeBackLayers: (layers: DesignLayer[]) => void;
  backFromPdf: { file: File; page: number } | null;
  pdfWarning: PdfPagePlan["warning"];
  frontReady: boolean;
  backReady: boolean;
  designType: "single" | "mosaic" | "theme";
  mosaicGrid: { cols: number; rows: number };
  selectedTheme: ThemeWithOverlayUrl | null;
  onChangeDesignType: (
    type: "single" | "mosaic" | "theme",
    extra?: { grid?: { cols: number; rows: number }; theme?: ThemeWithOverlayUrl }
  ) => void;
  onChangeModel: () => void;
  onReview: () => void;
}) {
  const [activeSide, setActiveSide] = useState<"front" | "back">("front");
  const [selectedLayerId, setSelectedLayerId] = useState<string | null>(null);
  const [selectedThemeSlot, setSelectedThemeSlot] = useState<number | null>(null);
  const [confirmingCoverage, setConfirmingCoverage] = useState(false);
  const [themePickerOpen, setThemePickerOpen] = useState(false);
  // « Afficher les guides d'impression » (nouveau, voir le plan) — masque/
  // affiche uniquement les repères sur le canevas d'édition, jamais le PDF
  // final (ImageSourcePicker le fait déjà pour son propre usage admin, on
  // ne fait que brancher un bouton dessus ici — voir sa prop `showGuides`).
  const [showGuides, setShowGuides] = useState(true);
  // Zoom de VUE du canevas (distinct du zoom de l'image/des calques) —
  // purement un confort d'affichage. `transform: scale` a été essayé
  // d'abord, mais ne change pas la taille occupée dans la mise en page
  // (seulement le rendu visuel) : agrandir le canevas le faisait déborder
  // par-dessus la légende/les boutons juste en dessous au lieu de les
  // repousser. Tenter de réserver l'espace manuellement (mesurer la taille
  // via ResizeObserver puis l'imposer au conteneur englobant) bouclait à
  // l'infini, le canevas d'ImageSourcePicker se redimensionnant lui-même
  // selon l'espace disponible — plus on lui en réservait, plus il grossissait,
  // plus on lui en réservait... `zoom` (propriété CSS, pas standard mais
  // supportée par tous les navigateurs courants dont Firefox depuis la
  // version 126) change, elle, la taille réellement occupée dans la mise en
  // page — la ligne suivante est repoussée naturellement, sans mesure ni
  // boucle.
  const [viewZoom, setViewZoom] = useState(1);

  const side = template.two_sided ? activeSide : "front";
  const frontCovers = coversPrintArea(front) || layersFullyCoverCanvas(frontLayers);
  const backCovers = coversPrintArea(back) || layersFullyCoverCanvas(backLayers);
  const activeCovers = side === "front" ? frontCovers : backCovers;
  const activeValue = side === "front" ? front : back;
  const activeOnChange = side === "front" ? onChangeFront : onChangeBack;
  const activeLayers = side === "front" ? frontLayers : backLayers;
  const activeOnChangeLayers = side === "front" ? onChangeFrontLayers : onChangeBackLayers;
  const maxFontSizeMm = maxTextSizeMmForTemplate(template);
  const anyUncovered = !frontCovers || (template.two_sided && !backCovers);
  const uncoveredLabel = !template.two_sided
    ? "Ton visuel ne couvre"
    : !frontCovers && !backCovers
    ? "Le recto et le verso ne couvrent"
    : !frontCovers
    ? "Le recto ne couvre"
    : "Le verso ne couvre";
  const effectiveIsLandscape = isLandscape(template.width_mm, template.height_mm);
  const selectedLayer = activeLayers.find((l) => l.id === selectedLayerId) ?? null;
  // Page complète (fond perdu compris) à la résolution d'impression — la
  // même cible que le rendu final côté serveur (coverCropToBuffer) — sert
  // de référence à FileVisualCard pour son indicateur de qualité.
  const targetWidthPx = mmToPx(template.width_mm + 2 * template.bleed_mm, template.dpi);
  const targetHeightPx = mmToPx(template.height_mm + 2 * template.bleed_mm, template.dpi);

  function switchSide(next: "front" | "back") {
    setActiveSide(next);
    setSelectedLayerId(null);
    setSelectedThemeSlot(null);
  }

  function handleReviewClick() {
    if (anyUncovered && !confirmingCoverage) {
      setConfirmingCoverage(true);
      return;
    }
    setConfirmingCoverage(false);
    onReview();
  }

  function rotateVisual() {
    activeOnChange({ rotation: ((activeValue.rotation ?? 0) + 90) % 360, scale: undefined });
  }
  function fillSpace() {
    activeOnChange({ scale: 1 });
  }
  function recenter() {
    activeOnChange({ positionX: 0.5, positionY: 0.5, scale: undefined });
  }

  const themeSlotCount = selectedTheme?.slots.length ?? 0;
  const DEFAULT_THEME_ADJUST: ThemeSlotAdjust = { positionX: 0.5, positionY: 0.5, scale: 1 };
  function themeAdjust(index: number): ThemeSlotAdjust {
    return front.themeSlotAdjust?.[index] ?? DEFAULT_THEME_ADJUST;
  }
  function updateThemeAdjust(index: number, patch: Partial<ThemeSlotAdjust>) {
    const next = Array.from({ length: themeSlotCount }, (_, i) => front.themeSlotAdjust?.[i] ?? DEFAULT_THEME_ADJUST);
    next[index] = { ...next[index], ...patch };
    onChangeFront({ themeSlotAdjust: next });
  }

  // Barre de texte flottante (police/taille/gras/italique/couleur puis
  // Dupliquer/Supprimer) — opère directement sur le calque texte sélectionné
  // du côté actif. `updateTextLayer` est le même principe que `updateLayer`
  // dans LayersPanel (panneau droit, qui garde en plus l'espacement, la
  // bordure, l'opacité et le mode de fusion — cette barre flottante ne
  // reprend que les réglages les plus utilisés, en accès rapide sur le
  // canevas).
  function updateTextLayer(patch: Partial<TextLayer>) {
    if (selectedLayer?.type !== "text") return;
    activeOnChangeLayers(
      activeLayers.map((l) => (l.id === selectedLayer.id && l.type === "text" ? { ...l, ...patch } : l))
    );
  }
  function toggleBold() {
    if (selectedLayer?.type !== "text") return;
    updateTextLayer({ bold: !selectedLayer.bold });
  }
  function toggleItalic() {
    if (selectedLayer?.type !== "text") return;
    updateTextLayer({ italic: !selectedLayer.italic });
  }
  function duplicateSelectedLayer() {
    if (!selectedLayer) return;
    const clone: DesignLayer = {
      ...selectedLayer,
      id: nextLayerId(),
      positionX: Math.min(0.95, selectedLayer.positionX + 0.04),
      positionY: Math.min(0.95, selectedLayer.positionY + 0.04),
    };
    activeOnChangeLayers([...activeLayers, clone]);
    setSelectedLayerId(clone.id);
  }
  function deleteSelectedLayer() {
    if (!selectedLayer) return;
    activeOnChangeLayers(activeLayers.filter((l) => l.id !== selectedLayer.id));
    setSelectedLayerId(null);
  }

  return (
    <div className="flex min-h-dvh flex-col bg-background">
      {/* Barre du haut */}
      <header className="sticky top-0 z-10 flex items-center justify-between gap-4 border-b border-border bg-surface px-4 py-3 sm:px-6">
        <div className="flex min-w-0 items-center gap-3">
          <Link href="/" className="shrink-0">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/pico-noir.svg" alt="Pico" className="h-6 w-auto" />
          </Link>
          <span className="h-7 w-px shrink-0 bg-border" aria-hidden="true" />
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-text">{template.name}</p>
            <p className="truncate text-xs text-text-subtle">
              {formatIn(template.width_mm)} × {formatIn(template.height_mm)} po
              {template.two_sided ? " · Recto verso" : " · Recto"}
            </p>
          </div>
          <button
            type="button"
            onClick={onChangeModel}
            className="ml-2 shrink-0 rounded-lg border border-border px-3 py-1.5 text-xs text-text-muted hover:bg-surface-muted"
          >
            Changer de modèle
          </button>
        </div>

        {template.two_sided && (
          <div className="hidden shrink-0 rounded-full border border-border bg-background p-0.5 text-sm sm:flex">
            <button
              type="button"
              onClick={() => switchSide("front")}
              className={`flex items-center gap-1.5 rounded-full px-4 py-1.5 ${
                side === "front" ? "bg-primary text-text-on-brand" : "text-text-muted hover:bg-surface-muted"
              }`}
            >
              Recto
              {!frontCovers && (
                <span className={`h-1.5 w-1.5 rounded-full ${side === "front" ? "bg-text-on-brand" : "bg-warning"}`} />
              )}
            </button>
            <button
              type="button"
              onClick={() => switchSide("back")}
              className={`flex items-center gap-1.5 rounded-full px-4 py-1.5 ${
                side === "back" ? "bg-primary text-text-on-brand" : "text-text-muted hover:bg-surface-muted"
              }`}
            >
              Verso
              {!backCovers && (
                <span className={`h-1.5 w-1.5 rounded-full ${side === "back" ? "bg-text-on-brand" : "bg-warning"}`} />
              )}
            </button>
          </div>
        )}

        <div className="flex shrink-0 items-center gap-3">
          {confirmingCoverage && anyUncovered ? (
            <>
              <span className="hidden max-w-xs text-xs text-text-subtle sm:inline">
                ⚠ {uncoveredLabel} pas toute la zone d&apos;impression.
              </span>
              <button
                type="button"
                onClick={() => setConfirmingCoverage(false)}
                className="rounded-lg border border-border px-3 py-2 text-sm text-text-muted hover:bg-surface-muted"
              >
                Ajuster
              </button>
              <button
                type="button"
                onClick={() => {
                  setConfirmingCoverage(false);
                  onReview();
                }}
                className="rounded-full bg-primary px-4 py-2 text-sm font-medium text-text-on-brand hover:bg-primary-hover"
              >
                Continuer quand même
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={handleReviewClick}
              disabled={!frontReady || !backReady}
              className="rounded-full bg-primary px-5 py-2.5 text-sm font-medium text-text-on-brand hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-50"
            >
              Vérifier et commander
            </button>
          )}
        </div>
      </header>

      {/* Recto/Verso, version mobile (la pilule du haut est masquée sous sm) */}
      {template.two_sided && (
        <div className="flex justify-center border-b border-border bg-surface py-2 sm:hidden">
          <div className="flex rounded-full border border-border p-0.5 text-sm">
            <button
              type="button"
              onClick={() => switchSide("front")}
              className={`rounded-full px-4 py-1.5 ${side === "front" ? "bg-primary text-text-on-brand" : "text-text-muted"}`}
            >
              Recto
            </button>
            <button
              type="button"
              onClick={() => switchSide("back")}
              className={`rounded-full px-4 py-1.5 ${side === "back" ? "bg-primary text-text-on-brand" : "text-text-muted"}`}
            >
              Verso
            </button>
          </div>
        </div>
      )}

      <div className="flex flex-1 flex-col lg:flex-row">
        {/* Panneau gauche */}
        <div className="flex shrink-0 flex-col gap-6 overflow-y-auto border-b border-border bg-surface p-5 lg:w-[300px] lg:border-b-0 lg:border-r">
          <SidebarGroup title="Visuel">
            {side === "front" && (
              // Une seule pilule (contrôle segmenté) avec les trois choix
              // dedans — texte/icônes resserrés (text-xs, icônes 14px) pour
              // que les trois tiennent sur une ligne même avec "Mosaïque",
              // le plus long des trois.
              <div className="flex rounded-full border border-border bg-background p-0.5 text-xs">
                <button
                  type="button"
                  onClick={() => {
                    setThemePickerOpen(false);
                    onChangeDesignType("single");
                  }}
                  className={`flex flex-1 items-center justify-center gap-1 whitespace-nowrap rounded-full px-1.5 py-2 font-medium ${
                    designType === "single"
                      ? "bg-primary text-text-on-brand shadow-sm"
                      : "text-text-muted hover:text-text"
                  }`}
                >
                  <ImageIcon className="h-3.5 w-3.5 shrink-0" /> Image
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setThemePickerOpen(false);
                    onChangeDesignType("mosaic", { grid: mosaicGrid });
                  }}
                  className={`flex flex-1 items-center justify-center gap-1 whitespace-nowrap rounded-full px-1.5 py-2 font-medium ${
                    designType === "mosaic"
                      ? "bg-primary text-text-on-brand shadow-sm"
                      : "text-text-muted hover:text-text"
                  }`}
                >
                  <LayoutGridIcon className="h-3.5 w-3.5 shrink-0" /> Mosaïque
                </button>
                {themesForTemplate.length > 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      // Bascule vraiment sur "theme" tout de suite (comme
                      // Image/Mosaïque) — aucun thème précis choisi encore
                      // (`extra` omis, voir handleSelectDesignType), mais
                      // Image/Mosaïque se désélectionnent bien dès le clic,
                      // pas seulement une fois un thème choisi dans la
                      // liste. Avant ce correctif, `designType` restait sur
                      // l'ancien mode tant qu'aucun thème n'était choisi :
                      // Thème ET l'ancien choix (Image/Mosaïque) pouvaient
                      // alors s'afficher actifs en même temps.
                      onChangeDesignType("theme");
                      setThemePickerOpen(true);
                    }}
                    className={`flex flex-1 items-center justify-center gap-1 whitespace-nowrap rounded-full px-1.5 py-2 font-medium ${
                      designType === "theme"
                        ? "bg-primary text-text-on-brand shadow-sm"
                        : "text-text-muted hover:text-text"
                    }`}
                  >
                    <PaintbrushVerticalIcon className="h-3.5 w-3.5 shrink-0" /> Thème
                  </button>
                )}
              </div>
            )}

            {/* Mosaïque : disposition (toujours modifiable) + grille de cases. */}
            {side === "front" && designType === "mosaic" && (
              <div className="flex flex-wrap gap-1.5">
                {GRID_PRESETS.map(({ cols, rows }) => (
                  <button
                    key={`${cols}x${rows}`}
                    type="button"
                    onClick={() => onChangeDesignType("mosaic", { grid: { cols, rows } })}
                    className={`rounded-lg border px-2.5 py-1 text-xs ${
                      mosaicGrid.cols === cols && mosaicGrid.rows === rows
                        ? "border-primary bg-primary text-text-on-brand"
                        : "border-border text-text-muted hover:bg-surface-muted"
                    }`}
                  >
                    {cols}×{rows}
                  </button>
                ))}
              </div>
            )}

            {/* Thème : liste des thèmes du modèle — seulement quand le
                sélecteur est ouvert (bouton « Thème » cliqué, ou « Changer
                de thème » plus bas), jamais affichée par défaut sous Image/
                Mosaïque. */}
            {side === "front" && themePickerOpen && themesForTemplate.length > 0 && (
              <div className="grid grid-cols-2 gap-2">
                {themesForTemplate.map((theme) => (
                  <button
                    key={theme.id}
                    type="button"
                    onClick={() => {
                      onChangeDesignType("theme", { theme });
                      setThemePickerOpen(false);
                    }}
                    className={`flex flex-col items-center gap-1.5 rounded-lg border p-2 text-center ${
                      selectedTheme?.id === theme.id ? "border-primary" : "border-border hover:border-border-strong"
                    }`}
                  >
                    <div className="flex h-14 w-14 items-center justify-center rounded-md border border-border bg-surface-muted p-1.5">
                      {theme.overlayUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={theme.overlayUrl} alt="" className="max-h-full max-w-full object-contain" />
                      ) : (
                        <PaintbrushVerticalIcon className="h-6 w-6 text-text-subtle" />
                      )}
                    </div>
                    <span className="line-clamp-2 text-[11px] font-medium text-text">{theme.name}</span>
                  </button>
                ))}
              </div>
            )}
            {side === "front" && designType === "theme" && !themePickerOpen && themesForTemplate.length > 1 && (
              <button
                type="button"
                onClick={() => setThemePickerOpen(true)}
                className="self-start text-xs font-medium text-primary underline"
              >
                Changer de thème
              </button>
            )}

            {/* Fichier : carte dédiée (voir FileVisualCard) pour un fond
                unique — reprend le Figma (vignette + nom + qualité +
                Remplacer). Mosaïque/Thème gardent le rendu d'
                ImageSourcePicker (banque, cases...), trop différent pour la
                même carte. Masqué tant que le sélecteur de thème est ouvert
                (évite de montrer en même temps l'ancien mode et la liste des
                thèmes). */}
            {side === "front" && themePickerOpen ? null : activeValue.sourceMode === "upload" ? (
              <FileVisualCard
                file={activeValue.file}
                pairedPdfLabel={side === "back" && !back.file && backFromPdf ? `Page ${backFromPdf.page} du PDF (recto)` : null}
                targetWidthPx={targetWidthPx}
                targetHeightPx={targetHeightPx}
                scale={activeValue.scale ?? 1}
                onFileChange={(f) =>
                  activeOnChange({ file: f, positionX: 0.5, positionY: 0.5, scale: undefined, rotation: 0 })
                }
              />
            ) : (
              <ImageSourcePicker
                key={`${side}-file`}
                side={side}
                template={template}
                rotated={rotated}
                visuals={visuals}
                value={activeValue}
                onChange={activeOnChange}
                logo={null}
                pairedPdf={side === "back" ? backFromPdf : undefined}
                showGuides={false}
                sourceModes={[activeValue.sourceMode]}
                showPreview={false}
                mosaicGrid={mosaicGrid}
                themeId={side === "front" ? selectedTheme?.id ?? null : null}
              />
            )}

            {pdfWarning && side === "front" && front.sourceMode === "upload" && (
              <p className="rounded-lg border border-warning bg-warning-subtle p-3 text-xs text-text">⚠ {pdfWarning}</p>
            )}

            {activeValue.sourceMode === "upload" && !themePickerOpen && (
              <>
                <div className="flex flex-col gap-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-medium text-text">Zoom</span>
                    <span className="text-text-subtle">{Math.round((activeValue.scale ?? 1) * 100)}%</span>
                  </div>
                  <input
                    type="range"
                    min={0.1}
                    max={3}
                    step={0.02}
                    value={activeValue.scale ?? 1}
                    onChange={(e) => activeOnChange({ scale: parseFloat(e.target.value) })}
                    className="pico-range w-full"
                    style={rangeFillStyle(activeValue.scale ?? 1, 0.1, 3)}
                    aria-label="Zoom (recadrage)"
                  />
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={rotateVisual}
                    className="flex flex-col items-center gap-1.5 rounded-lg border border-border py-2.5 text-[11px] text-text-muted hover:bg-surface-muted hover:text-text"
                  >
                    <RotateCwIcon className="h-[18px] w-[18px]" />
                    Pivoter
                  </button>
                  <button
                    type="button"
                    onClick={fillSpace}
                    className="flex flex-col items-center gap-1.5 rounded-lg border border-border py-2.5 text-[11px] text-text-muted hover:bg-surface-muted hover:text-text"
                  >
                    <ExpandIcon className="h-[18px] w-[18px]" />
                    Remplir
                  </button>
                  <button
                    type="button"
                    onClick={recenter}
                    className="flex flex-col items-center gap-1.5 rounded-lg border border-border py-2.5 text-[11px] text-text-muted hover:bg-surface-muted hover:text-text"
                  >
                    <RefreshCcwIcon className="h-[18px] w-[18px]" />
                    Réinitialiser
                  </button>
                </div>
              </>
            )}

            {activeValue.sourceMode === "theme" && themeSlotCount > 0 && (
              <>
                <div className="flex gap-1">
                  {Array.from({ length: themeSlotCount }, (_, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => setSelectedThemeSlot(i)}
                      className={`relative flex-1 rounded-lg border px-1.5 py-1.5 text-xs ${
                        selectedThemeSlot === i
                          ? "border-primary bg-primary text-text-on-brand"
                          : "border-border text-text-muted hover:bg-surface-muted hover:text-text"
                      }`}
                    >
                      Photo {i + 1}
                      {!themeSlotCovers(front, i) && (
                        <span
                          className={`absolute right-1 top-1 h-1.5 w-1.5 rounded-full ${
                            selectedThemeSlot === i ? "bg-text-on-brand" : "bg-warning"
                          }`}
                        />
                      )}
                    </button>
                  ))}
                </div>
                {selectedThemeSlot !== null ? (
                  <>
                    {!themeSlotCovers(front, selectedThemeSlot) && (
                      <p className="rounded-lg border border-warning bg-warning-subtle p-2 text-xs text-text">
                        ⚠ Cette photo ne couvre pas tout l&apos;emplacement.
                      </p>
                    )}
                    <div className="flex flex-col gap-2">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-medium text-text">Zoom</span>
                        <span className="text-text-subtle">{Math.round(themeAdjust(selectedThemeSlot).scale * 100)}%</span>
                      </div>
                      <input
                        type="range"
                        min={0.1}
                        max={3}
                        step={0.02}
                        value={themeAdjust(selectedThemeSlot).scale}
                        onChange={(e) => updateThemeAdjust(selectedThemeSlot, { scale: parseFloat(e.target.value) })}
                        className="pico-range w-full"
                        style={rangeFillStyle(themeAdjust(selectedThemeSlot).scale, 0.1, 3)}
                        aria-label="Zoom de la photo sélectionnée"
                      />
                    </div>
                    <SidebarButton
                      icon={ExpandIcon}
                      label="Maximiser l'espace"
                      onClick={() => updateThemeAdjust(selectedThemeSlot, { scale: 1 })}
                    />
                    <SidebarButton
                      icon={RefreshCcwIcon}
                      label="Réinitialiser cette photo"
                      onClick={() => updateThemeAdjust(selectedThemeSlot, { positionX: 0.5, positionY: 0.5, scale: 1 })}
                    />
                  </>
                ) : (
                  <p className="text-xs text-text-subtle">Choisis une photo (ci-dessus ou dans l&apos;aperçu) pour la déplacer/zoomer.</p>
                )}
              </>
            )}
          </SidebarGroup>

          <SidebarGroup title="Plan de travail">
            {rawTemplate.allow_orientation_change && (
              // Même style de pilule que Recto/Verso (barre du haut) :
              // conteneur rounded-full/border/bg-background, actif =
              // bg-primary + texte blanc (pas de fond blanc/ombre/texte
              // bourgogne comme avant).
              <div className="flex rounded-full border border-border bg-background p-0.5 text-sm">
                <button
                  type="button"
                  onClick={() => onRotatedChange(isLandscape(rawTemplate.width_mm, rawTemplate.height_mm))}
                  className={`flex flex-1 items-center justify-center gap-1.5 rounded-full px-4 py-1.5 ${
                    !effectiveIsLandscape
                      ? "bg-primary text-text-on-brand"
                      : "text-text-muted hover:bg-surface-muted"
                  }`}
                >
                  <RectangleVerticalIcon className="h-4 w-3 shrink-0" />
                  Portrait
                </button>
                <button
                  type="button"
                  onClick={() => onRotatedChange(!isLandscape(rawTemplate.width_mm, rawTemplate.height_mm))}
                  className={`flex flex-1 items-center justify-center gap-1.5 rounded-full px-4 py-1.5 ${
                    effectiveIsLandscape
                      ? "bg-primary text-text-on-brand"
                      : "text-text-muted hover:bg-surface-muted"
                  }`}
                >
                  <RectangleHorizontalIcon className="h-3 w-4 shrink-0" />
                  Paysage
                </button>
              </div>
            )}
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm text-text">Afficher les guides d&apos;impression</span>
              <Switch checked={showGuides} onChange={setShowGuides} label="Afficher les guides d'impression" />
            </div>
          </SidebarGroup>

          {/* Fond : #4F0A1F à 6 %, écrit en rgba() littéral plutôt qu'avec
              le modificateur d'opacité de Tailwind (`bg-primary/[0.06]`).
              Les couleurs du projet sont des variables CSS contenant une
              couleur complète (voir app/globals.css, `--primary:
              var(--pico-bourgogne)`), pas des canaux RGB séparés : le
              modificateur génère alors du CSS invalide que le navigateur
              ignore — l'encadré devenait carrément invisible. */}
          <div className="mt-auto flex items-start gap-2.5 rounded-xl bg-[rgba(79,10,31,0.06)] p-3.5">
            <HelpCircleIcon className="h-[18px] w-[18px] shrink-0 text-primary" />
            <div>
              <p className="text-sm font-semibold text-primary">Besoin d&apos;un coup de main?</p>
              <p className="text-xs text-text-subtle">Notre équipe peut finaliser ton design.</p>
            </div>
          </div>
        </div>

        {/* Zone de travail centrale */}
        <div className="flex flex-1 flex-col items-center gap-4 overflow-y-auto p-6">
          {selectedLayer?.type === "text" && (
            <div className="flex flex-wrap items-center gap-1 rounded-xl border border-border bg-surface p-1.5 shadow">
              <select
                value={selectedLayer.fontId}
                onChange={(e) => updateTextLayer({ fontId: e.target.value })}
                aria-label="Police"
                className="rounded-lg border border-border bg-surface px-2 py-1.5 text-sm"
              >
                {FONT_OPTIONS.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.label}
                  </option>
                ))}
              </select>
              <input
                type="number"
                min={3}
                max={maxFontSizeMm}
                step={0.5}
                value={Math.round(selectedLayer.fontSizeMm)}
                onChange={(e) => {
                  const v = parseFloat(e.target.value);
                  if (!Number.isNaN(v)) updateTextLayer({ fontSizeMm: Math.min(maxFontSizeMm, Math.max(3, v)) });
                }}
                aria-label="Taille du texte (mm)"
                className="w-16 rounded-lg border border-border bg-surface px-2 py-1.5 text-sm"
              />
              <span className="mx-0.5 h-5 w-px bg-border" aria-hidden="true" />
              <button
                type="button"
                onClick={toggleBold}
                aria-pressed={selectedLayer.bold}
                className={`rounded-lg p-2 ${selectedLayer.bold ? "bg-primary text-text-on-brand" : "text-text-muted hover:bg-surface-muted"}`}
              >
                <BoldIcon className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={toggleItalic}
                aria-pressed={selectedLayer.italic}
                className={`rounded-lg p-2 ${selectedLayer.italic ? "bg-primary text-text-on-brand" : "text-text-muted hover:bg-surface-muted"}`}
              >
                <ItalicIcon className="h-4 w-4" />
              </button>
              <ColorPickerButton
                value={selectedLayer.color}
                onChange={(hex) => updateTextLayer({ color: hex })}
                label="Couleur du texte"
              />
              <span className="mx-0.5 h-5 w-px bg-border" aria-hidden="true" />
              <button
                type="button"
                onClick={duplicateSelectedLayer}
                aria-label="Dupliquer le calque"
                className="rounded-lg p-2 text-text-muted hover:bg-surface-muted"
              >
                <CopyIcon className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={deleteSelectedLayer}
                aria-label="Supprimer le calque"
                className="rounded-lg p-2 text-text-muted hover:text-danger"
              >
                <TrashIcon className="h-4 w-4" />
              </button>
            </div>
          )}

          {!activeCovers && (
            <p className="w-full max-w-xl rounded-lg border border-warning bg-warning-subtle p-3 text-center text-sm text-text">
              ⚠ Ton visuel ne couvre pas toute la zone d&apos;impression — il y aura une bordure blanche autour.
            </p>
          )}

          <div className="flex justify-center" style={{ zoom: viewZoom }}>
            <ImageSourcePicker
              key={side}
              side={side}
              template={template}
              rotated={rotated}
              visuals={visuals}
              value={activeValue}
              onChange={activeOnChange}
              logo={null}
              pairedPdf={side === "back" ? backFromPdf : undefined}
              previewSize="lg"
              allowZoom
              showGuides={showGuides}
              layers={activeLayers}
              onChangeLayers={activeOnChangeLayers}
              selectedLayerId={selectedLayerId}
              sourceModes={[activeValue.sourceMode]}
              allowFileChange={false}
              mosaicGrid={mosaicGrid}
              themeId={side === "front" ? selectedTheme?.id ?? null : null}
              themeSlots={side === "front" ? selectedTheme?.slots ?? [] : []}
              themeOverlayUrl={side === "front" ? selectedTheme?.overlayUrl ?? null : null}
              selectedThemeSlot={side === "front" ? selectedThemeSlot : null}
              onSelectThemeSlot={side === "front" ? setSelectedThemeSlot : undefined}
            />
          </div>

          {/* Légende — informative seulement, mêmes couleurs que les traits
              réellement dessinés (voir lib/pdf/preview.ts). */}
          <div className="flex flex-wrap justify-center gap-2">
            <LegendPill color="#ff00ff" label="Coupe" />
            <LegendPill color="#60a5fa" dashed label="Marge de protection" />
            <LegendPill color="var(--text-subtle)" dashed label={`Fond perdu : ${formatIn(template.bleed_mm)} po`} />
            {((rawTemplate.fold_marks_vertical_mm?.length ?? 0) > 0 ||
              (rawTemplate.fold_marks_horizontal_mm?.length ?? 0) > 0) && (
              <LegendPill color="#16a34a" dashed label="Marques de pli" />
            )}
          </div>

          <p className="max-w-md text-center text-xs text-text-muted">
            Ligne de coupe et marge de sécurité sont affichées pour référence
            {side === "front" && designType === "mosaic"
              ? " — ajoute une photo par case."
              : side === "front" && designType === "theme"
              ? " — ajoute une photo par emplacement."
              : " — glisse encore l'image ou zoome si besoin."}
          </p>

          {/* Zoom de vue — échelle d'affichage du canevas, distincte du zoom
              de l'image (voir la barre latérale gauche). */}
          <div className="flex items-center gap-1 rounded-lg border border-border bg-surface p-1">
            <button
              type="button"
              onClick={() => setViewZoom((z) => Math.max(0.5, Math.round((z - 0.1) * 10) / 10))}
              className="rounded-md px-2.5 py-1 text-text-muted hover:bg-surface-muted"
              aria-label="Réduire l'échelle d'affichage"
            >
              −
            </button>
            <span className="w-12 text-center text-xs font-semibold text-text">{Math.round(viewZoom * 100)}%</span>
            <button
              type="button"
              onClick={() => setViewZoom((z) => Math.min(1.5, Math.round((z + 0.1) * 10) / 10))}
              className="rounded-md px-2.5 py-1 text-text-muted hover:bg-surface-muted"
              aria-label="Augmenter l'échelle d'affichage"
            >
              +
            </button>
            <span className="mx-0.5 h-4 w-px bg-border" aria-hidden="true" />
            <button
              type="button"
              onClick={() => setViewZoom(1)}
              className="rounded-md px-2.5 py-1 text-xs text-text-muted hover:bg-surface-muted"
            >
              Ajuster à l&apos;écran
            </button>
          </div>
        </div>

        {/* Panneau droit */}
        <div className="flex shrink-0 flex-col gap-4 overflow-y-auto border-t border-border bg-surface p-5 lg:w-[320px] lg:border-l lg:border-t-0">
          <LayersPanel
            layers={activeLayers}
            onChangeLayers={activeOnChangeLayers}
            selectedLayerId={selectedLayerId}
            onSelectLayer={setSelectedLayerId}
            maxFontSizeMm={maxFontSizeMm}
          />

          <div className="mt-auto space-y-2.5 rounded-xl bg-surface-muted p-3.5">
            <p className="text-sm font-medium text-text">
              {category.name} · {template.two_sided ? "recto verso" : "recto"}
            </p>
            <div className="flex items-center gap-2">
              <CheckIcon className={`h-3.5 w-3.5 shrink-0 ${frontReady && backReady ? "text-success" : "text-text-subtle"}`} />
              <p className="text-xs text-text-subtle">
                {template.two_sided
                  ? `Recto ${frontReady ? "prêt" : "à compléter"} · Verso ${backReady ? "prêt" : "à compléter"}`
                  : frontReady
                  ? "Recto prêt"
                  : "Recto à compléter"}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
