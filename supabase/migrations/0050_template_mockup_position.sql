-- Point de cadrage horizontal du visuel, par mockup : sur un produit dont
-- le visuel fait le tour (une tasse), chaque angle de prise de vue montre
-- une tranche différente du même visuel. C'est la même notion que le
-- `positionX` d'un recadrage « cover » (voir coverCropToBuffer) :
--   0   = bord gauche du visuel   -> vue de DROITE du produit
--   0.5 = milieu                  -> vue de FACE
--   1   = bord droit du visuel    -> vue de GAUCHE
-- 0.5 par défaut : c'est déjà la valeur utilisée jusqu'ici, donc les
-- mockups existants ne changent pas d'aspect.
-- À exécuter dans Supabase : Dashboard > SQL Editor > coller ce fichier > Run

alter table public.template_mockups
  add column if not exists position_x numeric not null default 0.5;

alter table public.template_mockups
  drop constraint if exists template_mockups_position_x_check;
alter table public.template_mockups
  add constraint template_mockups_position_x_check check (position_x >= 0 and position_x <= 1);
