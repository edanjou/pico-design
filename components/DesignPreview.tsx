"use client";

import { useState } from "react";
import ImageSourcePicker, { type ImageSourceValue } from "@/components/ImageSourcePicker";
import type { VisualWithUrl } from "@/components/VisualsGrid";
import type { Template } from "@/lib/types";
import { isLandscape } from "@/lib/pdf/orientation";
import { ExpandIcon, RefreshCcwIcon, RotateCwIcon } from "@/components/icons";
import LayersPanel from "@/components/LayersPanel";
import { layersFullyCoverCanvas, maxTextSizeMmForTemplate, type DesignLayer } from "@/lib/design/layers";
import type { PdfPagePlan } from "@/lib/pdf/pdfPages";

// En dessous de ce zoom (voir ImageSourcePicker : 1 = cadrage "cover", pile
// à la limite), une marge blanche apparaît autour du visuel — il ne couvre
// plus toute la zone d'impression (fond perdu compris). Une petite marge
// sous 1 (plutôt que zoom < 1 pile) absorbe l'arrondi du curseur/du calcul
// de zoom par défaut.
const COVERAGE_ZOOM_THRESHOLD = 0.999;

function coversPrintArea(value: ImageSourceValue): boolean {
  return (value.scale ?? 1) >= COVERAGE_ZOOM_THRESHOLD;
}

// Bouton de la barre latérale — même gabarit pour tous (icône optionnelle +
// texte, pleine largeur de la colonne). `active` : rempli (choix courant
// d'un groupe à options, ex. Portrait/Paysage) plutôt que contour discret
// (une action ponctuelle, ex. Recentrer).
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

// Groupe de boutons de la barre latérale, avec son sous-titre ("Plan de
// travail", "Visuel").
function SidebarGroup({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-2">
      <p className="text-xs font-semibold uppercase tracking-wide text-text-subtle">{title}</p>
      {children}
    </div>
  );
}

/**
 * Étape 3 (« Design ») de Design Shopify : choisir le visuel ET l'ajuster,
 * dans la même étape (fusion d'un ancien duo d'étapes séparées « Visuel »
 * puis « Aperçu ») — aperçu zoomé, avec les repères de coupe (ou, si le
 * modèle en a un, son gabarit de guidage — les deux ne s'affichent jamais
 * ensemble, voir lib/pdf/preview.ts), curseur de zoom (`allowZoom`) en plus
 * du glisser, pour recadrer plus finement pendant qu'on voit les repères de
 * près.
 *
 * Tous les boutons d'ajustement (et, maintenant, le choix du fichier lui-
 * même) vivent dans une barre latérale à gauche de l'espace de travail
 * (empilés, groupés sous deux sous-titres), plutôt que dispersés autour de
 * l'aperçu — DesignPreview les possède directement (ils patchent
 * `front`/`back` via `onChangeFront`/`onChangeBack` selon le côté actif),
 * pas ImageSourcePicker, qui garde son propre "Recentrer" (discret) pour
 * ProductForm :
 * - « Visuel » (en premier) : le sélecteur de fichier (glisser-déposer, avec
 *   aperçu même pour un PDF) pour le côté actif — un ImageSourcePicker
 *   dédié, sans son propre aperçu/repères (`showPreview={false}`), à côté de
 *   celui, plus grand, qui gère le cadrage plus bas (les deux partagent le
 *   même `value`/`onChange`, donc restent synchronisés) — puis Pivoter le
 *   visuel (fait tourner l'image dans son cadre, voir `rotation` sur
 *   ImageSourceValue), Maximiser l'espace / Réinitialiser (zoom/position,
 *   voir ImageSourcePicker pour le détail des calculs).
 * - « Plan de travail » : deux boutons Portrait/Paysage (choix direct, pas
 *   une bascule) — absent si le modèle ne permet pas de changer d'orientation
 *   (`allow_orientation_change`).
 *
 * Recto-verso : un seul côté affiché à la fois (bascule Recto/Verso, gardée
 * en haut), plutôt que les deux côte à côte — l'aperçu affiché est ainsi
 * plus grand et plus lisible qu'écrasé à moitié de la largeur. Un point
 * orange sur le bouton signale le côté qui ne couvre pas encore toute la
 * zone d'impression (voir `coversPrintArea`). Par défaut, le zoom couvre
 * déjà toute cette zone (voir ImageSourcePicker — plus de zoom "on voit
 * tout le visuel" par défaut, remplacé par celui-ci pour ne pas déclencher
 * cette alerte sans que le client ait rien touché) ; un dézoom manuel reste
 * possible, mais "Voir le résumé" demande alors une confirmation explicite
 * (`handleNext`/`confirmingCoverage`) avant de continuer. Ce bouton reste
 * aussi désactivé tant qu'un visuel n'est pas choisi des deux côtés
 * (`frontReady`/`backReady`) — l'ancien garde-fou de l'étape « Visuel »,
 * fusionnée ici.
 *
 * Contrairement à ProductForm (outil interne), le logo Pico n'est jamais
 * appliqué ici, même si le modèle a `logo_on_front`/`logo_on_back` (réglage
 * pensé pour nos propres Produits) — un client qui personnalise son propre
 * produit ne doit pas se retrouver avec notre logo dessus par défaut.
 */
