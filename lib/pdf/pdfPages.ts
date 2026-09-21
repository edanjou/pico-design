// Un PDF importé peut avoir deux pages : le recto puis le verso. Ces fonctions
// sont partagées entre le navigateur (avis et validation du formulaire) et le
// serveur (choix des pages à rasteriser), pour que la règle soit la même des
// deux côtés.

// Nombre de pages d'un PDF. Retourne 1 si le fichier ne peut pas être analysé :
// la rasterisation signalera alors elle-même le problème.
export async function pdfPageCount(bytes: ArrayBuffer | Uint8Array): Promise<number> {
  try {
    // Chargé à la demande : pdf-lib est lourd et ne sert qu'aux PDF, pas au
    // reste de la page Produits.
    const { PDFDocument } = await import("pdf-lib");
    const doc = await PDFDocument.load(bytes, { ignoreEncryption: true, updateMetadata: false });
    return Math.max(1, doc.getPageCount());
  } catch {
    return 1;
  }
}

export interface PdfPagePlan {
  // Page du verso dans ce même PDF, ou null si le verso ne vient pas de lui.
  backPage: 2 | null;
  // Avis à montrer à l'utilisateur quand des pages du PDF ne sont pas utilisées.
  warning: string | null;
}

// Le recto est toujours la première page. La deuxième devient le verso d'un
// modèle recto-verso dont le verso n'est pas fourni par ailleurs ; sinon (modèle
// recto seul, verso déjà choisi, pages en trop) elle est ignorée et on le signale.
export function planPdfPages(input: {
  pageCount: number;
  twoSided: boolean;
  // Un verso est déjà fourni (fichier ou visuel de la banque).
  hasOwnBack: boolean;
}): PdfPagePlan {
  const { pageCount, twoSided, hasOwnBack } = input;
  if (pageCount < 2) return { backPage: null, warning: null };
  const pages = `Le PDF compte ${pageCount} pages`;
  if (!twoSided) {
    return { backPage: null, warning: `${pages}, mais le modèle est recto seulement : seule la première page est utilisée.` };
  }
  if (hasOwnBack) {
    return { backPage: null, warning: `${pages}, mais un verso est déjà fourni : seule la première page (recto) est utilisée.` };
  }
  return {
    backPage: 2,
    warning: pageCount > 2 ? `${pages} : seules la première (recto) et la deuxième (verso) sont utilisées.` : null,
  };
}
