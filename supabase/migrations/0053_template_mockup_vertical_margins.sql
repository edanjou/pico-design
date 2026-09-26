-- Marges haut/bas de la zone, pendant vertical de margin_left/margin_right
-- (migration 0052). Sans elles, la HAUTEUR du visuel est étalée sur toute la
-- scène alors que le produit n'en occupe qu'une partie : sur une tasse dont
-- le masque va de 21 % à 81 % de la hauteur, le visuel se retrouve agrandi
-- d'environ 1,65×. Exprimées en fraction de la hauteur de la zone.
-- 0 par défaut = comportement actuel, aucun mockup existant ne bouge.
-- À exécuter dans Supabase : Dashboard > SQL Editor > coller ce fichier > Run

alter table public.template_mockups
  add column if not exists margin_top numeric not null default 0;
alter table public.template_mockups
  add column if not exists margin_bottom numeric not null default 0;

alter table public.template_mockups
  drop constraint if exists template_mockups_vmargins_check;
alter table public.template_mockups
  add constraint template_mockups_vmargins_check check (
    margin_top >= 0 and margin_top <= 0.9
    and margin_bottom >= 0 and margin_bottom <= 0.9
    and margin_top + margin_bottom <= 0.9
  );
