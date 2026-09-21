-- Module "Imposition" : position du code-barres du job Duplo sur la feuille.
-- Chaque job de la Duplo a son code-barres (un PDF par numéro de job, stocké
-- dans le bucket privé "imposition", dossier duplo-barcodes/). La machine le lit
-- pour reconnaître le job ; il est posé au recto, à la position réglée dans le
-- profil de découpeuse :
--   * barcode_x_mm / barcode_y_mm : coin haut-gauche du code-barres, en mm
--     depuis le coin haut-gauche de la feuille (comme à l'écran) ;
--   * barcode_rotation : rotation du code-barres, en degrés (sens antihoraire).
-- À exécuter dans Supabase : Dashboard > SQL Editor > coller ce fichier > Run

alter table public.imposition_cutters
  add column if not exists barcode_x_mm numeric not null default 0 check (barcode_x_mm >= 0),
  add column if not exists barcode_y_mm numeric not null default 0 check (barcode_y_mm >= 0),
  add column if not exists barcode_rotation smallint not null default 0
    check (barcode_rotation in (0, 90, 180, 270));
