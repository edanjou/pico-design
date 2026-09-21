// Codes-barres des jobs de la Duplo : un PDF par numéro de job, stocké dans le
// bucket privé "imposition" sous duplo-barcodes/<n°>.pdf. Le numéro est lu dans
// le nom du fichier importé. Fonctions pures.

export const BARCODE_DIR = "duplo-barcodes";
export const MAX_BARCODE_BYTES = 2 * 1024 * 1024;
export const MAX_JOB_NO = 999;

export function barcodePath(jobNo: number): string {
  return `${BARCODE_DIR}/${jobNo}.pdf`;
}

// Numéro de job d'après le nom d'un fichier : le dernier groupe de chiffres du
// nom (« 004.pdf », « Job_4.pdf », « barcode-004.pdf » donnent tous 4).
export function jobNoFromFileName(fileName: string): number | null {
  const base = fileName.replace(/\.[^.]*$/, "");
  const match = base.match(/(\d+)(?!.*\d)/);
  if (!match) return null;
  const no = Number.parseInt(match[1], 10);
  return no >= 1 && no <= MAX_JOB_NO ? no : null;
}

// Numéros de job d'une liste de fichiers du dossier de stockage (« 4.pdf »).
export function jobNosFromStoredNames(names: string[]): number[] {
  return names
    .map((n) => /^(\d+)\.pdf$/.exec(n))
    .flatMap((m) => (m ? [Number.parseInt(m[1], 10)] : []))
    .sort((a, b) => a - b);
}
