import { parsePositionValue } from "./pdf/crop";
import type { createServerSupabaseClient } from "./supabase/server";
import type { TemplateMockup } from "./types";

// Réexporté ici pour que les routes des mockups n'aient qu'une source pour
// lire le cadrage envoyé par le formulaire.
export { parsePositionValue };

/**
 * Échelle du visuel dans la zone d'un mockup. 1 = cadrage « cover » minimal
 * (le visuel remplit tout juste la zone) ; en dessous, la zone ne serait plus
 * couverte. Plafonnée à 5 comme la contrainte SQL (migration 0051).
 */
export function parseMockupZoomValue(value: FormDataEntryValue | null): number {
  const n = parseFloat(String(value ?? ""));
  if (!Number.isFinite(n)) return 1;
  return Math.min(5, Math.max(1, n));
}

type Supabase = ReturnType<typeof createServerSupabaseClient>;

// Ce qu'il faut d'un modèle pour retrouver son bundle : les routes de rendu
// ont déjà la ligne en main, inutile de la relire.
export interface TemplateBundleColumns {
  id: string;
  beauty_shot_xml_path: string | null;
  beauty_shot_overlay_opacities: number[] | null;
}

export interface ResolvedMockupBundle {
  xmlPath: string;
  overlayOpacities: number[] | null;
  // Cadrage du visuel propre à cet angle de prise de vue (voir
  // TemplateMockup.position_x/position_y/zoom) ; null pour le bundle
  // hérité, qui n'en a pas — on garde alors le cadrage choisi par le client.
  positionX: number | null;
  positionY: number | null;
  zoom: number | null;
  // Marges de la zone (fractions de sa largeur) ; 0 pour le bundle hérité.
  marginLeft: number;
  marginRight: number;
  marginTop: number;
  marginBottom: number;
  // Null pour le bundle hérité porté par le modèle lui-même.
  mockupId: string | null;
}

export async function listTemplateMockups(supabase: Supabase, templateId: string): Promise<TemplateMockup[]> {
  const { data } = await supabase
    .from("template_mockups")
    .select("*")
    .eq("template_id", templateId)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });
  return (data as TemplateMockup[]) ?? [];
}

/**
 * Marge de zone : fraction de la largeur (ou de la hauteur) du mesh rognée
 * d'un côté. Bornée
 * comme la contrainte SQL (migration 0052).
 */
export function parseZoneMarginValue(value: FormDataEntryValue | null): number {
  const n = parseFloat(String(value ?? ""));
  if (!Number.isFinite(n)) return 0;
  return Math.min(0.9, Math.max(0, n));
}

/**
 * Choisit le bundle mockup à rendre pour un modèle :
 * 1. `mockupId` fourni → ce mockup précis (et lui seul : si l'id ne
 *    correspond à rien, on ne rend pas un autre mockup à sa place) ;
 * 2. sinon le premier mockup du modèle (ordre `sort_order`) ;
 * 3. sinon le bundle hérité porté par `templates.beauty_shot_xml_path`.
 *
 * Retourne null quand le modèle n'a aucun bundle — l'appelant retombe
 * alors sur masque+ombrage ou sur le mockup générique de papeterie, comme
 * avant. Un modèle non migré se comporte donc exactement comme avant.
 */
export async function resolveMockupBundle(
  supabase: Supabase,
  template: TemplateBundleColumns,
  mockupId?: string | null
): Promise<ResolvedMockupBundle | null> {
  if (mockupId) {
    const { data } = await supabase
      .from("template_mockups")
      .select("*")
      .eq("id", mockupId)
      .eq("template_id", template.id)
      .maybeSingle();
    const row = data as TemplateMockup | null;
    if (!row) return null;
    return {
      xmlPath: row.xml_path,
      overlayOpacities: row.overlay_opacities,
      positionX: row.position_x,
      positionY: row.position_y,
      zoom: row.zoom,
      marginLeft: Number(row.margin_left) || 0,
      marginRight: Number(row.margin_right) || 0,
      marginTop: Number(row.margin_top) || 0,
      marginBottom: Number(row.margin_bottom) || 0,
      mockupId: row.id,
    };
  }

  const mockups = await listTemplateMockups(supabase, template.id);
  const first = mockups[0];
  if (first) {
    return {
      xmlPath: first.xml_path,
      overlayOpacities: first.overlay_opacities,
      positionX: first.position_x,
      positionY: first.position_y,
      zoom: first.zoom,
      marginLeft: Number(first.margin_left) || 0,
      marginRight: Number(first.margin_right) || 0,
      marginTop: Number(first.margin_top) || 0,
      marginBottom: Number(first.margin_bottom) || 0,
      mockupId: first.id,
    };
  }

  if (template.beauty_shot_xml_path) {
    return {
      xmlPath: template.beauty_shot_xml_path,
      overlayOpacities: template.beauty_shot_overlay_opacities,
      positionX: null,
      positionY: null,
      zoom: null,
      marginLeft: 0,
      marginRight: 0,
      marginTop: 0,
      marginBottom: 0,
      mockupId: null,
    };
  }

  return null;
}
