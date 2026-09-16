-- Ajoute la marge de protection (safety margin) : zone à l'intérieur du
-- bord de coupe où le contenu important ne devrait pas se trouver.
-- Distincte du fond perdu (bleed), qui déborde vers l'extérieur.
-- À exécuter dans Supabase : Dashboard > SQL Editor > coller ce fichier > Run

alter table public.templates
  add column if not exists safety_margin_mm numeric not null default 3.175;
