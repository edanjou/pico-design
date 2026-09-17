import type { Template } from "../types";

/**
 * Retourne le modèle avec largeur/hauteur (et les marges qui ont un axe
 * x/y) inversées si `rotated`, pour utiliser un même modèle en portrait ou
 * en paysage selon le produit — sans modifier le modèle en base. Pure
 * fonction (pas de dépendance serveur), utilisable côté client et serveur.
 */
export function applyOrientation(template: Template, rotated: boolean): Template {
  if (!rotated) return template;
  return {
    ...template,
    width_mm: template.height_mm,
    height_mm: template.width_mm,
    safety_margin_x_mm: template.safety_margin_y_mm,
    safety_margin_y_mm: template.safety_margin_x_mm,
    print_margin_x_mm: template.print_margin_y_mm,
    print_margin_y_mm: template.print_margin_x_mm,
    logo_margin_x_mm: template.logo_margin_y_mm,
    logo_margin_y_mm: template.logo_margin_x_mm,
  };
}

export function isLandscape(widthMm: number, heightMm: number): boolean {
  return widthMm >= heightMm;
}
