"use client";

import { useEffect, useRef, useState } from "react";
import type { LogoShape, Template, VisualMode } from "@/lib/types";
import type { LogoShadowSettings } from "@/lib/logoShadowSettings";
import type { VisualWithUrl } from "@/components/VisualsGrid";
import VisualPicker from "@/components/VisualPicker";
import FileDropZone from "@/components/FileDropZone";
import { mmToIn, inToMm } from "@/lib/pdf/units";
import { SpinnerIcon } from "@/components/icons";
import { fontOptionById } from "@/lib/design/fonts";
import { maxTextSizeMmForTemplate, type DesignLayer, type ImageLayer } from "@/lib/design/layers";

export type SourceMode = "upload" | VisualMode;

// Curseur "zoom" pour la taille de répétition (mosaïque) : un ratio 1-100
// (pas une unité physique) sur échelle logarithmique en interne, pour que
// glisser le curseur produise un effet de zoom régulier plutôt qu'un pas
// linéaire peu utilisable sur une aussi grande plage de tailles réelles
// (0,1 à 24 po).
const TILE_ZOOM_MIN_IN = 0.1;
const TILE_ZOOM_MAX_IN = 24;
const TILE_ZOOM_MIN_RATIO = 1;
const TILE_ZOOM_MAX_RATIO = 100;

function tileSizeInToZoom(sizeIn: number): number {
  const clamped = Math.min(TILE_ZOOM_MAX_IN, Math.max(TILE_ZOOM_MIN_IN, sizeIn));
  const t = Math.log(clamped / TILE_ZOOM_MIN_IN) / Math.log(TILE_ZOOM_MAX_IN / TILE_ZOOM_MIN_IN);
  return TILE_ZOOM_MIN_RATIO + t * (TILE_ZOOM_MAX_RATIO - TILE_ZOOM_MIN_RATIO);
}

function zoomToTileSizeIn(zoom: number): number {
  const t = (zoom - TILE_ZOOM_MIN_RATIO) / (TILE_ZOOM_MAX_RATIO - TILE_ZOOM_MIN_RATIO);
  return TILE_ZOOM_MIN_IN * Math.pow(TILE_ZOOM_MAX_IN / TILE_ZOOM_MIN_IN, t);
}

// Zoom proposé par défaut pour une nouvelle mosaïque (l'échelle ci-dessus
// n'est pas linéaire : 60 correspond à un motif d'environ 2,6 po).
export const DEFAULT_TILE_ZOOM = 60;
export const DEFAULT_TILE_SIZE_MM = inToMm(zoomToTileSizeIn(DEFAULT_TILE_ZOOM));

export function isPdfFile(file: File | null): boolean {
  return Boolean(file && (file.type === "application/pdf" || /\.pdf$/i.test(file.name)));
}

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
  // Zoom relatif au cadrage "cover" minimal (1 = ce minimum, sans marge) —
  // voir coverCropToBuffer. >1 resserre le cadrage, <1 laisse une marge
  // blanche autour de l'image. Optionnel : seule l'étape « Aperçu » de
  // Design Shopify l'expose (allowZoom).
  scale?: number;
  // Rotation du visuel lui-même, en degrés (0/90/180/270) — distinct de
  // `rotated` (Portrait/Paysage du modèle) : ici c'est l'image qui tourne
  // dans son cadre, pas le cadre qui change de forme. Voir coverCropToBuffer.
  // Optionnel : seule l'étape « Aperçu » de Design Shopify l'expose (allowZoom).
  rotation?: number;
}

