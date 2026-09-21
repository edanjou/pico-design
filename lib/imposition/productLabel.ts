// Les produits créés depuis une image téléversée portent tous le nom de leur
// modèle (« Cartes d'affaires »), impossible à distinguer dans l'Imposition. On
// y ajoute ce qui les différencie : le nom du visuel de la banque, ou celui du
// fichier téléversé.

export interface ProductLabelRow {
  name: string;
  // « products/<id>/source-<fichier>.<ext> »
  image_path: string | null;
  visual_id: string | null;
}

// Nom du visuel ou du fichier d'origine du produit, null s'il est inconnu.
function productOrigin(row: ProductLabelRow, visualNames: Map<string, string>): string | null {
  if (row.visual_id) return visualNames.get(row.visual_id) ?? null;
  const file = row.image_path?.split("/").pop()?.replace(/^source-/, "").replace(/\.[^.]+$/, "");
  return file ? file : null;
}

// « Cartes d'affaires — dupont », ou le nom seul quand il contient déjà l'origine.
export function productDisplayName(row: ProductLabelRow, visualNames: Map<string, string>): string {
  const origin = productOrigin(row, visualNames);
  if (!origin || row.name.toLowerCase().includes(origin.toLowerCase())) return row.name;
  return `${row.name} — ${origin}`;
}
