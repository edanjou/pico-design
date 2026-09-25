// Lit les champs "foldMarksVertical"/"foldMarksHorizontal" envoyés par
// TemplateForm (un tableau de distances en mm depuis le bord de coupe, JSON,
// un par pli) — voir generateTemplatePreviewPng, qui les dessine en aperçu
// écran seulement (jamais dans le PDF imprimé). Retourne null (= aucune
// marque) si absent, vide ou invalide — jamais d'erreur bloquante pour ce
// réglage facultatif, comme parseOverlayOpacitiesField.
export function parseFoldMarksField(raw: FormDataEntryValue | null): number[] | null {
  if (typeof raw !== "string" || !raw) return null;
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed) || parsed.length === 0) return null;
    const values = parsed.map((v) => Number(v));
    if (values.some((n) => !Number.isFinite(n) || n < 0)) return null;
    return values;
  } catch {
    return null;
  }
}
