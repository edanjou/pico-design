-- Module "Imposition" : profils de découpe de la Graphtec (CE8000-40).
-- La table imposition_cutters (0035) portait déjà les marges, l'espacement, la
-- calibration et le fichier de marques ; il lui manquait ce qu'un profil
-- Graphtec fixe en plus :
--   * sheet_id   : le format du papier. Un profil est réglé pour UNE feuille :
--                  ses marques et son gabarit sont dessinés à sa taille. Mis à
--                  null si la feuille est supprimée (le profil est alors à
--                  compléter, plutôt que d'empêcher la suppression).
--   * grid_cols / grid_rows : la grille de pièces, fixe. Avec les marges et
--                  l'espacement, elle donne la position exacte de chaque pièce,
--                  celle qu'attend le fichier de coupe de la Graphtec.
--   * guide_path : le gabarit de guidage (PDF ou image de la taille de la
--                  feuille), affiché en transparence dans l'aperçu pour vérifier
--                  le placement. Il n'est JAMAIS imprimé.
-- Le fichier de marques (marks_path, codes et repères lus par la Graphtec) est,
-- lui, imprimé au recto. Les deux vivent dans le bucket privé "imposition",
-- sous cutters/<id>/.
-- À exécuter dans Supabase : Dashboard > SQL Editor > coller ce fichier > Run

alter table public.imposition_cutters
  add column if not exists sheet_id uuid references public.imposition_sheets(id) on delete set null,
  add column if not exists grid_cols integer not null default 1 check (grid_cols between 1 and 50),
  add column if not exists grid_rows integer not null default 1 check (grid_rows between 1 and 50),
  add column if not exists guide_path text;
