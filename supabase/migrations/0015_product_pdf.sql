-- Chemin (bucket "outputs") du PDF prêt-pour-impression généré
-- automatiquement à chaque enregistrement d'un produit.
-- À exécuter dans Supabase : Dashboard > SQL Editor > coller ce fichier > Run

alter table public.products
  add column if not exists pdf_path text;
