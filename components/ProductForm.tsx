"use client";

import { useEffect, useRef, useState } from "react";
import type {
  Category,
  LogoShape,
  Product,
  ProductCollection,
  Template,
  VisualMode,
} from "@/lib/types";
import type { VisualWithUrl } from "@/components/VisualsGrid";
import { formatIn, inToMm, mmToIn } from "@/lib/pdf/units";
import { LOGO_COLOR_PALETTE } from "@/lib/logoColors";
import { SpinnerIcon } from "@/components/icons";

type SourceMode = "upload" | VisualMode;

const SOURCE_MODES: { value: SourceMode; label: string }[] = [
  { value: "upload", label: "Uploader une image" },
  { value: "full", label: "Visuel — plein format" },
  { value: "tile", label: "Visuel — mosaïque" },
];

const LOGO_SHAPES: { value: LogoShape; label: string }[] = [
  { value: "logo", label: "Logo" },
  { value: "pastille", label: "Pastille" },
];

export default function ProductForm({
  templates,
  categories,
  visuals,
  collections,
  product,
  currentImageUrl,
  onSuccess,
}: {
  templates: Template[];
  categories: Category[];
  visuals: VisualWithUrl[];
  collections: ProductCollection[];
  product?: Product;
  currentImageUrl?: string | null;
  onSuccess: () => void;
}) {
  const isEditing = Boolean(product);
  const [name, setName] = useState(product?.name ?? "");
  const [nameTouched, setNameTouched] = useState(isEditing);
  const [templateId, setTemplateId] = useState(product?.template_id ?? templates[0]?.id ?? "");
  const [selectedTemplateIds, setSelectedTemplateIds] = useState<string[]>(
    !isEditing && templates[0] ? [templates[0].id] : []
  );
  const [collectionId, setCollectionId] = useState(product?.collection_id ?? "");
  const [sourceMode, setSourceMode] = useState<SourceMode>(product?.visual_mode ?? "upload");
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [visualId, setVisualId] = useState(product?.visual_id ?? visuals[0]?.id ?? "");
  const [tileSizeMm, setTileSizeMm] = useState(product?.tile_size_mm ?? inToMm(1));
  const [logoShape, setLogoShape] = useState<LogoShape>(product?.logo_shape ?? "logo");
  const [logoColor, setLogoColor] = useState(product?.logo_color ?? "#000000");
  const [logoSecondaryColor, setLogoSecondaryColor] = useState(
    product?.logo_secondary_color ?? "#FFFFFF"
  );
  const [imagePositionX, setImagePositionX] = useState(product?.image_position_x ?? 0.5);
  const [imagePositionY, setImagePositionY] = useState(product?.image_position_y ?? 0.5);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [createProgress, setCreateProgress] = useState<{ done: number; total: number } | null>(
    null
  );
  // Le "cadre" (traits de coupe/sécurité, gabarit, logo) est un calque
  // transparent séparé du fond : il ne bouge jamais pendant le glisser, ce
  // qui règle le problème "le cadre suit l'image quand on glisse".
  const [frameOverlayUrl, setFrameOverlayUrl] = useState<string | null>(null);
  const [frameLoading, setFrameLoading] = useState(false);
  const [frameError, setFrameError] = useState<string | null>(null);
  const frameTokenRef = useRef(0);
  // Le fond, lui, dépend du mode : en upload/plein format, on affiche
  // directement l'image brute côté client (object-position instantané, pas
  // d'aller-retour serveur) ; en mosaïque, le motif recadré doit être rendu
  // côté serveur (régénéré avec un léger débounce pendant le glisser).
  const [tileBackgroundUrl, setTileBackgroundUrl] = useState<string | null>(null);
  const [tileBgLoading, setTileBgLoading] = useState(false);
  const [tileBgError, setTileBgError] = useState<string | null>(null);
  const tileBgTokenRef = useRef(0);
  const previewBoxRef = useRef<HTMLDivElement>(null);
  const draggingPreviewRef = useRef(false);
  const lastDragPointRef = useRef<{ x: number; y: number } | null>(null);
  const [dragOffsetPx, setDragOffsetPx] = useState({ x: 0, y: 0 });

  // En édition, il n'y a toujours qu'un seul modèle. En création, l'aperçu
  // n'est possible que si un seul modèle est coché parmi la sélection.
  const previewTemplateId = isEditing
    ? templateId
    : selectedTemplateIds.length === 1
    ? selectedTemplateIds[0]
    : "";
  const isMultiTemplate = !isEditing && selectedTemplateIds.length > 1;
  // En édition, mode upload, sans nouveau fichier choisi : l'aperçu peut
  // quand même être régénéré à partir de l'image déjà enregistrée, pour que
  // le repositionnement soit possible sans devoir re-uploader.
  const hasUploadSource = Boolean(file) || (isEditing && sourceMode === "upload" && Boolean(product?.image_path));

  const hasSource = sourceMode === "upload" ? hasUploadSource : Boolean(visualId);
  const canPosition = !isMultiTemplate && Boolean(previewTemplateId) && hasSource;

  // Régénère le calque "cadre" (traits de coupe/sécurité, gabarit, logo —
  // fond transparent) dès que le modèle ou le logo changent. Indépendant de
  // la position : ce calque ne bouge jamais pendant le glisser.
  useEffect(() => {
    if (!previewTemplateId || isMultiTemplate) {
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
      formData.append("templateId", previewTemplateId);
      formData.append("logoShape", logoShape);
      formData.append("logoColor", logoColor);
      formData.append("logoSecondaryColor", logoSecondaryColor);
      formData.append("mode", "frame");

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
  }, [previewTemplateId, isMultiTemplate, logoShape, logoColor, logoSecondaryColor]);

  useEffect(() => {
    return () => {
      if (frameOverlayUrl) URL.revokeObjectURL(frameOverlayUrl);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Régénère le fond en mode mosaïque (motif recadré/répété, sans traits ni
  // logo) côté serveur — en upload/plein format, le fond est affiché
  // directement côté client (voir le rendu plus bas), aucun aller-retour
  // serveur n'est nécessaire pour le glisser.
  useEffect(() => {
    if (sourceMode !== "tile" || !canPosition) {
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
      formData.append("templateId", previewTemplateId);
      formData.append("visualId", visualId);
      formData.append("visualMode", "tile");
      formData.append("tileSizeMm", String(tileSizeMm));
      formData.append("positionX", String(imagePositionX));
      formData.append("positionY", String(imagePositionY));
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
  }, [sourceMode, canPosition, previewTemplateId, visualId, tileSizeMm, imagePositionX, imagePositionY]);

  useEffect(() => {
    return () => {
      if (tileBackgroundUrl) URL.revokeObjectURL(tileBackgroundUrl);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Une fois le nouveau fond mosaïque (déjà recadré à la bonne position)
  // chargé, on efface le décalage visuel temporaire appliqué pendant le
  // glisser.
  useEffect(() => {
    setDragOffsetPx({ x: 0, y: 0 });
  }, [tileBackgroundUrl]);

  // Construit le nom automatiquement tant que l'utilisateur n'a pas modifié
  // le champ à la main. Avec un seul modèle : Modèle — Visuel. Avec
  // plusieurs modèles sélectionnés, le nom saisi sert de base commune et le
  // nom du modèle est ajouté à chaque produit créé (voir handleSubmit).
  useEffect(() => {
    if (nameTouched) return;
    const visualName =
      sourceMode !== "upload" ? visuals.find((v) => v.id === visualId)?.name ?? "" : "";
    if (isMultiTemplate) {
      setName(visualName);
      return;
    }
    const templateName = templates.find((t) => t.id === previewTemplateId)?.name ?? "";
    setName(visualName ? `${templateName} — ${visualName}` : templateName);
  }, [previewTemplateId, isMultiTemplate, sourceMode, visualId, templates, visuals, nameTouched]);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0] ?? null;
    setFile(f);
    setPreview(f ? URL.createObjectURL(f) : null);
    setImagePositionX(0.5);
    setImagePositionY(0.5);
  }

  function handleVisualChange(id: string) {
    setVisualId(id);
    setImagePositionX(0.5);
    setImagePositionY(0.5);
  }

  function recenterPosition() {
    setImagePositionX(0.5);
    setImagePositionY(0.5);
    setDragOffsetPx({ x: 0, y: 0 });
  }

  // Glisser directement sur l'aperçu pour repositionner l'image, avec le
  // cadre (traits + logo) qui reste fixe : en upload/plein format, le fond
  // est une <img> brute en object-position, mise à jour en direct depuis
  // imagePositionX/Y (aucun aller-retour serveur, donc parfaitement fluide).
  // En mosaïque, le fond vient du serveur (débouncé) ; dragOffsetPx ajoute
  // un retour visuel immédiat via transform en attendant la régénération.
  function handlePreviewPointerDown(e: React.PointerEvent<HTMLDivElement>) {
    draggingPreviewRef.current = true;
    lastDragPointRef.current = { x: e.clientX, y: e.clientY };
    e.currentTarget.setPointerCapture(e.pointerId);
  }

  function handlePreviewPointerMove(e: React.PointerEvent<HTMLDivElement>) {
    if (!draggingPreviewRef.current || !lastDragPointRef.current || !previewBoxRef.current) return;
    const rect = previewBoxRef.current.getBoundingClientRect();
    const dxPx = e.clientX - lastDragPointRef.current.x;
    const dyPx = e.clientY - lastDragPointRef.current.y;
    lastDragPointRef.current = { x: e.clientX, y: e.clientY };
    setDragOffsetPx((o) => ({ x: o.x + dxPx, y: o.y + dyPx }));
    const dx = dxPx / rect.width;
    const dy = dyPx / rect.height;
    setImagePositionX((x) => Math.min(1, Math.max(0, x - dx)));
    setImagePositionY((y) => Math.min(1, Math.max(0, y - dy)));
  }

  function handlePreviewPointerUp() {
    draggingPreviewRef.current = false;
    lastDragPointRef.current = null;
  }

  function toggleTemplate(id: string, checked: boolean) {
    setSelectedTemplateIds((prev) =>
      checked ? [...prev, id] : prev.filter((existing) => existing !== id)
    );
  }

  function buildFormData(productName: string, tId: string, cId: string) {
    const formData = new FormData();
    formData.append("name", productName);
    formData.append("templateId", tId);
    formData.append("logoShape", logoShape);
    formData.append("logoColor", logoColor);
    formData.append("logoSecondaryColor", logoSecondaryColor);
    formData.append("positionX", String(imagePositionX));
    formData.append("positionY", String(imagePositionY));
    if (cId) formData.append("collectionId", cId);
    if (sourceMode === "upload") {
      if (file) formData.append("image", file);
    } else {
      formData.append("visualId", visualId);
      formData.append("visualMode", sourceMode);
      if (sourceMode === "tile") formData.append("tileSizeMm", String(tileSizeMm));
    }
    return formData;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!isEditing && selectedTemplateIds.length === 0) {
      setError("Choisis au moins un modèle.");
      return;
    }
    if (!isEditing && sourceMode === "upload" && !file) {
      setError("Une image est requise.");
      return;
    }
    if (sourceMode !== "upload" && !visualId) {
      setError("Choisis un visuel dans la banque.");
      return;
    }

    setLoading(true);
    setError(null);
    setCreateProgress(null);

    if (isEditing || !isMultiTemplate) {
      const tId = isEditing ? templateId : selectedTemplateIds[0];
      const formData = buildFormData(name, tId, collectionId);
      const res = await fetch(isEditing ? `/api/products/${product!.id}` : "/api/products", {
        method: isEditing ? "PATCH" : "POST",
        body: formData,
      });
      const data = await res.json();
      setLoading(false);
      if (!res.ok) {
        setError(data.error ?? "Erreur lors de l'enregistrement.");
        return;
      }
      if (data.pdfError) {
        alert(`Le produit a été enregistré, mais le PDF n'a pas pu être généré : ${data.pdfError}`);
      }
      onSuccess();
      return;
    }

    // Création multiple : un produit par modèle sélectionné, regroupés
    // automatiquement dans une collection si aucune n'a été choisie.
    let targetCollectionId = collectionId;
    if (!targetCollectionId) {
      const collectionName =
        name.trim() || `Collection du ${new Date().toLocaleDateString("fr-CA")}`;
      const res = await fetch("/api/product-collections", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: collectionName }),
      });
      const data = await res.json();
      if (!res.ok) {
        setLoading(false);
        setError(data.error ?? "Erreur lors de la création de la collection.");
        return;
      }
      targetCollectionId = data.collection.id;
    }

    const total = selectedTemplateIds.length;
    setCreateProgress({ done: 0, total });
    const failures: string[] = [];
    const pdfWarnings: string[] = [];
    for (const tId of selectedTemplateIds) {
      const templateName = templates.find((t) => t.id === tId)?.name ?? "";
      const productName = name.trim() ? `${name.trim()} — ${templateName}` : templateName;
      const formData = buildFormData(productName, tId, targetCollectionId);
      const res = await fetch("/api/products", { method: "POST", body: formData });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        failures.push(`${templateName} : ${data.error ?? "erreur inconnue"}`);
      } else if (data.pdfError) {
        pdfWarnings.push(`${templateName} : ${data.pdfError}`);
      }
      setCreateProgress((p) => (p ? { done: p.done + 1, total: p.total } : { done: 1, total }));
    }

    setLoading(false);
    if (failures.length > 0) {
      setError(`Certains produits n'ont pas pu être créés — ${failures.join(" · ")}`);
      return;
    }
    if (pdfWarnings.length > 0) {
      alert(
        `Les produits ont été créés, mais certains PDF n'ont pas pu être générés :\n${pdfWarnings.join(
          "\n"
        )}`
      );
    }
    onSuccess();
  }

  if (templates.length === 0) {
    return (
      <p className="rounded border border-amber-300 bg-amber-50 p-4 text-sm text-amber-800">
        Aucun modèle configuré. Crée d&apos;abord un modèle dans{" "}
        <a href="/templates" className="underline">
          Modèles
        </a>
        .
      </p>
    );
  }

  const previewTemplate = templates.find((t) => t.id === previewTemplateId) ?? null;
  const pageAspectRatio = previewTemplate
    ? (previewTemplate.width_mm + previewTemplate.bleed_mm * 2) /
      (previewTemplate.height_mm + previewTemplate.bleed_mm * 2)
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
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-medium">Nom du produit</label>
        <input
          required={!isMultiTemplate}
          value={name}
          onChange={(e) => {
            setName(e.target.value);
            setNameTouched(true);
          }}
          placeholder={isMultiTemplate ? "Ex. Collection floral (optionnel)" : "Ex. Étui iPhone 15 — motif floral"}
          className="mt-1 w-full rounded border border-neutral-300 px-3 py-2"
        />
        {!nameTouched && (
          <p className="mt-1 text-xs text-neutral-500">
            Généré automatiquement à partir du modèle et du visuel — modifiable.
          </p>
        )}
        {isMultiTemplate && (
          <p className="mt-1 text-xs text-neutral-500">
            Ce nom sert de base commune — le nom du modèle sera ajouté à chaque produit créé.
          </p>
        )}
      </div>

      {isEditing ? (
        <div>
          <label className="block text-sm font-medium">Modèle</label>
          <select
            value={templateId}
            onChange={(e) => setTemplateId(e.target.value)}
            className="mt-1 w-full rounded border border-neutral-300 px-3 py-2"
          >
            {categories.map((category) => {
              const items = templates.filter((t) => t.category_id === category.id);
              if (items.length === 0) return null;
              return (
                <optgroup key={category.id} label={category.name}>
                  {items.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name} — {formatIn(t.width_mm)}×{formatIn(t.height_mm)}
                    </option>
                  ))}
                </optgroup>
              );
            })}
          </select>
        </div>
      ) : (
        <div>
          <label className="block text-sm font-medium">
            Modèles{" "}
            {selectedTemplateIds.length > 1 && (
              <span className="font-normal text-neutral-400">
                ({selectedTemplateIds.length} sélectionnés — un produit sera créé par modèle)
              </span>
            )}
          </label>
          <div className="mt-1 max-h-64 space-y-3 overflow-y-auto rounded border border-neutral-300 p-3">
            {categories.map((category) => {
              const items = templates.filter((t) => t.category_id === category.id);
              if (items.length === 0) return null;
              return (
                <div key={category.id}>
                  <p className="mb-1 text-xs font-semibold uppercase text-neutral-400">
                    {category.name}
                  </p>
                  <div className="space-y-1">
                    {items.map((t) => (
                      <label key={t.id} className="flex items-center gap-2 text-sm text-pico-black">
                        <input
                          type="checkbox"
                          checked={selectedTemplateIds.includes(t.id)}
                          onChange={(e) => toggleTemplate(t.id, e.target.checked)}
                        />
                        {t.name} — {formatIn(t.width_mm)}×{formatIn(t.height_mm)}
                      </label>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div>
        <label className="block text-sm font-medium">Collection (optionnel)</label>
        <select
          value={collectionId}
          onChange={(e) => setCollectionId(e.target.value)}
          className="mt-1 w-full rounded border border-neutral-300 px-3 py-2"
        >
          <option value="">— Aucune —</option>
          {collections.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        {isMultiTemplate && !collectionId && (
          <p className="mt-1 text-xs text-neutral-500">
            Une collection sera créée automatiquement pour regrouper ces produits.
          </p>
        )}
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium">Source de l&apos;image</label>
        <div className="flex rounded-lg border border-neutral-300 p-0.5 text-sm">
          {SOURCE_MODES.map((m) => (
            <button
              key={m.value}
              type="button"
              onClick={() => setSourceMode(m.value)}
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
            Image {isEditing ? "(laisser vide pour garder l'actuelle)" : ""}
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
                onChange={(e) => setTileSizeMm(inToMm(parseFloat(e.target.value) || 0.01))}
                className="mt-1 w-full rounded border border-neutral-300 px-3 py-2"
              />
            </div>
          )}

        </div>
      )}

      <div>
        <label className="mb-1 block text-sm font-medium">Logo</label>
        <div className="flex rounded-lg border border-neutral-300 p-0.5 text-sm">
          {LOGO_SHAPES.map((s) => (
            <button
              key={s.value}
              type="button"
              onClick={() => setLogoShape(s.value)}
              className={`flex-1 rounded-md px-2 py-1.5 ${
                logoShape === s.value
                  ? "bg-pico-black text-white"
                  : "text-neutral-600 hover:bg-neutral-100"
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>

        <p className="mb-1 mt-3 text-xs text-neutral-500">
          {logoShape === "pastille" ? "Couleur de la pastille" : "Couleur du logo"}
        </p>
        <div className="flex flex-wrap gap-2">
          {LOGO_COLOR_PALETTE.map((c) => (
            <button
              key={c.hex}
              type="button"
              onClick={() => setLogoColor(c.hex)}
              title={c.name}
              aria-label={c.name}
              className={`h-7 w-7 rounded-full border ${
                logoColor === c.hex
                  ? "border-pico-black ring-2 ring-pico-black ring-offset-2"
                  : "border-neutral-300"
              }`}
              style={{ backgroundColor: c.hex }}
            />
          ))}
        </div>

        {logoShape === "pastille" && (
          <>
            <p className="mb-1 mt-3 text-xs text-neutral-500">Couleur du logo à l&apos;intérieur</p>
            <div className="flex flex-wrap gap-2">
              {LOGO_COLOR_PALETTE.map((c) => (
                <button
                  key={c.hex}
                  type="button"
                  onClick={() => setLogoSecondaryColor(c.hex)}
                  title={c.name}
                  aria-label={c.name}
                  className={`h-7 w-7 rounded-full border ${
                    logoSecondaryColor === c.hex
                      ? "border-pico-black ring-2 ring-pico-black ring-offset-2"
                      : "border-neutral-300"
                  }`}
                  style={{ backgroundColor: c.hex }}
                />
              ))}
            </div>
          </>
        )}
      </div>

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
              onClick={recenterPosition}
              className="text-xs text-neutral-500 underline hover:text-pico-black"
            >
              Recentrer
            </button>
          )}
        </div>
        {isMultiTemplate ? (
          <p className="mt-1 text-xs text-neutral-500">
            Aperçu disponible pour un seul modèle à la fois — décoche pour n&apos;en garder qu&apos;un
            si tu veux vérifier le rendu avant de créer la collection.
          </p>
        ) : (
          <>
            {previewError && <p className="mt-1 text-sm text-red-600">{previewError}</p>}
            {canPosition ? (
              <div className="mt-2 rounded-lg border border-neutral-200 bg-neutral-50 p-3">
                <div
                  ref={previewBoxRef}
                  onPointerDown={handlePreviewPointerDown}
                  onPointerMove={handlePreviewPointerMove}
                  onPointerUp={handlePreviewPointerUp}
                  onPointerLeave={handlePreviewPointerUp}
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
                          : { objectPosition: `${imagePositionX * 100}% ${imagePositionY * 100}%` }
                      }
                    />
                  )}
                  {/* Cadre : traits de coupe/sécurité + gabarit + logo, fond transparent, jamais déplacé. */}
                  {frameOverlayUrl && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={frameOverlayUrl}
                      alt="Aperçu du produit"
                      draggable={false}
                      className="pointer-events-none absolute inset-0 h-full w-full"
                    />
                  )}
                </div>
                <p className="mt-2 text-center text-xs text-neutral-500">
                  Ligne magenta = coupe (fond perdu) · pointillés bleus = marge de protection ·
                  glisse l&apos;image pour la repositionner.
                </p>
              </div>
            ) : (
              !previewError && (
                <p className="mt-1 text-xs text-neutral-500">
                  {sourceMode === "upload"
                    ? "Choisis une image pour voir l'aperçu."
                    : "Choisis un visuel pour voir l'aperçu."}
                </p>
              )
            )}
          </>
        )}
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}
      {createProgress && (
        <p className="flex items-center gap-2 text-sm text-neutral-500">
          <SpinnerIcon className="h-4 w-4" />
          Création des produits... ({createProgress.done}/{createProgress.total})
        </p>
      )}

      <button
        type="submit"
        disabled={loading}
        className="inline-flex items-center gap-2 rounded-lg bg-pico-maroon px-4 py-2 text-white hover:bg-pico-maroon-dark disabled:opacity-50"
      >
        {loading && <SpinnerIcon className="h-4 w-4" />}
        {loading
          ? "Enregistrement..."
          : isEditing
          ? "Enregistrer"
          : isMultiTemplate
          ? `Créer ${selectedTemplateIds.length} produits`
          : "Créer le produit"}
      </button>
    </form>
  );
}
