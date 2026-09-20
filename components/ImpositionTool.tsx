"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Modal from "@/components/Modal";
import MeasureField, { UnitToggle, type Unit } from "@/components/MeasureField";
import { CuttersManager, SheetsManager } from "@/components/ImpositionPresets";
import CutterSettingsFields, { cutterSettingsOf, type CutterSettings } from "@/components/CutterSettingsFields";
import { DownloadIcon, SpinnerIcon, TrashIcon } from "@/components/icons";
import UpdatingBadge from "@/components/UpdatingBadge";
import {
  assignCells,
  computeLayout,
  type FlipEdge,
  type PieceOrientation,
} from "@/lib/imposition/layout";
import { formatInches, sheetLabel } from "@/lib/imposition/presets";
import { MM_TO_PT, formatIn } from "@/lib/pdf/units";
import type { ImpositionCutter, ImpositionSheet } from "@/lib/types";

// Taille de page (fond perdu inclus) d'un format du catalogue.
export interface FormatOption {
  id: string;
  name: string;
  category: string;
  // Fond perdu par côté : la ligne de coupe est à cette distance du bord de la page.
  bleedMm: number;
  widthMm: number;
  heightMm: number;
}

export interface ProductOption {
  id: string;
  name: string;
  templateId: string;
  widthMm: number;
  heightMm: number;
}

interface SourceItem {
  key: string;
  kind: "product" | "upload";
  name: string;
  productId?: string;
  file?: File;
  // Taille de la page du PDF (mm), null tant qu'elle n'est pas lue.
  widthMm: number | null;
  heightMm: number | null;
  copies: number;
}

const CUSTOM = "custom";
// Pas d'orange ici : il est réservé aux lignes de coupe de l'aperçu.
const COLORS = ["#7c9cc4", "#3f8f5b", "#a06cd5", "#2a9d8f", "#d6609a", "#7d7364"];
const CUT_COLOR = "#ff6a00";
// Fond perdu standard (1/8 po) proposé pour un format personnalisé.
const DEFAULT_BLEED_MM = 3.175;

function sizeLabel(w: number, h: number): string {
  return `${formatIn(w)} × ${formatIn(h)}`;
}

function matchesPiece(item: SourceItem, pieceW: number, pieceH: number): boolean {
  if (item.widthMm === null || item.heightMm === null) return true; // pas encore lue
  const close = (a: number, b: number) => Math.abs(a - b) <= 0.1;
  return (
    (close(item.widthMm, pieceW) && close(item.heightMm, pieceH)) ||
    (close(item.widthMm, pieceH) && close(item.heightMm, pieceW))
  );
}

// Lit la taille de la 1re page d'un PDF téléversé (pdf-lib chargé à la demande :
// il ne sert que sur cette page).
async function readPdfPageSizeMm(file: File): Promise<{ widthMm: number; heightMm: number } | null> {
  try {
    const { PDFDocument } = await import("pdf-lib");
    const doc = await PDFDocument.load(await file.arrayBuffer());
    const { width, height } = doc.getPage(0).getSize();
    return { widthMm: width / MM_TO_PT, heightMm: height / MM_TO_PT };
  } catch {
    return null;
  }
}

type ModalState = { mode: "sheets" } | { mode: "cutters" } | { mode: "result"; url: string } | null;

