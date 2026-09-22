"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Modal from "@/components/Modal";
import MeasureField, { UnitToggle, type Unit } from "@/components/MeasureField";
import { SheetsManager } from "@/components/ImpositionPresets";
import DuploJobsManager from "@/components/DuploJobsManager";
import { DownloadIcon, SpinnerIcon, TrashIcon } from "@/components/icons";
import UpdatingBadge from "@/components/UpdatingBadge";
import {
  assignCells,
  cutLines,
  flipAxisIsVertical,
  type FlipEdge,
  type Layout,
  type PieceOrientation,
} from "@/lib/imposition/layout";
import { DUPLO_MARKS, computeDuploLayout } from "@/lib/imposition/duplo";
import { regMarkRects, type MmRect } from "@/lib/imposition/regmark";
import { formatInches, sheetLabel } from "@/lib/imposition/presets";
import { MM_TO_PT, formatIn } from "@/lib/pdf/units";
import { MACHINES, MACHINE_LABELS, type CutterMachine } from "@/lib/imposition/machines";
import type { SavedImposition } from "@/lib/imposition/saved";
import type { ImpositionDuploJob, ImpositionSheet } from "@/lib/types";

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
  // PDF téléversé déjà enregistré avec l'imposition qu'on modifie.
  storedPath?: string;
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

type ModalState =
  | { mode: "sheets" }
  | { mode: "duplo-jobs" }
  | { mode: "result"; url: string }
  | null;

