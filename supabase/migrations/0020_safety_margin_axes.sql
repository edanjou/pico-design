-- Sépare la marge de protection en deux axes indépendants (comme pour la
-- marge du logo, logo_margin_x_mm/logo_margin_y_mm) — certains formats
-- (ex. étuis de téléphone) ont besoin d'une marge seulement sur les côtés,
-- pas en haut/bas.
-- À exécuter dans Supabase : Dashboard > SQL Editor > coller ce fichier > Run

alter table public.templates
  add column if not exists safety_margin_x_mm numeric,
  add column if not exists safety_margin_y_mm numeric;

update public.templates
  set safety_margin_x_mm = safety_margin_mm, safety_margin_y_mm = safety_margin_mm
  where safety_margin_x_mm is null;

alter table public.templates
  alter column safety_margin_x_mm set not null,
  alter column safety_margin_x_mm set default 3.175,
  alter column safety_margin_y_mm set not null,
  alter column safety_margin_y_mm set default 3.175;

alter table public.templates drop column if exists safety_margin_mm;
