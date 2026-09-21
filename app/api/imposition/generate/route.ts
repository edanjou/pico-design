import { NextResponse } from "next/server";
import { createServerSupabaseClient, createAdminSupabaseClient } from "@/lib/supabase/server";
import {
  imposeToPdf,
  type ImpositionBarcode,
  type ImpositionRegMark,
  type ImpositionSource,
} from "@/lib/imposition/render";
import { barcodePath } from "@/lib/imposition/barcodes";
import { DUPLO_MARKS } from "@/lib/imposition/duplo";
import { formatInches } from "@/lib/imposition/presets";
import { MACHINE_LABELS, isMachine } from "@/lib/imposition/machines";
import type { FlipEdge, PieceOrientation } from "@/lib/imposition/layout";
import type { ImpositionDuploJob, ImpositionSheet } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 60;

type SourceSpec =
  | { kind: "product"; productId: string; copies: number }
  | { kind: "upload"; field: string; copies: number };

function badRequest(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

export async function POST(request: Request) {
  const supabase = createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return badRequest("Non authentifié.", 401);

  const formData = await request.formData();
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

  if (!(pieceWidth > 0) || !(pieceHeight > 0)) return badRequest("Le format de la pièce est invalide.");

  let specs: SourceSpec[];
  try {
    specs = JSON.parse(String(formData.get("sources") ?? "[]"));
  } catch {
    return badRequest("Liste de fichiers invalide.");
  }
  if (!Array.isArray(specs) || specs.length === 0) return badRequest("Ajoutez au moins un fichier.");
  if (specs.some((s) => !Number.isInteger(s.copies) || s.copies < 1)) {
    return badRequest("Le nombre de copies doit être un entier d'au moins 1.");
  }

  if (!isMachine(machine)) return badRequest("Machine inconnue.");
  // Seule la Duplo est prise en charge pour l'instant, avec les paramètres de
  // son catalogue : l'outil ne la règle pas, sa grille vient d'un de ses jobs.
  if (machine !== "duplo") return badRequest(`${MACHINE_LABELS[machine]} : paramètres à venir.`);
  if (!duploJobId) return badRequest("Choisissez un job Duplo.");

  const [{ data: sheet }, { data: duploJob }] = await Promise.all([
    supabase.from("imposition_sheets").select("*").eq("id", sheetId).single<ImpositionSheet>(),
    supabase.from("imposition_duplo_jobs").select("*").eq("id", duploJobId).single<ImpositionDuploJob>(),
  ]);
  if (!sheet) return badRequest("Feuille introuvable.", 404);
  if (!duploJob) return badRequest("Job Duplo introuvable.", 404);

  const admin = createAdminSupabaseClient();

  const sources: ImpositionSource[] = [];
  for (const spec of specs) {
    if (spec.kind === "upload") {
      const file = formData.get(spec.field);
      if (!(file instanceof File) || file.size === 0) return badRequest("Fichier PDF manquant.");
      sources.push({ name: file.name, pdf: new Uint8Array(await file.arrayBuffer()), copies: spec.copies });
    } else if (spec.kind === "product") {
      const { data: product } = await supabase
        .from("products")
        .select("name, pdf_path")
        .eq("id", spec.productId)
        .single<{ name: string; pdf_path: string | null }>();
      if (!product) return badRequest("Produit introuvable.", 404);
      if (!product.pdf_path) {
        return badRequest(`Le PDF de « ${product.name} » n'a pas encore été généré.`);
      }
      const { data: file, error } = await admin.storage.from("outputs").download(product.pdf_path);
      if (error || !file) return badRequest(`PDF introuvable pour « ${product.name} ».`, 404);
      sources.push({ name: product.name, pdf: new Uint8Array(await file.arrayBuffer()), copies: spec.copies });
    } else {
      return badRequest("Type de fichier inconnu.");
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
    const filename = `imposition-${formatInches(sheet.width_mm)}x${formatInches(sheet.height_mm)}.pdf`;
    return new NextResponse(new Uint8Array(result.pdf), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="${filename}"`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch (err) {
    return badRequest(err instanceof Error ? err.message : "Erreur lors de l'imposition.");
  }
}