export default function ImpositionTool({
  sheets,
  duploJobs,
  barcodeJobNos,
  formats,
  products,
  saved = null,
}: {
  sheets: ImpositionSheet[];
  duploJobs: ImpositionDuploJob[];
  // Numéros de job dont le code-barres (PDF) est importé.
  barcodeJobNos: number[];
  formats: FormatOption[];
  products: ProductOption[];
  // Imposition enregistrée qu'on modifie (null = nouvelle imposition).
  saved?: SavedImposition | null;
}) {
  const router = useRouter();
  const [isRefreshing, startTransition] = useTransition();

  const cfg = saved?.config ?? null;
  const [name, setName] = useState(saved?.name ?? "");
  const [formatId, setFormatId] = useState<string>(
    cfg && (cfg.formatId === CUSTOM || formats.some((f) => f.id === cfg.formatId))
      ? cfg.formatId
      : (formats[0]?.id ?? CUSTOM)
  );
  const [customUnit, setCustomUnit] = useState<Unit>("in");
  const [customWidth, setCustomWidth] = useState(cfg?.custom.widthMm || 95.25);
  const [customHeight, setCustomHeight] = useState(cfg?.custom.heightMm || 57.15);
  const [customBleed, setCustomBleed] = useState(cfg?.custom.bleedMm || DEFAULT_BLEED_MM);
  const [showCuts, setShowCuts] = useState(true);
  const [sheetId, setSheetId] = useState(
    cfg && sheets.some((sh) => sh.id === cfg.sheetId) ? cfg.sheetId : (sheets[0]?.id ?? "")
  );
  // Deux machines, sans profils : l'outil ne les règle pas, il utilise ce
  // qu'elles fournissent (pour la Duplo, son catalogue de jobs).
  const [machine, setMachine] = useState<CutterMachine>(cfg?.machine ?? "duplo");
  const [duploJobId, setDuploJobId] = useState(cfg?.duploJobId ?? "");
  const [orientation, setOrientation] = useState<PieceOrientation>(cfg?.orientation ?? "auto");
  const [flip, setFlip] = useState<FlipEdge>(cfg?.flip ?? "long");
  const [items, setItems] = useState<SourceItem[]>(() =>
    (cfg?.sources ?? []).map((src, index) => {
      const product = src.kind === "product" ? products.find((p) => p.id === src.productId) : undefined;
      return {
        key: `item-${index}`,
        kind: src.kind,
        name: product?.name ?? src.name,
        productId: src.productId,
        storedPath: src.path,
        widthMm: product?.widthMm ?? src.widthMm,
        heightMm: product?.heightMm ?? src.heightMm,
        copies: src.copies,
      };
    })
  );
  const [productToAdd, setProductToAdd] = useState("");
  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [modal, setModal] = useState<ModalState>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const nextKey = useRef(cfg?.sources.length ?? 0);

  // Miniature du recto de chaque fichier (adresse d'objet, par clé de fichier), pour
  // montrer le visuel dans l'aperçu de la feuille. Une miniature qui n'a pas pu être
  // produite reste absente : la pièce garde alors sa couleur.
  const [thumbs, setThumbs] = useState<Record<string, string>>({});
  const thumbsRequested = useRef(new Set<string>());
  const thumbsRef = useRef(thumbs);
  thumbsRef.current = thumbs;
  useEffect(() => {
    for (const item of items) {
      if (thumbsRequested.current.has(item.key)) continue;
      const body = new FormData();
      if (item.kind === "product" && item.productId) body.append("productId", item.productId);
      else if (item.file) body.append("file", item.file);
      else if (item.storedPath) body.append("path", item.storedPath);
      else continue;
      thumbsRequested.current.add(item.key);
      fetch("/api/imposition/thumbnail", { method: "POST", body })
        .then((res) => (res.ok ? res.blob() : null))
        .then((blob) => {
          if (blob) setThumbs((current) => ({ ...current, [item.key]: URL.createObjectURL(blob) }));
        })
        .catch(() => {});
    }
  }, [items]);
  useEffect(() => () => Object.values(thumbsRef.current).forEach((url) => URL.revokeObjectURL(url)), []);

  // Si le préréglage sélectionné a été supprimé (ou le premier vient d'être
  // créé), retombe sur un choix valide.
  useEffect(() => {
    if (!sheets.some((s) => s.id === sheetId)) setSheetId(sheets[0]?.id ?? "");
  }, [sheets, sheetId]);

  // Libère le PDF généré quand la modale de résultat se ferme.
  useEffect(() => {
    if (modal?.mode !== "result") return;
    const { url } = modal;
    return () => URL.revokeObjectURL(url);
  }, [modal]);

  const sheet = sheets.find((s) => s.id === sheetId) ?? null;
  const format = formats.find((f) => f.id === formatId) ?? null;
  const piece =
    formatId === CUSTOM || !format
      ? { widthMm: customWidth, heightMm: customHeight, bleedMm: customBleed }
      : { widthMm: format.widthMm, heightMm: format.heightMm, bleedMm: format.bleedMm };

  // Jobs de la Duplo qui conviennent à la feuille et au format choisis (avec la
  // grille qu'ils donnent), les plus remplis d'abord.
  const isDuplo = machine === "duplo";
  const duploCandidates = useMemo(() => {
    if (!sheet || !isDuplo) return [];
    return duploJobs
      .flatMap((job) => {
        const jobLayout = computeDuploLayout({
          job: { widthMm: job.width_mm, lengthMm: job.length_mm, slits: job.slits, cuts: job.cuts },
          sheetWidth: sheet.width_mm,
          sheetHeight: sheet.height_mm,
          pieceWidth: piece.widthMm,
          pieceHeight: piece.heightMm,
          bleedMm: piece.bleedMm,
          orientation,
          offsetX: 0,
          offsetY: 0,
        });
        return jobLayout ? [{ job, layout: jobLayout }] : [];
      })
      .sort((a, b) => b.layout.cells.length - a.layout.cells.length || a.job.job_no - b.job.job_no);
  }, [duploJobs, isDuplo, sheet, piece.widthMm, piece.heightMm, piece.bleedMm, orientation]);
  // Un job qui ne convient plus (autre feuille, autre format) est simplement ignoré.
  const activeDuplo = duploCandidates.find((c) => c.job.id === duploJobId) ?? null;
  // La grille vient uniquement du job choisi (l'outil ne règle pas la Duplo).
  const layout = activeDuplo?.layout ?? null;

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
    : !isDuplo
      ? `${MACHINE_LABELS[machine]} : paramètres à venir.`
      : !activeDuplo
        ? duploJobs.length === 0
          ? "Importez le catalogue de jobs de la Duplo (Job Duplo > Gérer)."
          : duploCandidates.length === 0
            ? "Aucun job Duplo ne convient à cette feuille et à ce format : créez-le sur la Duplo, puis réimportez l'AllJobs."
            : "Choisissez un job Duplo."
        : !layout || cellCount === 0
        ? "Ce format ne rentre pas dans la zone utile de la feuille."
        : items.length === 0
          ? "Ajoutez au moins un fichier."
          : overflow > 0
            ? `Trop de copies : ${overflow} de plus que les ${cellCount} emplacements.`
            : mismatched.length > 0
              ? `La taille de « ${mismatched[0].name} » ne correspond pas au format.`
              : null;
  const saveProblem = problem ?? (name.trim() ? null : "Donnez un nom à l'imposition pour l'enregistrer.");

  // Requête commune à l'aperçu et à l'enregistrement.
  function buildBody(): FormData | null {
    if (!sheet || !activeDuplo) return null;
    const body = new FormData();
    body.append("sheetId", sheet.id);
    body.append("machine", machine);
    body.append("duploJobId", activeDuplo.job.id);
    body.append("pieceWidthMm", String(piece.widthMm));
    body.append("pieceHeightMm", String(piece.heightMm));
    body.append("orientation", orientation);
    body.append("flip", flip);
    body.append("pieceBleedMm", String(piece.bleedMm));
    if (saved) body.append("impositionId", saved.id);
    body.append(
      "config",
      JSON.stringify({
        version: 1,
        sheetId: sheet.id,
        machine,
        duploJobId: activeDuplo.job.id,
        formatId,
        custom: { widthMm: customWidth, heightMm: customHeight, bleedMm: customBleed },
        orientation,
        flip,
      })
    );
    const specs = items.map((item, index) => {
      const shown = { name: item.name, widthMm: item.widthMm, heightMm: item.heightMm, copies: item.copies };
      if (item.kind === "upload" && item.file) {
        body.append(`file${index}`, item.file);
        return { kind: "upload", field: `file${index}`, ...shown };
      }
      if (item.kind === "upload" && item.storedPath) return { kind: "stored", path: item.storedPath, ...shown };
      return { kind: "product", productId: item.productId, ...shown };
    });
    body.append("sources", JSON.stringify(specs));
    return body;
  }

  // Aperçu du PDF, sans l'enregistrer.
  async function handlePreview() {
    const body = buildBody();
    if (!body || problem) return;
    setGenerating(true);
    setError(null);
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

  // Enregistre l'imposition (nom, configuration et PDF) puis revient à la liste.
  async function handleSave() {
    const body = buildBody();
    if (!body || saveProblem) return;
    body.append("name", name.trim());
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(saved ? `/api/impositions/${saved.id}` : "/api/impositions", {
        method: saved ? "PATCH" : "POST",
        body,
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "Erreur lors de l'enregistrement.");
        setSaving(false);
        return;
      }
      router.push("/imposition");
      router.refresh();
    } catch {
      setError("Impossible de joindre le serveur.");
      setSaving(false);
    }
  }

  // Réglage de l'imprimante (Fiery) qui correspond à chaque bord de retournement :
  // haut-haut si la feuille se retourne autour de son axe vertical, haut-bas sinon.
  // Sans feuille choisie, on suppose une feuille en portrait.
  function flipMode(edge: FlipEdge): string {
    const vertical = flipAxisIsVertical(sheet?.width_mm ?? 1, sheet?.height_mm ?? 2, edge);
    return vertical ? "haut-haut" : "haut-bas";
  }

  const selectClass = "mt-1 w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm";
  const labelClass = "block text-xs font-medium text-neutral-500";

  return (
    <div>
      <div className="mb-6">
        <Link href="/imposition" className="text-xs text-neutral-500 underline hover:text-pico-black">
          ← Toutes les impositions
        </Link>
        <h1 className="mt-1 flex items-center gap-2 text-xl font-semibold text-pico-black">
          {saved ? "Modifier l'imposition" : "Nouvelle imposition"}
          <UpdatingBadge show={isRefreshing} />
        </h1>
        <p className="text-sm text-neutral-500">
          Placez des PDF d&apos;impression sur une feuille selon le format et les paramètres de la machine.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,26rem)_1fr]">
        <div className="space-y-5">
          <section className="space-y-4 rounded-xl border border-neutral-200 bg-white p-4 shadow-sm">
            <div>
              <label className={labelClass}>Nom de l&apos;imposition</label>
              <input
                type="text"
                value={name}
                maxLength={120}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ex. Cartes d'affaires — commande 1042"
                className={selectClass}
              />
            </div>

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
              <label className={labelClass}>Découpeuse</label>
              <select
                value={machine}
                onChange={(e) => setMachine(e.target.value as CutterMachine)}
                className={selectClass}
              >
                {MACHINES.map((m) => (
                  <option key={m} value={m}>
                    {MACHINE_LABELS[m]}
                  </option>
                ))}
              </select>
              {!isDuplo && (
                <p className="mt-1 text-xs text-neutral-500">
                  Les paramètres de la {MACHINE_LABELS[machine]} seront ajoutés plus tard.
                </p>
              )}
            </div>

            {isDuplo && (
              <div>
                <div className="flex items-center justify-between">
                  <label className={labelClass}>Job Duplo</label>
                  <button
                    type="button"
                    onClick={() => setModal({ mode: "duplo-jobs" })}
                    className="text-xs text-neutral-500 underline hover:text-pico-black"
                  >
                    Gérer
                  </button>
                </div>
                <select
                  value={activeDuplo?.job.id ?? ""}
                  onChange={(e) => setDuploJobId(e.target.value)}
                  className={selectClass}
                >
                  <option value="">
                    {duploJobs.length === 0
                      ? "— Aucun job importé —"
                      : duploCandidates.length === 0
                        ? "— Aucun job pour cette feuille et ce format —"
                        : "— Choisir un job —"}
                  </option>
                  {duploCandidates.map(({ job, layout: jobLayout }) => (
                    <option key={job.id} value={job.id}>
                      N° {job.job_no} — {job.name} · {jobLayout.cells.length} pièces ({jobLayout.cols} × {jobLayout.rows})
                    </option>
                  ))}
                </select>
                {activeDuplo && (
                  <p className="mt-1 text-xs text-neutral-500">
                    Les pièces suivent les traits du job : marges, espacement et centrage du profil sont ignorés
                    (le décalage de calibration reste appliqué).
                    {barcodeJobNos.includes(activeDuplo.job.job_no)
                      ? " Le code-barres du job est posé au recto, à la position lue par la Duplo."
                      : ""}
                    {activeDuplo.job.reg_mark
                      ? ` Repère REG à ${Math.round(activeDuplo.job.side_mark_mm * 10) / 10} mm du bord latéral et ${Math.round(activeDuplo.job.lead_mark_mm * 10) / 10} mm du bord d'attaque, dans le même coin.`
                      : ""}
                  </p>
                )}
              </div>
            )}

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
                  <option value="long">Sur le bord long ({flipMode("long")})</option>
                  <option value="short">Sur le bord court ({flipMode("short")})</option>
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
                images={items.map((item) =>
                  thumbs[item.key]
                    ? { url: thumbs[item.key], widthMm: item.widthMm, heightMm: item.heightMm }
                    : null
                )}
                multiColor={items.length > 1}
                hasBarcode={Boolean(activeDuplo && barcodeJobNos.includes(activeDuplo.job.job_no))}
                regRects={
                  activeDuplo?.job.reg_mark
                    ? regMarkRects(
                        DUPLO_MARKS.corner,
                        activeDuplo.job.side_mark_mm,
                        activeDuplo.job.lead_mark_mm,
                        sheet.width_mm,
                        sheet.height_mm
                      )
                    : null
                }
                bleedMm={showCuts ? piece.bleedMm : null}
              />
            ) : (
              <p className="text-sm text-neutral-500">
                {!sheet
                  ? "Choisissez une feuille."
                  : isDuplo
                    ? "Choisissez un job Duplo pour voir la grille."
                    : `${MACHINE_LABELS[machine]} : paramètres à venir.`}
              </p>
            )}
            <p className="mt-3 text-xs text-neutral-500">
              L&apos;aperçu montre la grille ; les marques de la découpeuse et le verso apparaissent dans le PDF
              généré. Pointillés gris = zone utile (feuille moins marges). Traits orange = coupes de la
              découpeuse, de bord à bord de la feuille, au bord de chaque pièce finie (à l&apos;intérieur du fond
              perdu) : visibles ici seulement, jamais dans le PDF.
            </p>
          </div>

          <div className="flex flex-col items-stretch gap-2">
            {(error || saveProblem) && (
              <p className={`text-sm ${error ? "text-red-600" : "text-neutral-500"}`}>{error ?? saveProblem}</p>
            )}
            <button
              type="button"
              onClick={handleSave}
              disabled={saving || generating || Boolean(saveProblem)}
              className="flex items-center justify-center gap-2 rounded-lg bg-pico-maroon px-4 py-2.5 text-sm font-medium text-white hover:bg-pico-maroon-dark disabled:opacity-50"
            >
              {saving && <SpinnerIcon className="h-4 w-4" />}
              {saving ? "Enregistrement en cours..." : saved ? "Enregistrer les modifications" : "Enregistrer l'imposition"}
            </button>
            <button
              type="button"
              onClick={handlePreview}
              disabled={saving || generating || Boolean(problem)}
              className="flex items-center justify-center gap-2 rounded-lg border border-neutral-300 px-4 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-50 disabled:opacity-50"
            >
              {generating && <SpinnerIcon className="h-4 w-4" />}
              {generating ? "Génération en cours..." : "Aperçu du PDF (sans enregistrer)"}
            </button>
          </div>
        </section>
      </div>

      {modal?.mode === "sheets" && (
        <Modal title="Gérer les feuilles" onClose={() => setModal(null)}>
          <SheetsManager sheets={sheets} onChanged={refreshPresets} />
        </Modal>
      )}
      {modal?.mode === "duplo-jobs" && (
        <Modal title="Jobs de la Duplo" onClose={() => setModal(null)} wide>
          <DuploJobsManager jobs={duploJobs} barcodeJobNos={barcodeJobNos} onChanged={refreshPresets} />
        </Modal>
      )}
      {modal?.mode === "result" && (
        <Modal title="Aperçu du PDF imposé" onClose={() => setModal(null)} wide>
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

function SheetPreview({
  sheet,
  layout,
  assignment,
  images,
  multiColor,
  hasBarcode,
  regRects,
  bleedMm,
}: {
  sheet: ImpositionSheet;
  layout: Layout;
  assignment: (number | null)[];
  // Miniature du recto de chaque fichier (null tant qu'elle n'est pas prête) et taille de sa page.
  images: ({ url: string; widthMm: number | null; heightMm: number | null } | null)[];
  multiColor: boolean;
  hasBarcode: boolean;
  // Traits du repère REG du job Duplo (mm), ou null.
  regRects: MmRect[] | null;
  // Fond perdu par côté ; null = lignes de coupe masquées.
  bleedMm: number | null;
}) {
  const { usable } = layout;
  const stroke = sheet.width_mm / 500;
  const fontSize = Math.min(layout.cellWidth, layout.cellHeight) * 0.4;
  const { xs: cutXs, ys: cutYs } = bleedMm === null ? { xs: [], ys: [] } : cutLines(layout, bleedMm);
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
        const image = source === null ? null : images[source] ?? null;
        // Comme dans le PDF : la page est posée à plat si elle a la taille de la
        // pièce, sinon tournée d'un quart de tour (sens antihoraire).
        const sideways =
          image !== null &&
          image.widthMm !== null &&
          image.heightMm !== null &&
          !(Math.abs(image.widthMm - cell.width) <= 0.5 && Math.abs(image.heightMm - cell.height) <= 0.5);
        const cx = cell.x + cell.width / 2;
        const cy = cell.y + cell.height / 2;
        return (
          <g key={`${cell.row}-${cell.col}`}>
            {image &&
              (sideways ? (
                <image
                  href={image.url}
                  x={cx - cell.height / 2}
                  y={cy - cell.width / 2}
                  width={cell.height}
                  height={cell.width}
                  preserveAspectRatio="none"
                  transform={`rotate(-90 ${cx} ${cy})`}
                />
              ) : (
                <image
                  href={image.url}
                  x={cell.x}
                  y={cell.y}
                  width={cell.width}
                  height={cell.height}
                  preserveAspectRatio="none"
                />
              ))}
            <rect
              x={cell.x}
              y={cell.y}
              width={cell.width}
              height={cell.height}
              fill={image ? "none" : color ?? "none"}
              fillOpacity={0.35}
              stroke={color ?? "#a99e8e"}
              strokeWidth={stroke}
              strokeDasharray={color ? undefined : `${stroke * 3} ${stroke * 3}`}
            />
            {multiColor && source !== null && !image && (
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
      {regRects?.map((r, i) => (
        <rect key={`reg-${i}`} x={r.x} y={r.y} width={r.width} height={r.height} fill="#1a1613" />
      ))}
      {(hasBarcode || regRects) && (
        <text x={sheet.width_mm / 2} y={sheet.height_mm - 2} fontSize={sheet.width_mm / 45} textAnchor="middle" fill="#7d7364">
          + {[hasBarcode && "code-barres du job", regRects && "repère REG"]
            .filter(Boolean)
            .join(" + ")}
        </text>
      )}
    </svg>
  );
}
