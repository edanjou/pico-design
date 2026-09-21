-- Module "Imposition" : chaque profil de découpeuse est rattaché à une machine.
--   * 'duplo'    : la Duplo. L'outil ne la règle pas : la grille, le repère REG
--                  et le code-barres viennent de son catalogue de jobs (fichier
--                  AllJobs + PDF de codes-barres importés).
--   * 'graphtec' : la Graphtec CE8000-40. Comportement d'origine du profil
--                  (marges, espacement, calibration, fichier de marques).
-- Les profils existants passent en 'graphtec' : ils fonctionnent exactement
-- comme avant. Modifiez-en un et choisissez « Duplo » pour utiliser les jobs.
-- La position du code-barres et du repère REG n'est plus un réglage : elle est
-- fixe (mesurée sur les feuilles Fiery de la Duplo), les colonnes de la 0039 et
-- de la 0040 sont donc supprimées.
-- À exécuter dans Supabase : Dashboard > SQL Editor > coller ce fichier > Run

alter table public.imposition_cutters
  add column if not exists machine text not null default 'graphtec'
    check (machine in ('duplo', 'graphtec'));

alter table public.imposition_cutters
  drop column if exists barcode_x_mm,
  drop column if exists barcode_y_mm,
  drop column if exists barcode_rotation,
  drop column if exists barcode_corner;
