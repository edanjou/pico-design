-- Option "ombre portée" sur le logo Pico / la pastille d'un produit : une
-- ombre douce (noire, décalée vers le bas à droite) dessinée derrière le
-- logo sur le PDF, l'aperçu et les mockups.
-- À exécuter dans Supabase : Dashboard > SQL Editor > coller ce fichier > Run

alter table public.products
  add column if not exists logo_shadow boolean not null default false;
