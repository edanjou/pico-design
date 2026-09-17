-- Permet de désactiver, par modèle, la possibilité de basculer un produit
-- en portrait/paysage (ex. gabarit de guidage ou dimensions qui n'ont pas
-- de sens inversées). Actif par défaut pour rester compatible avec le
-- comportement actuel.
-- À exécuter dans Supabase : Dashboard > SQL Editor > coller ce fichier > Run

alter table public.templates
  add column if not exists allow_orientation_change boolean not null default true;