export default function DesignPreview({
  template,
  rawTemplate,
  rotated,
  onRotatedChange,
  visuals,
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
  onBack,
  onNext,
}: {
  // Déjà orienté (voir applyOrientation dans DesignTool) — utilisé pour tout
  // sauf la bascule Portrait/Paysage elle-même, qui a besoin du brut.
  template: Template;
  rawTemplate: Template;
  rotated: boolean;
  onRotatedChange: (rotated: boolean) => void;
  visuals: VisualWithUrl[];
  front: ImageSourceValue;
  back: ImageSourceValue;
  onChangeFront: (patch: Partial<ImageSourceValue>) => void;
  onChangeBack: (patch: Partial<ImageSourceValue>) => void;
  frontLayers: DesignLayer[];
  backLayers: DesignLayer[];
  onChangeFrontLayers: (layers: DesignLayer[]) => void;
  onChangeBackLayers: (layers: DesignLayer[]) => void;
  backFromPdf: { file: File; page: number } | null;
  // Avis "PDF de N pages, seule la page 1 sera utilisée" etc. — calculé dans
  // DesignTool (lib/pdf/pdfPages.ts), affiché sous le sélecteur de fichier.
  pdfWarning: PdfPagePlan["warning"];
  // Un visuel est-il choisi de chaque côté ? Tant que non, "Voir le résumé"
  // reste désactivé — l'ancien garde-fou de l'étape "Visuel" séparée.
  frontReady: boolean;
  backReady: boolean;
  onBack: () => void;
  onNext: () => void;
}) {
  const [activeSide, setActiveSide] = useState<"front" | "back">("front");
  // La sélection ne survit pas à un changement de côté (un calque du recto
  // n'a pas de sens sélectionné pendant qu'on regarde le verso).
  const [selectedLayerId, setSelectedLayerId] = useState<string | null>(null);
  // Une fois "Continuer quand même" confirmé (voir handleNext), le clic
  // suivant sur "Voir le résumé" avance sans redemander — jusqu'à ce que la
  // couverture change à nouveau (le visuel reste toujours accessible ici,
  // rien n'empêche d'y revenir).
  const [confirmingCoverage, setConfirmingCoverage] = useState(false);
  const side = template.two_sided ? activeSide : "front";
  // Couvert par le visuel de fond OU par un calque forme qui remplit toute
  // la page à lui seul (voir layersFullyCoverCanvas) — dans ce cas, la
  // bordure blanche du fond ne se voit de toute façon plus, l'alerte n'a
  // plus lieu d'être.
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

  function handleNext() {
    if (anyUncovered && !confirmingCoverage) {
      setConfirmingCoverage(true);
      return;
    }
    onNext();
  }
  // Format actuel (déjà orienté) — détermine lequel des deux boutons
  // Portrait/Paysage est actif.
  const effectiveIsLandscape = isLandscape(template.width_mm, template.height_mm);

  function rotateVisual() {
    activeOnChange({ rotation: ((activeValue.rotation ?? 0) + 90) % 360, scale: undefined });
  }

  function fillSpace() {
    activeOnChange({ scale: 1 });
  }

  function recenter() {
    activeOnChange({ positionX: 0.5, positionY: 0.5, scale: undefined });
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-text-subtle">Design — {template.name}</p>
          <h2 className="font-heading text-xl font-semibold text-text">Ajuste ton design</h2>
        </div>
        <button
          type="button"
          onClick={onBack}
          className="rounded-lg border border-border px-4 py-2 text-sm text-text-muted hover:bg-surface-muted"
        >
          Changer de modèle
        </button>
      </div>
      <p className="text-sm text-text-muted">
        Ligne de coupe et marge de sécurité (ou le gabarit du modèle, s&apos;il en a un) sont affichés
        pour référence — glisse encore l&apos;image ou zoome si besoin.
      </p>

      {template.two_sided && (
        <div className="flex justify-center">
          <div className="flex max-w-xs rounded-lg border border-border p-0.5 text-sm">
            <button
              type="button"
              onClick={() => { setActiveSide("front"); setSelectedLayerId(null); }}
              className={`flex flex-1 items-center justify-center gap-1.5 rounded-md px-3 py-1.5 ${
                side === "front" ? "bg-primary text-text-on-brand" : "text-text-muted hover:bg-surface-muted"
              }`}
            >
              Recto
              {!frontCovers && (
                <span
                  className={`h-1.5 w-1.5 rounded-full ${side === "front" ? "bg-text-on-brand" : "bg-warning"}`}
                  aria-label="Ne couvre pas toute la zone d'impression"
                />
              )}
            </button>
            <button
              type="button"
              onClick={() => { setActiveSide("back"); setSelectedLayerId(null); }}
              className={`flex flex-1 items-center justify-center gap-1.5 rounded-md px-3 py-1.5 ${
                side === "back" ? "bg-primary text-text-on-brand" : "text-text-muted hover:bg-surface-muted"
              }`}
            >
              Verso
              {!backCovers && (
                <span
                  className={`h-1.5 w-1.5 rounded-full ${side === "back" ? "bg-text-on-brand" : "bg-warning"}`}
                  aria-label="Ne couvre pas toute la zone d'impression"
                />
              )}
            </button>
          </div>
        </div>
      )}

      {/* Deux barres latérales encadrant l'aperçu : Visuel + Plan de travail
          à gauche (le choix du fichier avant son cadrage — l'ordre de
          lecture naturel), Calques (outils compris) à droite — en colonne
          sur mobile (l'aperçu d'abord, les deux barres empilées ensuite), en
          ligne à partir de `sm`. */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:gap-6">
        <div className="flex flex-col gap-4 sm:w-48 sm:shrink-0">
          <SidebarGroup title="Visuel">
            {side === "front" ? (
              <ImageSourcePicker
                key="front-file"
                side="front"
                template={template}
                rotated={rotated}
                visuals={visuals}
                value={front}
                onChange={onChangeFront}
                logo={null}
                showGuides={false}
                sourceModes={["upload"]}
                showPreview={false}
              />
            ) : (
              <ImageSourcePicker
                key="back-file"
                side="back"
                template={template}
                rotated={rotated}
                visuals={visuals}
                value={back}
                onChange={onChangeBack}
                logo={null}
                pairedPdf={backFromPdf}
                showGuides={false}
                sourceModes={["upload"]}
                showPreview={false}
              />
            )}
            {pdfWarning && side === "front" && (
              <p className="rounded-lg border border-warning bg-warning-subtle p-3 text-xs text-text">
                ⚠ {pdfWarning}
              </p>
            )}
            {/* Zoom (recadrage) — au-dessus de "Pivoter le visuel", même
                réglage (`activeValue.scale`) qu'avant quand il vivait dans
                ImageSourcePicker (voir `allowZoom`, retiré de là). */}
            <div className="flex items-center gap-3">
              <span className="shrink-0 text-xs text-text-subtle">Zoom</span>
              <input
                type="range"
                // 0.1 = même plancher que le recadrage serveur (coverCropToBuffer).
                min={0.1}
                max={3}
                step={0.02}
                value={activeValue.scale ?? 1}
                onChange={(e) => activeOnChange({ scale: parseFloat(e.target.value) })}
                className="min-w-0 flex-1"
                style={{ accentColor: "var(--accent)" }}
                aria-label="Zoom (recadrage) — en dessous de 100 %, une marge blanche apparaît autour de l'image"
              />
              <span className="w-10 shrink-0 text-right text-xs text-text-subtle">
                {Math.round((activeValue.scale ?? 1) * 100)}%
              </span>
            </div>
            <SidebarButton icon={RotateCwIcon} label="Pivoter le visuel" onClick={rotateVisual} />
            <SidebarButton icon={ExpandIcon} label="Maximiser l'espace" onClick={fillSpace} />
            <SidebarButton icon={RefreshCcwIcon} label="Réinitialiser" onClick={recenter} />
          </SidebarGroup>

          {rawTemplate.allow_orientation_change && (
            <SidebarGroup title="Plan de travail">
              <SidebarButton
                label="Portrait"
                active={!effectiveIsLandscape}
                onClick={() => onRotatedChange(isLandscape(rawTemplate.width_mm, rawTemplate.height_mm))}
              />
              <SidebarButton
                label="Paysage"
                active={effectiveIsLandscape}
                onClick={() => onRotatedChange(!isLandscape(rawTemplate.width_mm, rawTemplate.height_mm))}
              />
            </SidebarGroup>
          )}
        </div>

        <div className="min-w-0 flex-1">
          <div className="mx-auto w-full">
            {!activeCovers && (
              <p className="mb-3 rounded-lg border border-warning bg-warning-subtle p-3 text-sm text-text">
                ⚠ Ton visuel ne couvre pas toute la zone d&apos;impression — il y aura une bordure blanche autour.
                Augmente le zoom si tu n&apos;en veux pas.
              </p>
            )}
            {side === "front" ? (
              <ImageSourcePicker
                key="front"
                side="front"
                template={template}
                rotated={rotated}
                visuals={visuals}
                value={front}
                onChange={onChangeFront}
                logo={null}
                previewSize="lg"
                allowZoom
                layers={frontLayers}
                onChangeLayers={onChangeFrontLayers}
                selectedLayerId={selectedLayerId}
                sourceModes={["upload"]}
                allowFileChange={false}
              />
            ) : (
              <ImageSourcePicker
                key="back"
                side="back"
                template={template}
                rotated={rotated}
                visuals={visuals}
                value={back}
                onChange={onChangeBack}
                logo={null}
                pairedPdf={backFromPdf}
                previewSize="lg"
                allowZoom
                layers={backLayers}
                onChangeLayers={onChangeBackLayers}
                selectedLayerId={selectedLayerId}
                sourceModes={["upload"]}
                allowFileChange={false}
              />
            )}
          </div>
        </div>

        {/* Calques (et ses outils : ajouter, réordonner, éditeur) à droite
            de l'aperçu — Plan de travail et Visuel sont eux dans la barre de
            gauche, voir plus haut. */}
        <div className="flex flex-col gap-4 sm:w-48 sm:shrink-0">
          <LayersPanel
            layers={activeLayers}
            onChangeLayers={activeOnChangeLayers}
            selectedLayerId={selectedLayerId}
            onSelectLayer={setSelectedLayerId}
            maxFontSizeMm={maxFontSizeMm}
          />
        </div>
      </div>

      <div className="flex justify-center border-t border-border pt-6">
        {confirmingCoverage && anyUncovered ? (
          <div className="w-full max-w-md space-y-3 text-center">
            <p className="rounded-lg border border-warning bg-warning-subtle p-3 text-sm text-text">
              ⚠ {uncoveredLabel} pas toute la zone d&apos;impression — il y aura une bordure blanche autour.
            </p>
            <div className="flex justify-center gap-3">
              <button
                type="button"
                onClick={() => setConfirmingCoverage(false)}
                className="rounded-lg border border-border px-4 py-2 text-sm text-text-muted hover:bg-surface-muted"
              >
                Ajuster le visuel
              </button>
              <button
                type="button"
                onClick={onNext}
                className="inline-flex items-center gap-2 rounded-full bg-primary px-6 py-3 text-sm font-medium text-text-on-brand hover:bg-primary-hover"
              >
                Continuer quand même
              </button>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2">
            <button
              type="button"
              onClick={handleNext}
              disabled={!frontReady || !backReady}
              className="inline-flex items-center gap-2 rounded-full bg-primary px-6 py-3 text-sm font-medium text-text-on-brand hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-50"
            >
              Voir le résumé
            </button>
            {(!frontReady || !backReady) && (
              <p className="text-xs text-text-subtle">
                Choisis {!frontReady && !backReady ? "un visuel recto et verso" : !frontReady ? "un visuel recto" : "un visuel verso"} pour continuer.
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
