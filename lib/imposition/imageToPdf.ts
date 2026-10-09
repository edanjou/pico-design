import { MM_TO_PT } from "@/lib/pdf/units";

// Images acceptées comme fichiers à imposer, en plus des PDF.
export const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];

export function isImageFile(file: File): boolean {
  return IMAGE_TYPES.includes(file.type);
}

// PNG du contenu d'une image que pdf-lib n'intègre pas telle quelle (WebP).
async function toPng(file: File): Promise<Uint8Array> {
  const bitmap = await createImageBitmap(file);
  const canvas = document.createElement("canvas");
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0);
  bitmap.close();
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
  if (!blob) throw new Error("Conversion de l'image impossible.");
  return new Uint8Array(await blob.arrayBuffer());
}

// Met une image sur une page PDF au format de la pièce (fond perdu inclus) :
// la page prend l'orientation de l'image, qui la remplit entièrement, centrée
// (ce qui dépasse est rogné). Le PDF obtenu s'impose comme un PDF téléversé.
// Navigateur seulement (pdf-lib chargé à la demande).
export async function imageToPdf(file: File, pieceWidthMm: number, pieceHeightMm: number): Promise<File> {
  const { PDFDocument } = await import("pdf-lib");
  const doc = await PDFDocument.create();
  const image =
    file.type === "image/jpeg"
      ? await doc.embedJpg(await file.arrayBuffer())
      : file.type === "image/png"
        ? await doc.embedPng(await file.arrayBuffer())
        : await doc.embedPng(await toPng(file));

  const long = Math.max(pieceWidthMm, pieceHeightMm) * MM_TO_PT;
  const short = Math.min(pieceWidthMm, pieceHeightMm) * MM_TO_PT;
  const landscape = image.width > image.height;
  const pageW = landscape ? long : short;
  const pageH = landscape ? short : long;
  const scale = Math.max(pageW / image.width, pageH / image.height);
  const w = image.width * scale;
  const h = image.height * scale;

  const page = doc.addPage([pageW, pageH]);
  page.drawImage(image, { x: (pageW - w) / 2, y: (pageH - h) / 2, width: w, height: h });
  const bytes = await doc.save();
  const name = file.name.replace(/\.[^.]+$/, "") + ".pdf";
  return new File([new Uint8Array(bytes)], name, { type: "application/pdf" });
}
