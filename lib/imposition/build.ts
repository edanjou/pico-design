// Construction du PDF imposé à partir de la requête envoyée par l'écran
// d'imposition. Partagée par l'aperçu (sans enregistrement) et par
// l'enregistrement d'une imposition : les deux produisent exactement le même PDF.

import { createServerSupabaseClient, createAdminSupabaseClient } from "@/lib/supabase/server";
import {
  imposeToPdf,
  type ImpositionBarcode,
  type ImpositionRegMark,
  type ImpositionSource,
} from "@/lib/imposition/render";
import { barcodePath } from "@/lib/imposition/barcodes";
import { productDisplayName } from "@/lib/imposition/productLabel";
import { DUPLO_MARKS } from "@/lib/imposition/duplo";
import { MACHINE_LABELS, isMachine } from "@/lib/imposition/machines";
import { STORED_SOURCE_PATH, sourcesDir } from "@/lib/imposition/saved";
import type { FlipEdge, PieceOrientation } from "@/lib/imposition/layout";
import type { ImpositionDuploJob, ImpositionSheet } from "@/lib/types";

// Erreur à renvoyer telle quelle à l'utilisateur (message en français + code HTTP).
export class ImpositionError extends Error {
  constructor(
    message: string,
    public status = 400
  ) {
    super(message);
  }
}

// Un fichier à imposer, tel qu'envoyé par l'écran : un produit Pico, un PDF
// téléversé (dans le champ `field` de la requête) ou un PDF déjà enregistré
// avec l'imposition qu'on modifie (`path`).
export type SourceSpec = { copies: number; name?: string; widthMm?: number | null; heightMm?: number | null } & (
  | { kind: "product"; productId: string }
  | { kind: "upload"; field: string }
  | { kind: "stored"; path: string }
);

export interface BuiltSource {
  spec: SourceSpec;
  name: string;
  // Octets du PDF pour un fichier téléversé ou déjà enregistré (à ranger avec l'imposition).
  bytes: Uint8Array | null;
}

export interface BuiltImposition {
  pdf: Buffer;
  sheet: ImpositionSheet;
  duploJob: ImpositionDuploJob;
  sources: BuiltSource[];
}

// Clients Supabase utilisés (celui de l'utilisateur connecté, et le client
// administrateur pour le stockage) : injectables pour les tests.
export interface SupabaseClients {
  supabase: ReturnType<typeof createServerSupabaseClient>;
  admin: ReturnType<typeof createAdminSupabaseClient>;
}

export const serverClients = (): SupabaseClients => ({
  supabase: createServerSupabaseClient(),
  admin: createAdminSupabaseClient(),
});

