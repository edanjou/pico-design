-- Permet de choisir quel logo Pico appliquer sur un produit
-- (noir par défaut, blanc, ou icône cercle).
-- À exécuter dans Supabase : Dashboard > SQL Editor > coller ce fichier > Run

alter table public.products
  add column if not exists logo_variant text not null default 'noir'
    check (logo_variant in ('noir', 'blanc', 'icon_cercle'));
