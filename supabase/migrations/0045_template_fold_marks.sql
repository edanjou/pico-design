-- Marques de pli (repères visuels pour prévisualiser où le produit sera
-- plié) : distances en mm depuis le bord (bordure de coupe), une par pli,
-- pour chaque axe — un pli "vertical" est une ligne verticale (divise la
-- largeur), un pli "horizontal" une ligne horizontale (divise la hauteur).
-- Affichées SEULEMENT en aperçu écran (comme la ligne de coupe/marge de
-- sécurité) — jamais incluses dans le PDF imprimé, voir generateTemplatePreviewPng.
-- null/tableau vide = aucune marque (comportement actuel, inchangé).
-- À exécuter dans Supabase : Dashboard > SQL Editor > coller ce fichier > Run

alter table public.templates
  add column if not exists fold_marks_vertical_mm numeric[],
  add column if not exists fold_marks_horizontal_mm numeric[];
