-- Permet d'utiliser un même modèle en portrait ou en paysage selon le
-- produit, sans dupliquer le modèle : `rotated` inverse largeur/hauteur
-- (et les marges avec un axe x/y) uniquement pour ce produit, au moment de
-- l'aperçu et de la génération du PDF.
-- À exécuter dans Supabase : Dashboard > SQL Editor > coller ce fichier > Run

alter table public.products
  add column if not exists rotated boolean not null default false;