// Poignées de rotation/redimensionnement du calque sélectionné — affichées
// par LayerHandles, imbriquées dans le même conteneur déjà positionné/
// tourné que le calque (voir son rendu plus bas) : leur position à l'écran
// suit donc automatiquement la rotation courante, sans calcul dédié. Seule
// la poignée de rotation, elle, a besoin de connaître le centre réel du
// calque à l'écran (`getBoundingClientRect`) pour convertir un mouvement de
// souris en angle.
function LayerHandles({
  layer,
  layers,
  onChangeLayers,
  previewBoxRef,
  maxFontSizeMm,
}: {
  layer: DesignLayer;
  layers: DesignLayer[];
  onChangeLayers: (layers: DesignLayer[]) => void;
  previewBoxRef: React.RefObject<HTMLDivElement>;
  maxFontSizeMm: number;
}) {
  const dragRef = useRef<{
    mode: "rotate" | "resize";
    centerX: number;
    centerY: number;
    startAngleDeg: number;
    startRotationDeg: number;
    startDist: number;
    startFontSizeMm: number;
    startWidthRatio: number;
    startHeightRatio: number;
  } | null>(null);

  function centerPx() {
    const box = previewBoxRef.current;
    if (!box) return { x: 0, y: 0 };
    const rect = box.getBoundingClientRect();
    return { x: rect.left + layer.positionX * rect.width, y: rect.top + layer.positionY * rect.height };
  }

  function beginDrag(e: React.PointerEvent<HTMLDivElement>, mode: "rotate" | "resize") {
    e.stopPropagation();
    const { x, y } = centerPx();
    const startAngleDeg = (Math.atan2(e.clientY - y, e.clientX - x) * 180) / Math.PI;
    const startDist = Math.max(1, Math.hypot(e.clientX - x, e.clientY - y));
    dragRef.current = {
      mode,
      centerX: x,
      centerY: y,
      startAngleDeg,
      startRotationDeg: layer.rotationDeg ?? 0,
      startDist,
      startFontSizeMm: layer.type === "text" ? layer.fontSizeMm : 0,
      startWidthRatio: layer.type === "image" || layer.type === "shape" ? layer.widthRatio : 0,
      startHeightRatio: layer.type === "shape" ? layer.heightRatio : 0,
    };
    e.currentTarget.setPointerCapture(e.pointerId);
  }

  function handleMove(e: React.PointerEvent<HTMLDivElement>) {
    const d = dragRef.current;
    if (!d) return;
    if (d.mode === "rotate") {
      const angleDeg = (Math.atan2(e.clientY - d.centerY, e.clientX - d.centerX) * 180) / Math.PI;
      let next = d.startRotationDeg + (angleDeg - d.startAngleDeg);
      // Aimante les angles ronds (tous les 45°) à 4° près — pratique pour
      // remettre un texte bien horizontal/vertical sans viser au pixel près.
      const snapped = Math.round(next / 45) * 45;
      if (Math.abs(next - snapped) < 4) next = snapped;
      next = ((next % 360) + 360) % 360;
      onChangeLayers(layers.map((l) => (l.id === layer.id ? { ...l, rotationDeg: next } : l)));
    } else {
      const dist = Math.max(1, Math.hypot(e.clientX - d.centerX, e.clientY - d.centerY));
      const scale = dist / d.startDist;
      if (layer.type === "text") {
        const next = Math.min(maxFontSizeMm, Math.max(3, d.startFontSizeMm * scale));
        onChangeLayers(layers.map((l) => (l.id === layer.id ? { ...l, fontSizeMm: next } : l)));
      } else if (layer.type === "shape") {
        const nextWidth = Math.min(1.5, Math.max(0.05, d.startWidthRatio * scale));
        const nextHeight = Math.min(1.5, Math.max(0.05, d.startHeightRatio * scale));
        onChangeLayers(
          layers.map((l) => (l.id === layer.id ? { ...l, widthRatio: nextWidth, heightRatio: nextHeight } : l))
        );
      } else {
        const next = Math.min(1, Math.max(0.05, d.startWidthRatio * scale));
        onChangeLayers(layers.map((l) => (l.id === layer.id ? { ...l, widthRatio: next } : l)));
      }
    }
  }

  function endDrag() {
    dragRef.current = null;
  }

  return (
    <>
      <div
        onPointerDown={(e) => beginDrag(e, "rotate")}
        onPointerMove={handleMove}
        onPointerUp={endDrag}
        role="button"
        aria-label="Pivoter le calque"
        className="absolute left-1/2 top-0 h-4 w-4 -translate-x-1/2 -translate-y-7 cursor-alias touch-none rounded-full border-2 border-[var(--accent)] bg-white shadow"
      />
      <div
        onPointerDown={(e) => beginDrag(e, "resize")}
        onPointerMove={handleMove}
        onPointerUp={endDrag}
        role="button"
        aria-label="Redimensionner le calque"
        className="absolute bottom-0 right-0 h-3 w-3 translate-x-1/2 translate-y-1/2 cursor-nwse-resize touch-none rounded-sm border-2 border-[var(--accent)] bg-white shadow"
      />
    </>
  );
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
  rotated,
  visuals,
  value,
  onChange,
  currentImageUrl,
  logo,
  previewUnavailableMessage,
  pairedPdf,
  previewSize = "sm",
  showGuides = true,
  allowZoom = false,
  sourceModes = ["upload", "full", "tile"],
  allowFileChange = true,
  showPreview = true,
  layers = [],
  onChangeLayers,
  selectedLayerId = null,
}: {
  side: "front" | "back";
  template: Template | null;
  rotated: boolean;
  visuals: VisualWithUrl[];
  value: ImageSourceValue;
  onChange: (patch: Partial<ImageSourceValue>) => void;
  currentImageUrl?: string | null;
  logo: {
    shape: LogoShape;
    color: string;
    secondaryColor: string;
    // null = sans ombre portée
    shadow: LogoShadowSettings | null;
  } | null;
  previewUnavailableMessage?: string;
  // Verso tiré du PDF du recto (page `page`) tant qu'aucun fichier n'est choisi ici.
  pairedPdf?: { file: File; page: number } | null;
  // Largeur de l'aperçu : "sm" (défaut, formulaires admin étroits) ou "lg"
  // (étape 3 de Design Shopify — aperçu zoomé, même mécanique de glisser).
  previewSize?: "sm" | "lg";
  // Ligne de coupe/marge de sécurité/gabarit : affichés par défaut (admin).
  // Design Shopify les masque à l'étape « Visuel » (false) — seule l'étape
  // « Aperçu » les montre.
  showGuides?: boolean;
  // Curseur de zoom (recadrage) — masqué par défaut ; seule l'étape « Aperçu »
  // de Design Shopify l'active.
  allowZoom?: boolean;
  // Sources proposées : les trois par défaut (admin). Design Shopify ne
  // propose que l'upload — pas la banque de visuels, réservée à l'admin.
  sourceModes?: SourceMode[];
  // Champ "Choisir un fichier" : affiché par défaut. L'étape « Aperçu » de
  // Design Shopify le masque (false) — le fichier est déjà choisi à
  // l'étape précédente, on ne fait qu'ajuster son cadrage ici.
  allowFileChange?: boolean;
  // Section "Aperçu" (positionnement/zoom/repères) : affichée par défaut.
  // L'étape « Visuel » de Design Shopify la masque (false) — le fichier s'y
  // choisit seulement, l'ajustement se fait à l'étape « Aperçu » suivante.
  showPreview?: boolean;
  // Calques additionnels (texte/image) de ce côté — voir lib/design/layers.ts
  // et le panneau qui les possède (LayersPanel, dans DesignPreview). Jamais
  // fournis par ProductForm (outil interne) : tableau vide par défaut.
  layers?: DesignLayer[];
  onChangeLayers?: (layers: DesignLayer[]) => void;
  // Seul le calque sélectionné (dans le panneau) se déplace au glisser sur
  // l'aperçu — sans sélection, glisser continue de repositionner le fond,
  // comme avant les calques.
  selectedLayerId?: string | null;
}) {
  const { sourceMode, visualId, tileSizeMm, positionX, positionY } = value;
  // Fichier réellement utilisé : celui choisi ici, sinon le PDF du recto.
  const file = value.file ?? (sourceMode === "upload" ? pairedPdf?.file ?? null : null);
  const pdfPage = value.file ? 1 : pairedPdf?.page ?? 1;
  const [preview, setPreview] = useState<string | null>(null);
  // Clé stable des réglages d'ombre, pour relancer l'aperçu quand ils changent.
  const shadowKey = JSON.stringify(logo?.shadow ?? null);

  // Le "cadre" (traits de coupe/sécurité, gabarit, logo) est un calque
  // transparent séparé du fond : il ne bouge jamais pendant le glisser.
  const [frameOverlayUrl, setFrameOverlayUrl] = useState<string | null>(null);
  const [frameLoading, setFrameLoading] = useState(false);
  const [frameError, setFrameError] = useState<string | null>(null);
  const frameTokenRef = useRef(0);

  // Le fond, lui, dépend du mode : en upload (image)/plein format, l'image
  // brute est affichée directement côté client (object-position instantané) ;
  // en mosaïque, ou pour un PDF uploadé (illisible tel quel par <img>), le
  // fond doit être rendu côté serveur (débouncé).
  const [renderedBackgroundUrl, setRenderedBackgroundUrl] = useState<string | null>(null);
  const [renderedBgLoading, setRenderedBgLoading] = useState(false);
  const [renderedBgError, setRenderedBgError] = useState<string | null>(null);
  const renderedBgTokenRef = useRef(0);

  const previewBoxRef = useRef<HTMLDivElement>(null);
  const draggingRef = useRef(false);
  const lastPointRef = useRef<{ x: number; y: number } | null>(null);
  const [dragOffsetPx, setDragOffsetPx] = useState({ x: 0, y: 0 });

  // Taille réelle (px) de la boîte d'aperçu et de l'image affichée — pour
  // placer le fond par un calcul exact (position + zoom, y compris < 100 %)
  // plutôt que l'approximation object-position/transform d'origine, qui ne
  // suivait pas correctement le glisser une fois dézoomé.
  const [boxSize, setBoxSize] = useState({ width: 0, height: 0 });
  const [naturalSize, setNaturalSize] = useState<{ width: number; height: number } | null>(null);

  const hasSource = sourceMode === "upload" ? Boolean(file || currentImageUrl) : Boolean(visualId);
  const canPosition = Boolean(template) && hasSource;
  // L'aperçu (et ses calques) s'affiche dès qu'un modèle est choisi, même
  // sans visuel de fond — un canvas blanc (voir plus bas), pour permettre un
  // montage fait seulement de calques (texte/image/forme). `canPosition`,
  // lui, reste réservé à ce qui n'a de sens qu'avec un fond réel (recentrer,
  // rendu du fond).
  const hasTemplate = Boolean(template);

  // Dépend de `hasTemplate`, pas `[]` : la boîte (previewBoxRef) n'existe
  // dans le DOM que quand `hasTemplate` est vrai (voir plus bas) — si ce
  // composant est monté AVANT qu'un modèle soit choisi, l'effet tournerait
  // une seule fois sur une ref encore nulle et ne se rebrancherait jamais —
  // boxSize resterait bloqué à {0,0}, et donc le zoom et le placement des
  // calques (qui en ont besoin) n'auraient plus aucun effet visible.
  useEffect(() => {
    const el = previewBoxRef.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => {
      if (entry) setBoxSize({ width: entry.contentRect.width, height: entry.contentRect.height });
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [hasTemplate]);

  // Aperçu local du fichier uploadé (aperçu brut sous le champ + fond de
  // l'aperçu positionnable) — sauf pour un PDF, qu'une balise <img> ne peut
  // pas afficher : son aperçu est rendu côté serveur à la place (voir
  // l'effet ci-dessous).
  useEffect(() => {
    if (!file || isPdfFile(file)) {
      setPreview(null);
      return;
    }
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  useEffect(() => {
    if (!template || !showGuides) {
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
      formData.append("rotated", String(rotated));
      // Sans ce drapeau, le serveur suppose que le logo est affiché : décocher
      // « Afficher le logo » ne le retirait pas de l'aperçu.
      formData.append("showLogo", String(logo !== null));
      if (logo) {
        formData.append("logoShape", logo.shape);
        formData.append("logoColor", logo.color);
        formData.append("logoSecondaryColor", logo.secondaryColor);
        formData.append("logoShadow", String(logo.shadow !== null));
        if (logo.shadow) {
          formData.append("logoShadowBlur", String(logo.shadow.blur));
          formData.append("logoShadowDistance", String(logo.shadow.distance));
          formData.append("logoShadowAngle", String(logo.shadow.angle));
          formData.append("logoShadowOpacity", String(logo.shadow.opacity));
        }
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
  }, [template, side, rotated, logo?.shape, logo?.color, logo?.secondaryColor, shadowKey, showGuides]);

  useEffect(() => {
    return () => {
      if (frameOverlayUrl) URL.revokeObjectURL(frameOverlayUrl);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const isPdfUpload = sourceMode === "upload" && isPdfFile(file);

  useEffect(() => {
    if (!((sourceMode === "tile" || isPdfUpload) && canPosition && template)) {
      setRenderedBackgroundUrl((old) => {
        if (old) URL.revokeObjectURL(old);
        return null;
      });
      setRenderedBgError(null);
      return;
    }

    const token = ++renderedBgTokenRef.current;
    const timeout = setTimeout(async () => {
      setRenderedBgLoading(true);
      setRenderedBgError(null);

      const formData = new FormData();
      formData.append("templateId", template.id);
      if (isPdfUpload && file) {
        formData.append("image", file);
        formData.append("pdfPage", String(pdfPage));
      } else {
        formData.append("visualId", visualId);
        formData.append("visualMode", "tile");
        formData.append("tileSizeMm", String(tileSizeMm));
      }
      formData.append("positionX", String(positionX));
      formData.append("positionY", String(positionY));
      formData.append("mode", "background");
      formData.append("rotated", String(rotated));

      const res = await fetch("/api/products/preview", { method: "POST", body: formData });
      if (token !== renderedBgTokenRef.current) return;

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setRenderedBgError(data.error ?? "Erreur lors de la génération de l'aperçu.");
        setRenderedBgLoading(false);
        return;
      }
      const blob = await res.blob();
      setRenderedBackgroundUrl((old) => {
        if (old) URL.revokeObjectURL(old);
        return URL.createObjectURL(blob);
      });
      setRenderedBgLoading(false);
    }, 400);

    return () => clearTimeout(timeout);
  }, [sourceMode, isPdfUpload, file, pdfPage, canPosition, template, rotated, visualId, tileSizeMm, positionX, positionY]);

  useEffect(() => {
    return () => {
      if (renderedBackgroundUrl) URL.revokeObjectURL(renderedBackgroundUrl);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    setDragOffsetPx({ x: 0, y: 0 });
  }, [renderedBackgroundUrl]);

  function handleVisualChange(id: string) {
    onChange({ visualId: id, positionX: 0.5, positionY: 0.5, scale: undefined, rotation: 0 });
  }

  function recenter() {
    // `scale: undefined` (plutôt que 1) relance l'effet ci-dessous qui
    // recalcule le zoom "on voit tout le visuel" pour l'image courante,
    // quand le zoom est réglable (voir son commentaire) — pour l'admin
    // (zoom non réglable), c'est équivalent à 1, comme avant. Ne touche pas
    // à la rotation : un choix délibéré, contrairement au cadrage.
    onChange({ positionX: 0.5, positionY: 0.5, scale: undefined });
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
    const dx = dxPx / rect.width;
    const dy = dyPx / rect.height;

    // Un calque sélectionné capte le glisser à sa place (suit directement le
    // curseur) plutôt que le fond (qui, lui, recadre — glisser à droite
    // révèle la gauche de l'image, l'inverse d'un déplacement direct).
    const selectedLayer = onChangeLayers ? layers.find((l) => l.id === selectedLayerId) : undefined;
    if (selectedLayer && onChangeLayers) {
      onChangeLayers(
        layers.map((l) =>
          l.id === selectedLayer.id
            ? { ...l, positionX: Math.min(1, Math.max(0, l.positionX + dx)), positionY: Math.min(1, Math.max(0, l.positionY + dy)) }
            : l
        )
      );
      return;
    }

    setDragOffsetPx((o) => ({ x: o.x + dxPx, y: o.y + dyPx }));
    onChange({
      positionX: Math.min(1, Math.max(0, positionX - dx)),
      positionY: Math.min(1, Math.max(0, positionY - dy)),
    });
  }

  function handlePointerUp() {
    draggingRef.current = false;
    lastPointRef.current = null;
  }

  // Aperçu (URL objet) de chaque calque image — recalculé seulement quand
  // l'ensemble des fichiers change (clé dérivée), pas à chaque rendu, pour
  // ne pas fuiter des URL objet en continu pendant qu'on glisse un calque.
  const [layerImageUrls, setLayerImageUrls] = useState<Record<string, string>>({});
  const imageLayerFilesKey = layers
    .filter((l): l is ImageLayer => l.type === "image")
    .map((l) => `${l.id}:${l.file?.name ?? ""}:${l.file?.size ?? 0}`)
    .join("|");
  useEffect(() => {
    const next: Record<string, string> = {};
    for (const l of layers) {
      if (l.type === "image" && l.file) next[l.id] = URL.createObjectURL(l.file);
    }
    setLayerImageUrls(next);
    return () => {
      Object.values(next).forEach((url) => URL.revokeObjectURL(url));
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [imageLayerFilesKey]);

  const pageAspectRatio = template
    ? (template.width_mm + template.bleed_mm * 2) / (template.height_mm + template.bleed_mm * 2)
    : 1;
  // Pixels d'aperçu par mm de page (fond perdu compris) — convertit la
  // taille de police d'un calque texte (en mm, comme le reste du modèle) en
  // pixels d'écran pour cette boîte précise.
  const pxPerMm = template && boxSize.width > 0 ? boxSize.width / (template.width_mm + template.bleed_mm * 2) : 0;
  const maxFontSizeMm = maxTextSizeMmForTemplate(template);
  const selectedVisual = visuals.find((v) => v.id === visualId) ?? null;
  const rawBackgroundUrl =
    sourceMode === "upload"
      ? preview ?? currentImageUrl ?? null
      : sourceMode === "full"
      ? selectedVisual?.fileUrl ?? null
      : null;
  const backgroundUrl =
    sourceMode === "tile" || isPdfUpload ? renderedBackgroundUrl ?? rawBackgroundUrl : rawBackgroundUrl;
  const previewLoading = frameLoading || ((sourceMode === "tile" || isPdfUpload) && renderedBgLoading);
  const previewError = frameError ?? (sourceMode === "tile" || isPdfUpload ? renderedBgError : null);

  // Nouvelle image : la taille naturelle connue ne vaut plus rien tant que
  // la nouvelle n'a pas fini de charger (onLoad, plus bas).
  useEffect(() => {
    setNaturalSize(null);
  }, [backgroundUrl]);

  // Pas de zoom par défaut calculé : `scale` indéfini retombe sur 1 (cadrage
  // "cover", voir `value.scale ?? 1` plus bas et dans backgroundGeometry) —
  // le visuel couvre toute la zone d'impression par défaut, comme
  // "Maximiser l'espace" (voir DesignPreview), pour ne pas déclencher son
  // alerte de bordure blanche sans que le client ait rien touché. Un ancien
  // comportement calculait ici le zoom "on voit tout le visuel en entier"
  // (letterboxé) par défaut ; abandonné, remplacé par ce choix inverse.

  // Géométrie exacte du fond (hors mosaïque) : reproduit très précisément le
  // calcul serveur (coverCropToBuffer — cover-fit × zoom, puis positionné
  // selon positionX/Y), plutôt que l'ancienne approximation CSS
  // object-position + transform:scale, qui ne suivait plus correctement le
  // point focal une fois zoomée en dessous de 100 % (dézoomée).
  //
  // Rotation (voir `rotation` sur ImageSourceValue) : l'élément <img> tourne
  // sur lui-même (`transform: rotate(...)`), sans changer ses propres
  // largeur/hauteur — son centre doit donc coïncider avec celui de la boîte
  // "effective" (post-rotation) calculée normalement, pas avec celle-ci
  // elle-même. À 90°/270°, cette boîte effective a largeur/hauteur
  // échangées par rapport à l'image telle que chargée (`naturalSize`) ; à
  // 0°/180°, rien à échanger, et la formule retombe exactement sur celle
  // d'avant la rotation.
  const backgroundGeometry =
    naturalSize && boxSize.width > 0 && boxSize.height > 0
      ? (() => {
          const zoom = value.scale ?? 1;
          const rotation = value.rotation ?? 0;
          const swapped = rotation % 180 === 90;
          const effW = swapped ? naturalSize.height : naturalSize.width;
          const effH = swapped ? naturalSize.width : naturalSize.height;
          const coverScale = Math.max(boxSize.width / effW, boxSize.height / effH);
          const scale = coverScale * Math.max(0.1, zoom);
          const boundingWidth = effW * scale;
          const boundingHeight = effH * scale;
          const boundingLeft = (boxSize.width - boundingWidth) * positionX;
          const boundingTop = (boxSize.height - boundingHeight) * positionY;
          const width = naturalSize.width * scale;
          const height = naturalSize.height * scale;
          return {
            width,
            height,
            left: boundingLeft + boundingWidth / 2 - width / 2,
            top: boundingTop + boundingHeight / 2 - height / 2,
            rotation,
          };
        })()
      : null;

  const availableSourceModes = SOURCE_MODES.filter((m) => sourceModes.includes(m.value));

  return (
    <div className="space-y-4">
      {/* Un seul mode possible (Design Shopify : upload seulement) : pas de
          bascule à afficher, rien à choisir. */}
      {availableSourceModes.length > 1 && (
        <div>
          <label className="mb-1 block text-sm font-medium">Source de l&apos;image</label>
          <div className="flex rounded-lg border border-neutral-300 p-0.5 text-sm">
            {availableSourceModes.map((m) => (
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
      )}

      {sourceMode === "upload" ? (
        allowFileChange && (
          <div>
            <label className="block text-sm font-medium">
              Image arrière-plan {currentImageUrl ? "(laisser vide pour garder l'actuelle)" : ""}
            </label>
            <div className="mt-1">
              <FileDropZone
                file={file}
                onFileChange={(f) => onChange({ file: f, positionX: 0.5, positionY: 0.5, scale: undefined, rotation: 0 })}
                accept="image/*,application/pdf"
                // Pour un PDF, `backgroundUrl` est déjà le rendu serveur de sa
                // page (voir renderedBackgroundUrl plus haut — calculé que
                // showPreview soit affiché ou non) : un vrai aperçu visuel
                // plutôt que rien tant que le rendu n'est pas prêt.
                previewUrl={isPdfUpload ? backgroundUrl : preview ?? currentImageUrl ?? null}
                helpText={
                  isPdfUpload
                    ? `📄 PDF${pdfPage > 1 ? ` (page ${pdfPage}, recto)` : ""} — sera converti en image`
                    : undefined
                }
              />
            </div>
          </div>
        )
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
            <VisualPicker visuals={visuals} value={visualId} onChange={handleVisualChange} />
          </div>

          {sourceMode === "tile" && (
            <div>
              <label className="block text-sm font-medium">Taille de répétition (zoom)</label>
              <div className="mt-1 flex items-center gap-3">
                <span className="text-xs text-neutral-400" aria-hidden="true">
                  −
                </span>
                <input
                  type="range"
                  min={1}
                  max={100}
                  step={0.1}
                  value={tileSizeInToZoom(mmToIn(tileSizeMm))}
                  onChange={(e) =>
                    onChange({ tileSizeMm: inToMm(zoomToTileSizeIn(parseFloat(e.target.value))) })
                  }
                  className="flex-1"
                  aria-label="Zoom sur le motif (taille de répétition)"
                />
                <span className="text-sm text-neutral-400" aria-hidden="true">
                  +
                </span>
                <input
                  type="number"
                  step="1"
                  min="1"
                  max="100"
                  value={Math.round(tileSizeInToZoom(mmToIn(tileSizeMm)))}
                  onChange={(e) =>
                    onChange({
                      tileSizeMm: inToMm(zoomToTileSizeIn(Math.min(100, Math.max(1, parseFloat(e.target.value) || 1)))),
                    })
                  }
                  className="w-16 shrink-0 rounded border border-neutral-300 px-2 py-1 text-sm"
                />
              </div>
            </div>
          )}
        </div>
      )}

      {showPreview && (
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
          {/* Admin (ProductForm) : seul endroit où "Recentrer" vit encore
              ici — l'étape « Aperçu » de Design Shopify (allowZoom) a ses
              propres boutons (Zoom/Remplir l'espace/Pivoter/Recentrer),
              rendus par DesignPreview en barre latérale, pas ici. */}
          {canPosition && !allowZoom && (
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
        {hasTemplate ? (
          <div className="mt-2 rounded-lg border border-neutral-200 bg-neutral-50 p-3">
            <div
              ref={previewBoxRef}
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              onPointerLeave={handlePointerUp}
              // Blanc (pas gris) : sert de "papier" au montage tant qu'aucun
              // visuel de fond n'est choisi — un choix délibéré, pas juste un
              // état de chargement transitoire (voir la demande : pouvoir
              // composer uniquement avec des calques).
              className={`relative mx-auto touch-none select-none overflow-hidden border border-neutral-200 bg-white cursor-grab active:cursor-grabbing ${
                previewSize === "lg" ? "" : "w-full max-w-xs"
              }`}
              style={
                previewSize === "lg"
                  ? // Bornée en largeur ET en hauteur en gardant le ratio de la
                    // page : `min()` choisit la contrainte la plus serrée entre
                    // 100 % du conteneur (l'outil peut prendre toute la largeur
                    // de la page, voir DesignTool/DesignPreview) et l'équivalent
                    // largeur de 60 % de la hauteur de la fenêtre — sans ce
                    // second plafond, un très grand écran étirerait la page à une
                    // hauteur excessive.
                    { aspectRatio: String(pageAspectRatio), width: `min(100%, calc(60vh * ${pageAspectRatio}))` }
                  : { aspectRatio: String(pageAspectRatio) }
              }
            >
              {/* Fond : bouge pendant le glisser, le cadre (ci-dessous) reste fixe. */}
              {backgroundUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={backgroundUrl}
                  alt=""
                  draggable={false}
                  onLoad={(e) =>
                    setNaturalSize({ width: e.currentTarget.naturalWidth, height: e.currentTarget.naturalHeight })
                  }
                  className={
                    sourceMode === "tile" || !backgroundGeometry
                      ? "absolute inset-0 h-full w-full object-cover"
                      : "absolute max-w-none"
                  }
                  style={
                    sourceMode === "tile"
                      ? { transform: `translate(${dragOffsetPx.x}px, ${dragOffsetPx.y}px)` }
                      : backgroundGeometry
                      ? {
                          width: backgroundGeometry.width,
                          height: backgroundGeometry.height,
                          left: backgroundGeometry.left,
                          top: backgroundGeometry.top,
                          transform: backgroundGeometry.rotation ? `rotate(${backgroundGeometry.rotation}deg)` : undefined,
                        }
                      : // Repli le temps que l'image/la boîte ne sont pas encore
                        // mesurées (avant le premier onLoad) : approximatif, remplacé
                        // dès que backgroundGeometry est calculable.
                        { objectPosition: `${positionX * 100}% ${positionY * 100}%` }
                  }
                />
              )}
              {/* Calques (texte/image) : entre le fond et le cadre — visibles
                  par-dessus le visuel, mais les traits de coupe/sécurité
                  restent lisibles par-dessus eux (simple repère, jamais sur
                  le produit fini). Le calque sélectionné (pointillés) est
                  celui que le glisser déplace, voir handlePointerMove. */}
              {boxSize.width > 0 &&
                layers.map((designLayer) => {
                  const isSelected = selectedLayerId === designLayer.id;
                  const rotationDeg = designLayer.rotationDeg ?? 0;
                  // Conteneur externe : centré/tourné sur (positionX, positionY) —
                  // les poignées (à l'intérieur, voir LayerHandles) héritent de
                  // cette rotation automatiquement, sans calcul dédié pour leur
                  // affichage (seul leur *comportement* au glisser en a besoin,
                  // via getBoundingClientRect). Opacité et fondu vivent aussi ici
                  // (pas sur le contenu, un cran plus bas) : `mix-blend-mode` ne
                  // se fond pas correctement avec ce qu'il y a dessous quand il
                  // est porté par un élément dont le PARENT (pas lui-même) a un
                  // `transform` — vérifié empiriquement (Chrome). Les deux
                  // doivent être sur le même élément que la rotation.
                  if (designLayer.type === "text") {
                    const font = fontOptionById(designLayer.fontId);
                    const fontSizePx = designLayer.fontSizeMm * pxPerMm;
                    const strokeWidthPx = designLayer.strokeWidthMm ? designLayer.strokeWidthMm * pxPerMm : 0;
                    const letterSpacingPx = designLayer.letterSpacingMm ? designLayer.letterSpacingMm * pxPerMm : 0;
                    return (
                      <div
                        key={designLayer.id}
                        className="absolute"
                        style={{
                          left: designLayer.positionX * boxSize.width,
                          top: designLayer.positionY * boxSize.height,
                          transform: `translate(-50%, -50%) rotate(${rotationDeg}deg)`,
                          opacity: designLayer.opacity ?? 1,
                          mixBlendMode: (designLayer.blendMode ?? "normal") as React.CSSProperties["mixBlendMode"],
                        }}
                      >
                        <div
                          className="relative whitespace-pre"
                          style={{
                            fontFamily: font.family,
                            fontSize: fontSizePx,
                            lineHeight: 1.25,
                            fontWeight: designLayer.bold ? 700 : 400,
                            fontStyle: designLayer.italic ? "italic" : "normal",
                            color: designLayer.color,
                            textAlign: "center",
                            letterSpacing: letterSpacingPx ? `${letterSpacingPx}px` : undefined,
                            WebkitTextStrokeWidth: strokeWidthPx ? `${strokeWidthPx}px` : undefined,
                            WebkitTextStrokeColor: strokeWidthPx ? designLayer.strokeColor : undefined,
                            outline: isSelected ? "1px dashed var(--accent)" : undefined,
                            outlineOffset: 4,
                          }}
                        >
                          {designLayer.content}
                          {isSelected && onChangeLayers && (
                            <LayerHandles
                              layer={designLayer}
                              layers={layers}
                              onChangeLayers={onChangeLayers}
                              previewBoxRef={previewBoxRef}
                              maxFontSizeMm={maxFontSizeMm}
                            />
                          )}
                        </div>
                      </div>
                    );
                  }
                  if (designLayer.type === "image") {
                    const url = layerImageUrls[designLayer.id];
                    if (!url) return null;
                    const widthPx = designLayer.widthRatio * boxSize.width;
                    return (
                      <div
                        key={designLayer.id}
                        className="absolute"
                        style={{
                          left: designLayer.positionX * boxSize.width,
                          top: designLayer.positionY * boxSize.height,
                          transform: `translate(-50%, -50%) rotate(${rotationDeg}deg)`,
                          opacity: designLayer.opacity ?? 1,
                          mixBlendMode: (designLayer.blendMode ?? "normal") as React.CSSProperties["mixBlendMode"],
                        }}
                      >
                        <div className="relative" style={{ width: widthPx }}>
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={url}
                            alt=""
                            draggable={false}
                            className="block w-full max-w-none"
                            style={{
                              outline: isSelected ? "1px dashed var(--accent)" : undefined,
                              outlineOffset: 4,
                            }}
                          />
                          {isSelected && onChangeLayers && (
                            <LayerHandles
                              layer={designLayer}
                              layers={layers}
                              onChangeLayers={onChangeLayers}
                              previewBoxRef={previewBoxRef}
                              maxFontSizeMm={maxFontSizeMm}
                            />
                          )}
                        </div>
                      </div>
                    );
                  }
                  if (designLayer.type === "shape") {
                    const shapeWidthPx = designLayer.widthRatio * boxSize.width;
                    const shapeHeightPx = designLayer.heightRatio * boxSize.height;
                    const strokeWidthPx = designLayer.strokeWidthMm ? designLayer.strokeWidthMm * pxPerMm : 0;
                    return (
                      <div
                        key={designLayer.id}
                        className="absolute"
                        style={{
                          left: designLayer.positionX * boxSize.width,
                          top: designLayer.positionY * boxSize.height,
                          transform: `translate(-50%, -50%) rotate(${rotationDeg}deg)`,
                          opacity: designLayer.opacity ?? 1,
                          mixBlendMode: (designLayer.blendMode ?? "normal") as React.CSSProperties["mixBlendMode"],
                        }}
                      >
                        <div
                          className="relative box-border"
                          style={{
                            width: shapeWidthPx,
                            height: shapeHeightPx,
                            borderRadius: designLayer.shape === "ellipse" ? "50%" : 0,
                            backgroundColor: designLayer.fillEnabled ? designLayer.fillColor : "transparent",
                            border: strokeWidthPx ? `${strokeWidthPx}px solid ${designLayer.strokeColor}` : undefined,
                            outline: isSelected ? "1px dashed var(--accent)" : undefined,
                            outlineOffset: 4,
                          }}
                        >
                          {isSelected && onChangeLayers && (
                            <LayerHandles
                              layer={designLayer}
                              layers={layers}
                              onChangeLayers={onChangeLayers}
                              previewBoxRef={previewBoxRef}
                              maxFontSizeMm={maxFontSizeMm}
                            />
                          )}
                        </div>
                      </div>
                    );
                  }
                  return null;
                })}
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
              {showGuides
                ? "Ligne magenta = coupe (fond perdu) · pointillés bleus = marge de protection · glisse l'image pour la repositionner."
                : "Glisse l'image pour la repositionner."}
            </p>
          </div>
        ) : (
          // N'arrive plus qu'ici sans modèle du tout — avec un modèle mais
          // sans visuel choisi, le canvas blanc ci-dessus s'affiche déjà
          // (voir hasTemplate).
          !previewError && (
            <p className="mt-1 text-xs text-neutral-500">
              {previewUnavailableMessage ?? "Choisis un modèle pour voir l'aperçu."}
            </p>
          )
        )}
      </div>
      )}
    </div>
  );
}
