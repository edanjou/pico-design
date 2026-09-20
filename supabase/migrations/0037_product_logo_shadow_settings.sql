-- Réglages de l'ombre portée du logo d'un produit (voir 0036) : flou et
-- distance en % de la largeur du logo, angle en degrés (0 = vers la droite,
-- 90 = vers le bas), opacité en %. Les valeurs par défaut reproduisent le
-- rendu de la première version de l'option.
-- À exécuter dans Supabase : Dashboard > SQL Editor > coller ce fichier > Run

alter table public.products
  add column if not exists logo_shadow_blur numeric not null default 2.5,
  add column if not exists logo_shadow_distance numeric not null default 3.2,
  add column if not exists logo_shadow_angle numeric not null default 68,
  add column if not exists logo_shadow_opacity numeric not null default 40;