export async function buildImposition(
  formData: FormData,
  { supabase, admin }: SupabaseClients = serverClients()
): Promise<BuiltImposition> {

  const sheetId = String(formData.get("sheetId") ?? "");
  const machine = formData.get("machine");
  const pieceWidth = Number(formData.get("pieceWidthMm"));
  const pieceHeight = Number(formData.get("pieceHeightMm"));
  const orientationRaw = String(formData.get("orientation") ?? "auto");
  const orientation: PieceOrientation =
    orientationRaw === "normal" || orientationRaw === "rotated" ? orientationRaw : "auto";
  const flip: FlipEdge = formData.get("flip") === "short" ? "short" : "long";
  const duploJobId = String(formData.get("duploJobId") ?? "");
  const pieceBleedMm = Number(formData.get("pieceBleedMm") ?? 0) || 0;
  // Imposition qu'on modifie : seuls ses propres PDF enregistrés peuvent être réutilisés.
  const impositionId = String(formData.get("impositionId") ?? "");
  const storedPrefix = /^[0-9a-f-]{36}$/i.test(impositionId) ? `${sourcesDir(impositionId)}/` : null;

  if (!(pieceWidth > 0) || !(pieceHeight > 0)) throw new ImpositionError("Le format de la pièce est invalide.");

  let specs: SourceSpec[];
  try {
    specs = JSON.parse(String(formData.get("sources") ?? "[]"));
  } catch {
    throw new ImpositionError("Liste de fichiers invalide.");
  }
  if (!Array.isArray(specs) || specs.length === 0) throw new ImpositionError("Ajoutez au moins un fichier.");
  if (specs.some((s) => !Number.isInteger(s.copies) || s.copies < 1)) {
    throw new ImpositionError("Le nombre de copies doit être un entier d'au moins 1.");
  }

  if (!isMachine(machine)) throw new ImpositionError("Machine inconnue.");
  // Seule la Duplo est prise en charge pour l'instant, avec les paramètres de
  // son catalogue : l'outil ne la règle pas, sa grille vient d'un de ses jobs.
  if (machine !== "duplo") throw new ImpositionError(`${MACHINE_LABELS[machine]} : paramètres à venir.`);
  if (!duploJobId) throw new ImpositionError("Choisissez un job Duplo.");

  const [{ data: sheet }, { data: duploJob }] = await Promise.all([
    supabase.from("imposition_sheets").select("*").eq("id", sheetId).single<ImpositionSheet>(),
    supabase.from("imposition_duplo_jobs").select("*").eq("id", duploJobId).single<ImpositionDuploJob>(),
  ]);
  if (!sheet) throw new ImpositionError("Feuille introuvable.", 404);
  if (!duploJob) throw new ImpositionError("Job Duplo introuvable.", 404);

  const sources: ImpositionSource[] = [];
  const built: BuiltSource[] = [];
  for (const spec of specs) {
    if (spec.kind === "upload") {
      const file = formData.get(spec.field);
      if (!(file instanceof File) || file.size === 0) throw new ImpositionError("Fichier PDF manquant.");
      const bytes = new Uint8Array(await file.arrayBuffer());
      sources.push({ name: file.name, pdf: bytes, copies: spec.copies });
      built.push({ spec, name: file.name, bytes });
    } else if (spec.kind === "stored") {
      if (
        !storedPrefix ||
        typeof spec.path !== "string" ||
        !spec.path.startsWith(storedPrefix) ||
        !STORED_SOURCE_PATH.test(spec.path)
      ) {
        throw new ImpositionError("Fichier enregistré invalide.");
      }
      const { data: file, error } = await admin.storage.from("imposition").download(spec.path);
      if (error || !file) throw new ImpositionError("Un PDF enregistré avec cette imposition est introuvable.", 404);
      const bytes = new Uint8Array(await file.arrayBuffer());
      const name = spec.name || spec.path.split("/").pop() || "fichier.pdf";
      sources.push({ name, pdf: bytes, copies: spec.copies });
      built.push({ spec, name, bytes });
    } else if (spec.kind === "product") {
      const { data: product } = await supabase
        .from("products")
        .select("name, pdf_path, image_path, visual_id")
        .eq("id", spec.productId)
        .single<{ name: string; pdf_path: string | null; image_path: string | null; visual_id: string | null }>();
      if (!product) throw new ImpositionError("Produit introuvable.", 404);
      if (!product.pdf_path) {
        throw new ImpositionError(`Le PDF de « ${product.name} » n'a pas encore été généré.`);
      }
      const { data: file, error } = await admin.storage.from("outputs").download(product.pdf_path);
      if (error || !file) throw new ImpositionError(`PDF introuvable pour « ${product.name} ».`, 404);
      const { data: visual } = product.visual_id
        ? await supabase.from("visuals").select("name").eq("id", product.visual_id).single<{ name: string }>()
        : { data: null };
      const label = productDisplayName(product, new Map(visual && product.visual_id ? [[product.visual_id, visual.name]] : []));
      sources.push({ name: label, pdf: new Uint8Array(await file.arrayBuffer()), copies: spec.copies });
      built.push({ spec, name: label, bytes: null });
    } else {
      throw new ImpositionError("Type de fichier inconnu.");
    }
  }

  // Code-barres du job Duplo (s'il en a un d'importé) : posé au recto à la
  // position fixe lue par la machine.
  let barcode: ImpositionBarcode | null = null;
  const { data: barcodeFile } = await admin.storage.from("imposition").download(barcodePath(duploJob.job_no));
  if (barcodeFile) {
    barcode = {
      pdf: new Uint8Array(await barcodeFile.arrayBuffer()),
      corner: DUPLO_MARKS.corner,
      xMm: DUPLO_MARKS.barcodeXMm,
      yMm: DUPLO_MARKS.barcodeYMm,
      rotation: DUPLO_MARKS.barcodeRotation,
    };
  }

  // Repère REG du job : dans le même coin que le code-barres, aux distances du job.
  const regMark: ImpositionRegMark | null = duploJob.reg_mark
    ? { corner: DUPLO_MARKS.corner, sideMm: duploJob.side_mark_mm, leadMm: duploJob.lead_mark_mm }
    : null;

  try {
    const result = await imposeToPdf({
      sheetWidth: sheet.width_mm,
      sheetHeight: sheet.height_mm,
      // Marges, espacement et calibration ne servent pas : la grille vient du job.
      margins: { top: 0, right: 0, bottom: 0, left: 0 },
      gutterX: 0,
      gutterY: 0,
      offsetX: 0,
      offsetY: 0,
      centerGrid: false,
      pieceWidth,
      pieceHeight,
      orientation,
      flip,
      sources,
      marks: null,
      pieceBleedMm,
      barcode,
      regMark,
      duploJob: {
        widthMm: duploJob.width_mm,
        lengthMm: duploJob.length_mm,
        slits: duploJob.slits,
        cuts: duploJob.cuts,
      },
    });
    return { pdf: result.pdf, sheet, duploJob, sources: built };
  } catch (err) {
    throw new ImpositionError(err instanceof Error ? err.message : "Erreur lors de l'imposition.");
  }
}
