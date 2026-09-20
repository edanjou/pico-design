// Validation partagée des préréglages (feuilles et découpeuses) reçus par les
// routes API.

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

const CUTTER_NUMBER_FIELDS = [
  "margin_top_mm",
  "margin_right_mm",
  "margin_bottom_mm",
  "margin_left_mm",
  "gutter_x_mm",
  "gutter_y_mm",
  "offset_x_mm",
  "offset_y_mm",
] as const;

// Les décalages de calibration peuvent être négatifs ; marges et gouttières non.
const SIGNED_FIELDS = new Set<string>(["offset_x_mm", "offset_y_mm"]);

// Valide les réglages de grille d'un profil (depuis un formulaire ou un JSON).
export function validateCutterSettings(raw: Record<string, unknown>) {
  const fields: Record<string, number> = {};
  for (const field of CUTTER_NUMBER_FIELDS) {
    const r = raw[field];
    const value = r === null || r === undefined || r === "" ? 0 : Number(r);
    if (!Number.isFinite(value) || (!SIGNED_FIELDS.has(field) && value < 0)) {
      return { error: "Les marges et l'espacement doivent être des nombres positifs." } as const;
    }
    fields[field] = value;
  }
  return {
    fields: { ...fields, center_grid: raw.center_grid !== false && raw.center_grid !== "false" },
  } as const;
}

export function parseCutterForm(formData: FormData) {
  const name = String(formData.get("name") ?? "").trim();
  if (!name) return { error: "Le nom est requis." } as const;
  const settings = validateCutterSettings(Object.fromEntries(formData.entries()));
  if ("error" in settings) return settings;
  return { fields: { name, ...settings.fields } } as const;
}
