-- Module "Autocollants" : un modèle peut se relier à un profil de découpe
-- Graphtec (imposition_cutters). Il en reprend alors la feuille, les marges
-- (le visuel de la planche est posé à l'intérieur), la calibration (visuel et
-- noms décalés ensemble) et les codes Graphtec (imprimés sur toute la feuille).
--   * cutter_id : le profil, ou null (la planche occupe toute la feuille,
--                 comme avant). Mis à null si le profil est supprimé.
-- Les zones de nom restent mesurées depuis le coin du visuel : sans profil, ce
-- coin est celui de la feuille, rien ne change pour les modèles existants.
-- À exécuter dans Supabase : Dashboard > SQL Editor > coller ce fichier > Run

alter table public.sticker_templates
  add column if not exists cutter_id uuid references public.imposition_cutters(id) on delete set null;
