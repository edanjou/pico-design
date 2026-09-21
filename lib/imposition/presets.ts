// Validation partagée des préréglages de feuilles reçus par les routes API.

// Pouces arrondis au centième, sans zéros inutiles (304,8 mm → "12").
export function formatInches(mm: number): string {
  return String(Math.round((mm / 25.4) * 100) / 100);
}

// Une feuille n'a pas de nom : elle est identifiée par ses dimensions.
export function sheetLabel(widthMm: number, heightMm: number): string {
  return `${formatInches(widthMm)} × ${formatInches(heightMm)} po`;
}

export function parseSheetBody(body: unknown) {
  const b = (body ?? {}) as Record<string, unknown>;
  const width = Number(b.width_mm);
  const height = Number(b.height_mm);
  if (!(width > 0) || !(height > 0)) return null;
  // La colonne `name` (non nulle en base) est remplie avec le libellé des
  // dimensions ; l'interface, elle, affiche toujours le libellé calculé.
  return { name: sheetLabel(width, height), width_mm: width, height_mm: height };
}
