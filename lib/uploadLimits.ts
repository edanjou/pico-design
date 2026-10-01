/**
 * Plafonds sur les fichiers déposés par le PUBLIC (parcours Shopify, voir
 * lib/publicDesign.ts).
 *
 * Les routes de rendu acceptaient n'importe quel fichier, de n'importe
 * quelle taille : aucun bucket n'a de `file_size_limit`, et la limitation de
 * débit ne compte que les appels, pas les octets. Vingt envois par heure
 * suffisaient donc à écrire plusieurs gigaoctets derrière une seule adresse.
 * Ce n'est pas une prise de contrôle — les buckets sont privés et ces
 * fichiers ne sont jamais resservis au navigateur — c'est une facture et un
 * disque qui se remplit.
 *
 * Les utilisateurs CONNECTÉS ne sont pas concernés, comme pour la limitation
 * de débit : c'est le public qu'on encadre, pas l'équipe, dont les fichiers
 * d'impression peuvent légitimement être énormes.
 */

// Confortable pour de l'impression : une image 300 dpi en A4 pèse ~30 Mo.
export const MAX_FILE_BYTES = 40 * 1024 * 1024;
// Un design peut porter plusieurs calques, un recto et un verso.
export const MAX_TOTAL_BYTES = 80 * 1024 * 1024;

/**
 * Types acceptés. Calqué sur ce que l'outil propose déjà côté navigateur
 * (`accept="image/*,application/pdf"`) : la liste ne restreint donc aucun
 * usage réel, elle refuse ce que l'interface ne permettait déjà pas.
 */
function typeAccepté(type: string): boolean {
  return type.startsWith("image/") || type === "application/pdf";
}

function enMo(octets: number): string {
  return `${Math.round(octets / (1024 * 1024))} Mo`;
}

/**
 * Vérifie tous les fichiers d'un FormData. Renvoie un message d'erreur, ou
 * null si tout passe.
 *
 * Le type est celui annoncé par le navigateur, donc falsifiable : il écarte
 * les envois manifestement hors sujet, il ne prouve rien. C'est la TAILLE
 * qui protège réellement, et elle, elle est mesurée.
 */
export function publicUploadError(formData: FormData): string | null {
  let total = 0;
  for (const value of formData.values()) {
    if (!(value instanceof File) || value.size === 0) continue;
    if (value.size > MAX_FILE_BYTES) {
      return `Fichier trop lourd (${enMo(value.size)}). Maximum ${enMo(MAX_FILE_BYTES)} par fichier.`;
    }
    if (value.type && !typeAccepté(value.type)) {
      return `Format non accepté (${value.type}). Images et PDF seulement.`;
    }
    total += value.size;
  }
  if (total > MAX_TOTAL_BYTES) {
    return `Envoi trop lourd (${enMo(total)}). Maximum ${enMo(MAX_TOTAL_BYTES)} en tout.`;
  }
  return null;
}
