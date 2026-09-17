-- Permet de choisir, par produit, si le logo Pico est affiché ou non —
-- indépendamment du réglage du modèle (qui décide seulement SI le modèle
-- supporte un logo, sur quel(s) côté(s)).
-- À exécuter dans Supabase : Dashboard > SQL Editor > coller ce fichier > Run

alter table public.products
  add column if not exists show_logo boolean not null default true;