export default function ImpositionTool({
  sheets,
  cutters,
  formats,
  products,
}: {
  sheets: ImpositionSheet[];
  cutters: ImpositionCutter[];
  formats: FormatOption[];
  products: ProductOption[];
}) {
  const router = useRouter();
  const [isRefreshing, startTransition] = useTransition();

  const [formatId, setFormatId] = useState<string>(formats[0]?.id ?? CUSTOM);
  const [customUnit, setCustomUnit] = useState<Unit>("in");
  const [customWidth, setCustomWidth] = useState(95.25);
  const [customHeight, setCustomHeight] = useState(57.15);
  const [customBleed, setCustomBleed] = useState(DEFAULT_BLEED_MM);
  const [showCuts, setShowCuts] = useState(true);
  // Réglages de la découpeuse ajustés à l'écran, pas encore enregistrés. Liés à
  // un profil précis : changer de profil repart des réglages enregistrés.
  const [draft, setDraft] = useState<{ cutterId: string; settings: CutterSettings } | null>(null);
  const [resetNonce, setResetNonce] = useState(0);
  const [savingCutter, setSavingCutter] = useState(false);
  const [cutterSaveError, setCutterSaveError] = useState<string | null>(null);
  const [sheetId, setSheetId] = useState(sheets[0]?.id ?? "");
  const [cutterId, setCutterId] = useState(cutters[0]?.id ?? "");
  const [orientation, setOrientation] = useState<PieceOrientation>("auto");
  const [flip, setFlip] = useState<FlipEdge>("long");
  const [items, setItems] = useState<SourceItem[]>([]);
  const [productToAdd, setProductToAdd] = useState("");
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [modal, setModal] = useState<ModalState>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const nextKey = useRef(0);

  // Si le préréglage sélectionné a été supprimé (ou le premier vient d'être
  // créé), retombe sur un choix valide.
  useEffect(() => {
    if (!sheets.some((s) => s.id === sheetId)) setSheetId(sheets[0]?.id ?? "");
  }, [sheets, sheetId]);
  useEffect(() => {
    if (!cutters.some((c) => c.id === cutterId)) setCutterId(cutters[0]?.id ?? "");
  }, [cutters, cutterId]);

  // Libère le PDF généré quand la modale de résultat se ferme.
  useEffect(() => {
    if (modal?.mode !== "result") return;
    const { url } = modal;
    return () => URL.revokeObjectURL(url);
  }, [modal]);

  const sheet = sheets.find((s) => s.id === sheetId) ?? null;
  const cutter = cutters.find((c) => c.id === cutterId) ?? null;
  const savedSettings = cutter ? cutterSettingsOf(cutter) : null;
  const savedKey = JSON.stringify(savedSettings);
  const settings = draft && draft.cutterId === cutterId ? draft.settings : savedSettings;
  const cutterDirty = JSON.stringify(settings) !== savedKey;
  // Le brouillon est abandonné quand le profil enregistré change (enregistrement,
  // ou édition via « Gérer ») : les réglages affichés repartent de la base.
  useEffect(() => {
    setDraft(null);
  }, [savedKey]);
  const format = formats.find((f) => f.id === formatId) ?? null;
  const piece =
    formatId === CUSTOM || !format
      ? { widthMm: customWidth, heightMm: customHeight, bleedMm: customBleed }
      : { widthMm: format.widthMm, heightMm: format.heightMm, bleedMm: format.bleedMm };

  const layout = useMemo(() => {
    if (!sheet || !settings || !(piece.widthMm > 0) || !(piece.heightMm > 0)) return null;
    return computeLayout({
      sheetWidth: sheet.width_mm,
      sheetHeight: sheet.height_mm,
      margins: {
        top: settings.margin_top_mm,
        right: settings.margin_right_mm,
        bottom: settings.margin_bottom_mm,
        left: settings.margin_left_mm,
      },
      gutterX: settings.gutter_x_mm,
      gutterY: settings.gutter_y_mm,
      offsetX: settings.offset_x_mm,
      offsetY: settings.offset_y_mm,
      centerGrid: settings.center_grid,
      pieceWidth: piece.widthMm,
      pieceHeight: piece.heightMm,
      orientation,
    });
  }, [sheet, savedKey, draft, cutterId, piece.widthMm, piece.heightMm, orientation]);

  const cellCount = layout?.cells.length ?? 0;
  const { assignment, overflow } = useMemo(
    () => assignCells(items, cellCount),
    [items, cellCount]
  );
  const totalCopies = items.reduce((sum, i) => sum + i.copies, 0);

  // Les formats arrivent déjà triés par catégorie : on les regroupe en gardant l'ordre.
  const formatGroups = formats.reduce<{ category: string; formats: FormatOption[] }[]>((groups, f) => {
    const last = groups[groups.length - 1];
    if (last && last.category === f.category) last.formats.push(f);
    else groups.push({ category: f.category, formats: [f] });
    return groups;
  }, []);

  const availableProducts = products.filter((p) => formatId === CUSTOM || p.templateId === formatId);

  async function handleSaveCutter() {
    if (!cutter || !settings) return;
    setSavingCutter(true);
    setCutterSaveError(null);
    const body = new FormData();
    body.append("name", cutter.name);
    for (const [key, value] of Object.entries(settings)) body.append(key, String(value));
    // Sans champ « marks », la route conserve le fichier de marques existant.
    const res = await fetch(`/api/imposition/cutters/${cutter.id}`, { method: "PATCH", body });
    setSavingCutter(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setCutterSaveError(data.error ?? "Erreur lors de l'enregistrement.");
      return;
    }
    refreshPresets();
  }

  function refreshPresets() {
    startTransition(() => router.refresh());
  }

  function addItem(partial: Omit<SourceItem, "key" | "copies">) {
    setItems((current) => {
      const used = current.reduce((sum, i) => sum + i.copies, 0);
      return [
        ...current,
        { ...partial, key: `item-${nextKey.current++}`, copies: Math.max(1, cellCount - used) },
      ];
    });
  }

  function handleAddProduct() {
    const product = products.find((p) => p.id === productToAdd);
    if (!product) return;
    addItem({
      kind: "product",
      name: product.name,
      productId: product.id,
      widthMm: product.widthMm,
      heightMm: product.heightMm,
    });
    setProductToAdd("");
  }

  async function handleFiles(files: FileList | null) {
    if (!files) return;
    for (const file of Array.from(files)) {
      const size = await readPdfPageSizeMm(file);
      addItem({
        kind: "upload",
        name: file.name,
        file,
        widthMm: size?.widthMm ?? null,
        heightMm: size?.heightMm ?? null,
      });
    }
    if (fileInput.current) fileInput.current.value = "";
  }

  function updateItem(key: string, patch: Partial<SourceItem>) {
    setItems((current) => current.map((i) => (i.key === key ? { ...i, ...patch } : i)));
  }

  function fillItem(key: string) {
    setItems((current) => {
      const others = current.filter((i) => i.key !== key).reduce((sum, i) => sum + i.copies, 0);
      return current.map((i) => (i.key === key ? { ...i, copies: Math.max(1, cellCount - others) } : i));
    });
  }

  const mismatched = items.filter((i) => !matchesPiece(i, piece.widthMm, piece.heightMm));
  const problem = !sheet
    ? "Créez une feuille pour commencer."
    : !cutter
      ? "Créez un profil de découpeuse pour commencer."
      : !layout || cellCount === 0
        ? "Ce format ne rentre pas dans la zone utile de la feuille."
        : items.length === 0
          ? "Ajoutez au moins un fichier."
          : overflow > 0
            ? `Trop de copies : ${overflow} de plus que les ${cellCount} emplacements.`
            : mismatched.length > 0
              ? `La taille de « ${mismatched[0].name} » ne correspond pas au format.`
              : null;

  async function handleGenerate() {
    if (!sheet || !cutter || problem) return;
    setGenerating(true);
    setError(null);

    const body = new FormData();
    body.append("sheetId", sheet.id);
    body.append("cutterId", cutter.id);
    body.append("pieceWidthMm", String(piece.widthMm));
    body.append("pieceHeightMm", String(piece.heightMm));
    body.append("orientation", orientation);
    body.append("flip", flip);
    if (settings) body.append("cutterSettings", JSON.stringify(settings));
    const specs = items.map((item, index) => {
      if (item.kind === "upload" && item.file) {
        body.append(`file${index}`, item.file);
        return { kind: "upload", field: `file${index}`, copies: item.copies };
      }
      return { kind: "product", productId: item.productId, copies: item.copies };
    });
    body.append("sources", JSON.stringify(specs));

    try {
      const res = await fetch("/api/imposition/generate", { method: "POST", body });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "Erreur lors de la génération.");
        return;
      }
      const blob = await res.blob();
      setModal({ mode: "result", url: URL.createObjectURL(blob) });
    } catch {
      setError("Impossible de joindre le serveur.");
    } finally {
      setGenerating(false);
    }
  }

  const selectClass = "mt-1 w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm";
  const labelClass = "block text-xs font-medium text-neutral-500";

  return (
    <div>
      <div className="mb-6">
        <h1 className="flex items-center gap-2 text-xl font-semibold text-pico-black">
          Imposition
          <UpdatingBadge show={isRefreshing} />
        </h1>
        <p className="text-sm text-neutral-500">
          Placez des PDF d&apos;impression sur une feuille selon le format et les réglages de la découpeuse.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,26rem)_1fr]">
        <div className="space-y-5">
          <section className="space-y-4 rounded-xl border border-neutral-200 bg-white p-4 shadow-sm">
            <div>
              <label className={labelClass}>Format (fond perdu inclus)</label>
              <select value={formatId} onChange={(e) => setFormatId(e.target.value)} className={selectClass}>
                {formatGroups.map((group) => (
                  <optgroup key={group.category} label={group.category}>
                    {group.formats.map((f) => (
                      <option key={f.id} value={f.id}>
                        {f.name} · {sizeLabel(f.widthMm, f.heightMm)}
                      </option>
                    ))}
                  </optgroup>
                ))}
                <option value={CUSTOM}>Personnalisé…</option>
              </select>
              {formatId === CUSTOM && (
                <div className="mt-3 space-y-2">
                  <div className="flex justify-end">
                    <UnitToggle unit={customUnit} onChange={setCustomUnit} />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <MeasureField
                      key={`cw-${customUnit}`}
                      label="Largeur"
                      valueMm={customWidth}
                      unit={customUnit}
                      onChange={setCustomWidth}
                    />
                    <MeasureField
                      key={`ch-${customUnit}`}
                      label="Hauteur"
                      valueMm={customHeight}
                      unit={customUnit}
                      onChange={setCustomHeight}
                    />
                    <MeasureField
                      key={`cb-${customUnit}`}
                      label="Fond perdu (par côté)"
                      valueMm={customBleed}
                      unit={customUnit}
                      onChange={setCustomBleed}
                    />
                  </div>
                </div>
              )}
            </div>

            <div>
              <div className="flex items-center justify-between">
                <label className={labelClass}>Feuille</label>
                <button
                  type="button"
                  onClick={() => setModal({ mode: "sheets" })}
                  className="text-xs text-neutral-500 underline hover:text-pico-black"
                >
                  Gérer
                </button>
              </div>
              <select value={sheetId} onChange={(e) => setSheetId(e.target.value)} className={selectClass}>
                {sheets.length === 0 && <option value="">— Aucune feuille —</option>}
                {sheets.map((s) => (
                  <option key={s.id} value={s.id}>
                    {sheetLabel(s.width_mm, s.height_mm)}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <div className="flex items-center justify-between">
                <label className={labelClass}>Découpeuse</label>
                <button
                  type="button"
                  onClick={() => setModal({ mode: "cutters" })}
                  className="text-xs text-neutral-500 underline hover:text-pico-black"
                >
                  Gérer
                </button>
              </div>
              <select value={cutterId} onChange={(e) => setCutterId(e.target.value)} className={selectClass}>
                {cutters.length === 0 && <option value="">— Aucun profil —</option>}
                {cutters.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
              {cutter && settings && (
                <details className="mt-2 rounded-lg border border-neutral-200 px-3 py-2">
                  <summary className="cursor-pointer text-xs font-medium text-neutral-600">
                    Ajuster les réglages
                    {cutterDirty && <span className="ml-2 font-normal text-orange-600">· modifié, non enregistré</span>}
                  </summary>
                  <div className="mt-3 space-y-4">
                    <CutterSettingsFields
                      key={`${cutter.id}-${resetNonce}-${savedKey}`}
                      value={settings}
                      onChange={(next) => setDraft({ cutterId: cutter.id, settings: next })}
                    />
                    <p className="text-xs text-neutral-500">
                      Les ajustements s&apos;appliquent tout de suite à l&apos;aperçu et au PDF généré.
                      « Enregistrer » les garde dans le profil.
                    </p>
                    {cutterSaveError && <p className="text-sm text-red-600">{cutterSaveError}</p>}
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={handleSaveCutter}
                        disabled={!cutterDirty || savingCutter}
                        className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-pico-maroon px-3 py-2 text-sm font-medium text-white hover:bg-pico-maroon-dark disabled:opacity-40"
                      >
                        {savingCutter && <SpinnerIcon className="h-4 w-4" />}
                        Enregistrer dans « {cutter.name} »
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setDraft(null);
                          setResetNonce((n) => n + 1);
                        }}
                        disabled={!cutterDirty || savingCutter}
                        className="rounded-lg border border-neutral-300 px-3 py-2 text-sm text-neutral-600 hover:bg-neutral-50 disabled:opacity-40"
                      >
                        Rétablir
                      </button>
                    </div>
                  </div>
                </details>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelClass}>Sens des pièces</label>
                <select
                  value={orientation}
                  onChange={(e) => setOrientation(e.target.value as PieceOrientation)}
                  className={selectClass}
                >
                  <option value="auto">Auto (le plus de pièces)</option>
                  <option value="normal">Normal</option>
                  <option value="rotated">Pivoté de 90°</option>
                </select>
              </div>
              <div>
                <label className={labelClass}>Retournement du verso</label>
                <select value={flip} onChange={(e) => setFlip(e.target.value as FlipEdge)} className={selectClass}>
                  <option value="long">Sur le bord long</option>
                  <option value="short">Sur le bord court</option>
                </select>
              </div>
            </div>
          </section>

          <section className="space-y-3 rounded-xl border border-neutral-200 bg-white p-4 shadow-sm">
            <h2 className="text-sm font-semibold text-pico-black">Fichiers à imposer</h2>

            {items.length === 0 && <p className="text-sm text-neutral-500">Aucun fichier pour l&apos;instant.</p>}
            <ul className="space-y-2">
              {items.map((item, index) => {
                const ok = matchesPiece(item, piece.widthMm, piece.heightMm);
                return (
                  <li key={item.key} className="rounded-lg border border-neutral-200 p-2.5">
                    <div className="flex items-start gap-2">
                      {items.length > 1 && (
                        <span
                          className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded text-[11px] font-semibold text-white"
                          style={{ backgroundColor: COLORS[index % COLORS.length] }}
                        >
                          {index + 1}
                        </span>
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">{item.name}</p>
                        <p className={`text-xs ${ok ? "text-neutral-500" : "text-red-600"}`}>
                          {item.kind === "product" ? "Produit" : "PDF téléversé"}
                          {item.widthMm !== null && item.heightMm !== null
                            ? ` · ${sizeLabel(item.widthMm, item.heightMm)}`
                            : ""}
                          {!ok && " — taille différente du format"}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setItems((c) => c.filter((i) => i.key !== item.key))}
                        aria-label="Retirer"
                        className="rounded-lg p-1 text-neutral-400 hover:bg-red-50 hover:text-red-600"
                      >
                        <TrashIcon className="h-4 w-4" />
                      </button>
                    </div>
                    <div className="mt-2 flex items-center gap-2">
                      <label className="text-xs text-neutral-500">Copies sur la feuille</label>
                      <input
                        type="number"
                        min={1}
                        step={1}
                        value={item.copies}
                        onChange={(e) =>
                          updateItem(item.key, { copies: Math.max(1, Math.floor(Number(e.target.value)) || 1) })
                        }
                        className="w-20 rounded border border-neutral-300 px-2 py-1 text-sm"
                      />
                      <button
                        type="button"
                        onClick={() => fillItem(item.key)}
                        className="text-xs text-neutral-500 underline hover:text-pico-black"
                      >
                        Remplir
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>

            <div className="space-y-2 border-t border-neutral-100 pt-3">
              <div className="flex gap-2">
                <select
                  value={productToAdd}
                  onChange={(e) => setProductToAdd(e.target.value)}
                  className="min-w-0 flex-1 rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm"
                >
                  <option value="">
                    {availableProducts.length === 0 ? "Aucun produit avec PDF pour ce format" : "Ajouter un produit…"}
                  </option>
                  {availableProducts.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={handleAddProduct}
                  disabled={!productToAdd}
                  className="rounded-lg border border-neutral-300 px-3 py-2 text-sm text-neutral-700 hover:bg-neutral-50 disabled:opacity-40"
                >
                  Ajouter
                </button>
              </div>
              <input
                ref={fileInput}
                type="file"
                accept="application/pdf"
                multiple
                onChange={(e) => handleFiles(e.target.files)}
                className="block w-full text-sm"
              />
            </div>
          </section>
        </div>

        <section className="space-y-4">
          <div className="rounded-xl border border-neutral-200 bg-white p-4 shadow-sm">
            <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="text-sm font-semibold text-pico-black">Aperçu de la feuille</h2>
              <label className="flex items-center gap-1.5 text-xs text-neutral-600">
                <input type="checkbox" checked={showCuts} onChange={(e) => setShowCuts(e.target.checked)} />
                <span className="inline-block h-0.5 w-4" style={{ backgroundColor: CUT_COLOR }} />
                Coupes de la découpeuse
              </label>
              {layout && cellCount > 0 && (
                <p className="text-sm text-neutral-600">
                  <strong>{cellCount}</strong> pièces par feuille ({layout.cols} × {layout.rows}
                  {layout.rotated ? ", pivotées" : ""}) · {Math.min(totalCopies, cellCount)} placée
                  {Math.min(totalCopies, cellCount) > 1 ? "s" : ""}
                </p>
              )}
            </div>
            {sheet && layout ? (
              <SheetPreview
                sheet={sheet}
                layout={layout}
                assignment={assignment}
                multiColor={items.length > 1}
                hasMarks={Boolean(cutter?.marks_path)}
                bleedMm={showCuts ? piece.bleedMm : null}
              />
            ) : (
              <p className="text-sm text-neutral-500">Choisissez une feuille et une découpeuse.</p>
            )}
            <p className="mt-3 text-xs text-neutral-500">
              L&apos;aperçu montre la grille ; les marques de la découpeuse et le verso apparaissent dans le PDF
              généré. Pointillés gris = zone utile (feuille moins marges). Traits orange = coupes de la
              découpeuse, de bord à bord de la feuille, au bord de chaque pièce finie (à l&apos;intérieur du fond
              perdu) : visibles ici seulement, jamais dans le PDF.
            </p>
          </div>

          <div className="flex flex-col items-stretch gap-2">
            {(error || problem) && (
              <p className={`text-sm ${error ? "text-red-600" : "text-neutral-500"}`}>{error ?? problem}</p>
            )}
            <button
              type="button"
              onClick={handleGenerate}
              disabled={generating || Boolean(problem)}
              className="flex items-center justify-center gap-2 rounded-lg bg-pico-maroon px-4 py-2.5 text-sm font-medium text-white hover:bg-pico-maroon-dark disabled:opacity-50"
            >
              {generating && <SpinnerIcon className="h-4 w-4" />}
              {generating ? "Génération en cours..." : "Générer le PDF imposé"}
            </button>
          </div>
        </section>
      </div>

      {modal?.mode === "sheets" && (
        <Modal title="Gérer les feuilles" onClose={() => setModal(null)}>
          <SheetsManager sheets={sheets} onChanged={refreshPresets} />
        </Modal>
      )}
      {modal?.mode === "cutters" && (
        <Modal title="Gérer les profils de découpeuse" onClose={() => setModal(null)} wide>
          <CuttersManager cutters={cutters} onChanged={refreshPresets} />
        </Modal>
      )}
      {modal?.mode === "result" && (
        <Modal title="PDF imposé" onClose={() => setModal(null)} wide>
          <iframe src={modal.url} title="PDF imposé" className="h-[65vh] w-full rounded border border-neutral-200" />
          <a
            href={modal.url}
            download={`imposition-${sheet ? `${formatInches(sheet.width_mm)}x${formatInches(sheet.height_mm)}` : "feuille"}.pdf`}
            className="mt-4 flex items-center justify-center gap-2 rounded-lg bg-pico-maroon px-4 py-2 text-sm font-medium text-white hover:bg-pico-maroon-dark"
          >
            <DownloadIcon className="h-4 w-4" />
            Télécharger le PDF
          </a>
        </Modal>
      )}
    </div>
  );
}

// Positions distinctes triées (les erreurs d'arrondi flottant sont absorbées).
function uniquePositions(values: number[]): number[] {
  return [...new Set(values.map((v) => Math.round(v * 1000) / 1000))].sort((a, b) => a - b);
}

function SheetPreview({
  sheet,
  layout,
  assignment,
  multiColor,
  hasMarks,
  bleedMm,
}: {
  sheet: ImpositionSheet;
  layout: NonNullable<ReturnType<typeof computeLayout>>;
  assignment: (number | null)[];
  multiColor: boolean;
  hasMarks: boolean;
  // Fond perdu par côté ; null = lignes de coupe masquées.
  bleedMm: number | null;
}) {
  const { usable } = layout;
  // Jamais plus que la moitié de la plus petite dimension, pour ne pas inverser le rectangle.
  const bleed =
    bleedMm === null ? null : Math.max(0, Math.min(bleedMm, Math.min(layout.cellWidth, layout.cellHeight) / 2));
  const stroke = sheet.width_mm / 500;
  const fontSize = Math.min(layout.cellWidth, layout.cellHeight) * 0.4;
  // La machine coupe de bord à bord : une coupe par bord de pièce finie (à
  // `bleed` du bord de la cellule), sur toute la hauteur ou toute la largeur
  // de la feuille. Deux cartes qui se touchent donnent donc deux traits
  // rapprochés (la bande de fond perdu entre elles est du rebut).
  const cutXs = bleed === null ? [] : uniquePositions(layout.cells.flatMap((c) => [c.x + bleed, c.x + c.width - bleed]));
  const cutYs = bleed === null ? [] : uniquePositions(layout.cells.flatMap((c) => [c.y + bleed, c.y + c.height - bleed]));
  return (
    <svg
      viewBox={`0 0 ${sheet.width_mm} ${sheet.height_mm}`}
      className="mx-auto max-h-[70vh] w-auto max-w-full rounded border border-neutral-300 bg-white shadow-sm"
      style={{ aspectRatio: `${sheet.width_mm} / ${sheet.height_mm}` }}
      role="img"
      aria-label="Aperçu de l'imposition"
    >
      <rect
        x={usable.x}
        y={usable.y}
        width={Math.max(usable.width, 0)}
        height={Math.max(usable.height, 0)}
        fill="none"
        stroke="#a99e8e"
        strokeWidth={stroke}
        strokeDasharray={`${stroke * 4} ${stroke * 3}`}
      />
      {layout.cells.map((cell, i) => {
        const source = assignment[i];
        const color = source === null ? null : multiColor ? COLORS[source % COLORS.length] : COLORS[0];
        return (
          <g key={`${cell.row}-${cell.col}`}>
            <rect
              x={cell.x}
              y={cell.y}
              width={cell.width}
              height={cell.height}
              fill={color ?? "none"}
              fillOpacity={0.35}
              stroke={color ?? "#a99e8e"}
              strokeWidth={stroke}
              strokeDasharray={color ? undefined : `${stroke * 3} ${stroke * 3}`}
            />
            {multiColor && source !== null && (
              <text
                x={cell.x + cell.width / 2}
                y={cell.y + cell.height / 2}
                fontSize={fontSize}
                textAnchor="middle"
                dominantBaseline="central"
                fill="#1a1613"
                fillOpacity={0.6}
              >
                {source + 1}
              </text>
            )}
          </g>
        );
      })}
      {cutXs.map((x) => (
        <line key={`cx-${x}`} x1={x} y1={0} x2={x} y2={sheet.height_mm} stroke={CUT_COLOR} strokeWidth={stroke * 1.2} />
      ))}
      {cutYs.map((y) => (
        <line key={`cy-${y}`} x1={0} y1={y} x2={sheet.width_mm} y2={y} stroke={CUT_COLOR} strokeWidth={stroke * 1.2} />
      ))}
      {hasMarks && (
        <text x={sheet.width_mm / 2} y={sheet.height_mm - 2} fontSize={sheet.width_mm / 45} textAnchor="middle" fill="#7d7364">
          + marques de la découpeuse
        </text>
      )}
    </svg>
  );
}
