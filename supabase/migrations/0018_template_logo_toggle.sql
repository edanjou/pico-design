-- Certains modèles ne doivent pas porter le logo Pico du tout, ou seulement
-- sur une des deux faces (modèles recto-verso). "logo_on_front" et
-- "logo_on_back" contrôlent si le logo est composé sur chaque face lors de
-- la génération du PDF (logo_on_back n'a d'effet que si two_sided = true).
-- À exécuter dans Supabase : Dashboard > SQL Editor > coller ce fichier > Run

alter table public.templates
  add column if not exists logo_on_front boolean not null default true,
  add column if not exists logo_on_back boolean not null default false;
