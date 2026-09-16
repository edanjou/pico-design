-- Ajoute une catégorie aux modèles de produits.
-- À exécuter dans Supabase : Dashboard > SQL Editor > coller ce fichier > Run

alter table public.templates
  add column if not exists category text not null default 'autre'
    check (category in ('etuis_telephone', 'tasses', 'papeterie', 'autre'));
