// Libellé d'un modèle avec son nombre de côtés : plusieurs modèles portent le
// même nom en version recto et recto-verso, et ne se distingueraient pas
// autrement dans une liste. Affichage seulement, le nom en base est inchangé.
export function templateLabel(name: string, twoSided: boolean): string {
  return `${name.trim()} – ${twoSided ? "Recto-verso" : "Recto"}`;
}
