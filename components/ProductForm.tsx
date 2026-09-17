"use client";

import { useEffect, useRef, useState } from "react";
import type { Category, LogoShape, Product, ProductCollection, Template } from "@/lib/types";
import type { VisualWithUrl } from "@/components/VisualsGrid";
import ImageSourcePicker, { type ImageSourceValue } from "@/components/ImageSourcePicker";
import { formatIn, inToMm } from "@/lib/pdf/units";
import { LOGO_COLOR_PALETTE } from "@/lib/logoColors";
import { applyOrientation, isLandscape } from "@/lib/pdf/orientation";
import { SpinnerIcon } from "@/components/icons";

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
  currentBackImageUrl,
  onSuccess,
}: {
  templates: Template[];
  categories: Category[];
  visuals: VisualWithUrl[];
  collections: ProductCollection[];
  product?: Product;
  currentImageUrl?: string | null;
  currentBackImageUrl?: string | null;
  onSuccess: () => void;
}) {
  const isEditing = Boolean(product);
  const [name, setName] = useState(product?.name ?? "");
  const [nameTouched, setNameTouched] = useState(isEditing);
  const [templateId, setTemplateId] = useState(product?.template_id ?? templates[0]?.id ?? "");
  const [selectedTemplateIds, setSelectedTemplateIds] = useState<string[]>([]);
  const [collectionId, setCollectionId] = useState(product?.collection_id ?? "");
  const [front, setFront] = useState<ImageSourceValue>({
    sourceMode: product?.visual_mode ?? "upload",
    file: null,
    visualId: product?.visual_id ?? visuals[0]?.id ?? "",
    tileSizeMm: product?.tile_size_mm ?? inToMm(1),
    positionX: product?.image_position_x ?? 0.5,
    positionY: product?.image_position_y ?? 0.5,
  });
  const [back, setBack] = useState<ImageSourceValue>({
    sourceMode: product?.back_visual_mode ?? "upload",
    file: null,
    visualId: product?.back_visual_id ?? visuals[0]?.id ?? "",
    tileSizeMm: product?.back_tile_size_mm ?? inToMm(1),
    positionX: product?.back_image_position_x ?? 0.5,
    positionY: product?.back_image_position_y ?? 0.5,
  });
  const [rotated, setRotated] = useState(product?.rotated ?? false);
  const [logoShape, setLogoShape] = useState<LogoShape>(product?.logo_shape ?? "logo");
  const [logoColor, setLogoColor] = useState(product?.logo_color ?? "#000000");
  const [logoSecondaryColor, setLogoSecondaryColor] = useState(
    product?.logo_secondary_color ?? "#FFFFFF"
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [createProgress, setCreateProgress] = useState<{ done: number; total: number } | null>(
    null
  );

  // En édition, il n'y a toujours qu'un seul modèle. En création, l'aperçu
  // (et le verso) ne sont possibles que si un seul modèle est coché parmi
  // la sélection.
  const previewTemplateId = isEditing
    ? templateId
    : selectedTemplateIds.length === 1
    ? selectedTemplateIds[0]
    : "";
  const isMultiTemplate = !isEditing && selectedTemplateIds.length > 1;
  const previewTemplate = templates.find((t) => t.id === previewTemplateId) ?? null;
  const effectiveTemplate = previewTemplate ? applyOrientation(previewTemplate, rotated) : null;
  const showOrientationToggle = Boolean(previewTemplate) && !isMultiTemplate;
  // "Paysage" = plus large que haut. Le bouton actif reflète l'orientation
  // effective (après inversion éventuelle par `rotated`), pas le modèle brut.
  const effectiveIsLandscape = effectiveTemplate
    ? isLandscape(effectiveTemplate.width_mm, effectiveTemplate.height_mm)
    : true;
  // Réinitialisée quand le modèle change (voir useEffect ci-dessous) plutôt
  // qu'à chaque rendu, pour ne pas écraser le choix de l'utilisateur.
  const previousPreviewTemplateIdRef = useRef(previewTemplateId);
  useEffect(() => {
    if (previousPreviewTemplateIdRef.current !== previewTemplateId) {
      previousPreviewTemplateIdRef.current = previewTemplateId;
      setRotated(false);
    }
  }, [previewTemplateId]);
  const showBackSection = !isMultiTemplate && Boolean(previewTemplate?.two_sided);
  const someSelectedAreTwoSided =
    !isEditing && selectedTemplateIds.some((id) => templates.find((t) => t.id === id)?.two_sided);
  // Sans modèle unique connu (aucun choisi, ou plusieurs sélectionnés), on
  // ne peut pas savoir si le logo s'applique — on affiche l'option par
  // défaut, le serveur respecte de toute façon les réglages du modèle réel
  // à la génération.
  const frontLogoEnabled = previewTemplate ? previewTemplate.logo_on_front : true;
  const backLogoEnabled = previewTemplate ? previewTemplate.two_sided && previewTemplate.logo_on_back : false;
  const showLogoSection = !previewTemplate || frontLogoEnabled || backLogoEnabled;
  const logoLabel = !previewTemplate
    ? "Logo"
    : frontLogoEnabled && backLogoEnabled
    ? "Logo (recto et verso)"
    : backLogoEnabled
    ? "Logo (verso uniquement)"
    : "Logo (recto uniquement)";

  function updateFront(patch: Partial<ImageSourceValue>) {
    setFront((f) => ({ ...f, ...patch }));
  }

  function updateBack(patch: Partial<ImageSourceValue>) {
    setBack((b) => ({ ...b, ...patch }));
  }

  // Construit le nom automatiquement tant que l'utilisateur n'a pas modifié
  // le champ à la main. Avec un seul modèle : Modèle — Visuel. Avec
  // plusieurs modèles sélectionnés, le nom saisi sert de base commune et le
  // nom du modèle est ajouté à chaque produit créé (voir handleSubmit).
  useEffect(() => {
    if (nameTouched) return;
    const visualName =
      front.sourceMode !== "upload" ? visuals.find((v) => v.id === front.visualId)?.name ?? "" : "";
    if (isMultiTemplate) {
      setName(visualName);
      return;
    }
    const templateName = templates.find((t) => t.id === previewTemplateId)?.name ?? "";
    setName(visualName ? `${templateName} — ${visualName}` : templateName);
  }, [previewTemplateId, isMultiTemplate, front.sourceMode, front.visualId, templates, visuals, nameTouched]);

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
    formData.append("positionX", String(front.positionX));
    formData.append("positionY", String(front.positionY));
    if (cId) formData.append("collectionId", cId);
    formData.append("rotated", String(rotated));
    if (front.sourceMode === "upload") {
      if (front.file) formData.append("image", front.file);
    } else {
      formData.append("visualId", front.visualId);
      formData.append("visualMode", front.sourceMode);
      if (front.sourceMode === "tile") formData.append("tileSizeMm", String(front.tileSizeMm));
    }
    // Le serveur ignore ces champs si le modèle n'est pas recto-verso.
    formData.append("backPositionX", String(back.positionX));
    formData.append("backPositionY", String(back.positionY));
    if (back.sourceMode === "upload") {
      if (back.file) formData.append("backImage", back.file);
    } else {
      formData.append("backVisualId", back.visualId);
      formData.append("backVisualMode", back.sourceMode);
      if (back.sourceMode === "tile") formData.append("backTileSizeMm", String(back.tileSizeMm));
    }
    return formData;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!isEditing && selectedTemplateIds.length === 0) {
      setError("Choisis au moins un modèle.");
      return;
    }
    if (!isEditing && front.sourceMode === "upload" && !front.file) {
      setError("Une image est requise.");
      return;
    }
    if (front.sourceMode !== "upload" && !front.visualId) {
      setError("Choisis un visuel dans la banque.");
      return;
    }
    if (showBackSection) {
      const hasExistingBack = isEditing && Boolean(currentBackImageUrl);
      if (back.sourceMode === "upload" && !back.file && !hasExistingBack) {
        setError("Une image de verso est requise (modèle recto-verso).");
        return;
      }
      if (back.sourceMode !== "upload" && !back.visualId) {
        setError("Choisis un visuel pour le verso.");
        return;
      }
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
    // automatiquement dans une collection si aucune n'a été choisie. Le
    // verso (le cas échéant) n'est pas configuré en lot — à ajouter ensuite
    // en modifiant chaque produit individuellement.
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
                      {t.two_sided ? " (recto-verso)" : ""}
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
                        {t.two_sided ? " (recto-verso)" : ""}
                      </label>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
          {someSelectedAreTwoSided && (
            <p className="mt-1 text-xs text-neutral-500">
              Certains modèles sélectionnés sont recto-verso — configure le verso après création,
              en modifiant chaque produit.
            </p>
          )}
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

      {showOrientationToggle && (
        <div>
          <label className="mb-2 block text-sm font-medium">Orientation</label>
          <div className="flex rounded-lg border border-neutral-300 p-0.5 text-sm">
            <button
              type="button"
              onClick={() => setRotated(previewTemplate ? isLandscape(previewTemplate.width_mm, previewTemplate.height_mm) : false)}
              className={`flex-1 rounded-md px-2 py-1.5 ${
                !effectiveIsLandscape ? "bg-pico-black text-white" : "text-neutral-600 hover:bg-neutral-100"
              }`}
            >
              Portrait
            </button>
            <button
              type="button"
              onClick={() => setRotated(previewTemplate ? !isLandscape(previewTemplate.width_mm, previewTemplate.height_mm) : false)}
              className={`flex-1 rounded-md px-2 py-1.5 ${
                effectiveIsLandscape ? "bg-pico-black text-white" : "text-neutral-600 hover:bg-neutral-100"
              }`}
            >
              Paysage
            </button>
          </div>
        </div>
      )}

      <div>
        <p className="mb-1 text-sm font-medium">Recto</p>
        <ImageSourcePicker
          side="front"
          template={effectiveTemplate}
          rotated={rotated}
          visuals={visuals}
          value={front}
          onChange={updateFront}
          currentImageUrl={currentImageUrl}
          logo={frontLogoEnabled ? { shape: logoShape, color: logoColor, secondaryColor: logoSecondaryColor } : null}
          previewUnavailableMessage={
            isMultiTemplate
              ? "Aperçu disponible pour un seul modèle à la fois — décoche pour n'en garder qu'un si tu veux vérifier le rendu avant de créer la collection."
              : undefined
          }
        />
      </div>

      {showLogoSection && (
        <div>
          <label className="mb-1 block text-sm font-medium">{logoLabel}</label>
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
          <div className="flex flex-wrap items-center gap-2">
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
            <input
              type="color"
              value={logoColor}
              onChange={(e) => setLogoColor(e.target.value)}
              title="Couleur personnalisée"
              aria-label="Couleur personnalisée"
              className="h-7 w-7 cursor-pointer rounded-full border border-neutral-300 bg-transparent p-0.5"
            />
          </div>

          {logoShape === "pastille" && (
            <>
              <p className="mb-1 mt-3 text-xs text-neutral-500">Couleur du logo à l&apos;intérieur</p>
              <div className="flex flex-wrap items-center gap-2">
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
                <input
                  type="color"
                  value={logoSecondaryColor}
                  onChange={(e) => setLogoSecondaryColor(e.target.value)}
                  title="Couleur personnalisée"
                  aria-label="Couleur personnalisée"
                  className="h-7 w-7 cursor-pointer rounded-full border border-neutral-300 bg-transparent p-0.5"
                />
              </div>
            </>
          )}
        </div>
      )}

      {showBackSection && (
        <div className="border-t border-neutral-200 pt-4">
          <p className="mb-1 text-sm font-medium">
            Verso <span className="font-normal text-neutral-400">(modèle recto-verso)</span>
          </p>
          <ImageSourcePicker
            side="back"
            template={effectiveTemplate}
            rotated={rotated}
            visuals={visuals}
            value={back}
            onChange={updateBack}
            currentImageUrl={currentBackImageUrl}
            logo={backLogoEnabled ? { shape: logoShape, color: logoColor, secondaryColor: logoSecondaryColor } : null}
          />
        </div>
      )}

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
