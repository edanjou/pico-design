-- Module "Imposition" : le code-barres du job Duplo est ancré à un COIN de la
-- feuille (comme dans les gabarits Fiery Impose), pas mesuré depuis la gauche :
-- sa position ne dépend ainsi pas de la largeur de la feuille (12 po, 13 po…).
--   * barcode_corner : coin d'ancrage ('top-left', 'top-right', 'bottom-left',
--     'bottom-right') ;
--   * barcode_x_mm : distance entre le bord (gauche ou droit) le plus proche de
--     ce coin et le côté du code-barres qui lui fait face ;
--   * barcode_y_mm : idem pour le bord haut ou bas ;
--   * barcode_rotation : rotation du code-barres, en degrés (sens antihoraire).
-- Valeurs par défaut : mesurées sur une feuille imposée par Fiery pour la Duplo
-- (job 241, 12 x 18 po) : barres du code-barres en haut à droite, sans rotation,
-- à 5 mm du haut ; leur centre est à 42,5 mm du bord droit, donc un code-barres
-- de 25 mm de large (PDF des jobs) est à 30 mm du bord droit.
-- Peut s'exécuter que la migration 0039 ait déjà été appliquée ou non.
-- À exécuter dans Supabase : Dashboard > SQL Editor > coller ce fichier > Run

alter table public.imposition_cutters
  add column if not exists barcode_x_mm numeric not null default 30 check (barcode_x_mm >= 0),
  add column if not exists barcode_y_mm numeric not null default 5 check (barcode_y_mm >= 0),
  add column if not exists barcode_rotation smallint not null default 0
    check (barcode_rotation in (0, 90, 180, 270)),
  add column if not exists barcode_corner text not null default 'top-right'
    check (barcode_corner in ('top-left', 'top-right', 'bottom-left', 'bottom-right'));

alter table public.imposition_cutters
  alter column barcode_x_mm set default 30,
  alter column barcode_y_mm set default 5;

-- Les profils dont la position n'avait jamais été réglée (0 / 0 de la 0039)
-- prennent les valeurs par défaut.
update public.imposition_cutters
set barcode_x_mm = 30, barcode_y_mm = 5, barcode_corner = 'top-right'
where barcode_x_mm = 0 and barcode_y_mm = 0 and barcode_rotation = 0;
