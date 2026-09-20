import { NextResponse } from "next/server";
import { createServerSupabaseClient, createAdminSupabaseClient } from "@/lib/supabase/server";
import { imposeToPdf, type ImpositionMarks, type ImpositionSource } from "@/lib/imposition/render";
import { detectMarksKind } from "@/lib/imposition/marks";
import { formatInches, validateCutterSettings } from "@/lib/imposition/presets";
import type { FlipEdge, PieceOrientation } from "@/lib/imposition/layout";
import type { ImpositionCutter, ImpositionSheet } from "@/lib/types";

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
  const cutterId = String(formData.get("cutterId") ?? "");
  const pieceWidth = Number(formData.get("pieceWidthMm"));
  const pieceHeight = Number(formData.get("pieceHeightMm"));
  const orientationRaw = String(formData.get("orientation") ?? "auto");
  const orientation: PieceOrientation =
    orientationRaw === "normal" || orientationRaw === "rotated" ? orientationRaw : "auto";
  const flip: FlipEdge = formData.get("flip") === "short" ? "short" : "long";

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

  const [{ data: sheet }, { data: cutter }] = await Promise.all([
    supabase.from("imposition_sheets").select("*").eq("id", sheetId).single<ImpositionSheet>(),
    supabase.from("imposition_cutters").select("*").eq("id", cutterId).single<ImpositionCutter>(),
  ]);
  if (!sheet) return badRequest("Feuille introuvable.", 404);
  if (!cutter) return badRequest("Profil de découpeuse introuvable.", 404);

  // Réglages ajustés à l'écran (non enregistrés) : ils priment sur le profil,
  // pour que le PDF corresponde exactement à l'aperçu.
  const overrideRaw = formData.get("cutterSettings");
  if (typeof overrideRaw === "string" && overrideRaw) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(overrideRaw);
    } catch {
      return badRequest("Réglages de la découpeuse invalides.");
    }
    const validated = validateCutterSettings((parsed ?? {}) as Record<string, unknown>);
    if (validated.error !== undefined) return badRequest(validated.error);
    Object.assign(cutter, validated.fields);
  }

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

  let marks: ImpositionMarks | null = null;
  if (cutter.marks_path) {
    const { data: file, error } = await admin.storage.from("imposition").download(cutter.marks_path);
    if (error || !file) return badRequest("Fichier de marques introuvable pour cette découpeuse.", 404);
    const bytes = new Uint8Array(await file.arrayBuffer());
    const kind = detectMarksKind(bytes);
    if (!kind) return badRequest("Le fichier de marques n'est ni un PDF ni une image PNG/JPEG.");
    marks = { bytes, kind };
  }

  try {
    const result = await imposeToPdf({
      sheetWidth: sheet.width_mm,
      sheetHeight: sheet.height_mm,
      margins: {
        top: cutter.margin_top_mm,
        right: cutter.margin_right_mm,
        bottom: cutter.margin_bottom_mm,
        left: cutter.margin_left_mm,
      },
      gutterX: cutter.gutter_x_mm,
      gutterY: cutter.gutter_y_mm,
      offsetX: cutter.offset_x_mm,
      offsetY: cutter.offset_y_mm,
      centerGrid: cutter.center_grid,
      pieceWidth,
      pieceHeight,
      orientation,
      flip,
      sources,
      marks,
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
