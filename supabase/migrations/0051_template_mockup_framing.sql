-- Cadrage complet du visuel dans la zone d'un mockup, en complément de
-- position_x (migration 0050) : la position verticale et l'échelle.
--   position_y : 0 = haut du visuel, 0.5 = milieu, 1 = bas
--   zoom       : 1 = le visuel remplit tout juste la zone (« cover »),
--                1.5 = agrandi de 50 % puis recadré, etc.
-- Valeurs par défaut = comportement actuel, donc les 43 mockups existants
-- ne changent pas d'aspect. Voir coverCropToBuffer.
-- À exécuter dans Supabase : Dashboard > SQL Editor > coller ce fichier > Run

alter table public.template_mockups
  add column if not exists position_y numeric not null default 0.5;

alter table public.template_mockups
  drop constraint if exists template_mockups_position_y_check;
alter table public.template_mockups
  add constraint template_mockups_position_y_check check (position_y >= 0 and position_y <= 1);

alter table public.template_mockups
  add column if not exists zoom numeric not null default 1;

-- Plafond à 5 (500 %) : au-delà, le recadrage ne montre plus qu'une bouillie
-- de pixels agrandis. Plancher à 1 : sous « cover », la zone ne serait plus
-- entièrement couverte.
alter table public.template_mockups
  drop constraint if exists template_mockups_zoom_check;
alter table public.template_mockups
  add constraint template_mockups_zoom_check check (zoom >= 1 and zoom <= 5);
