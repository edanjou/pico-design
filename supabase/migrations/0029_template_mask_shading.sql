-- Deux fichiers PNG optionnels par modèle, pour créer des mockups (étuis de
-- téléphone notamment) : le masque et l'ombrage. Pour l'instant, uniquement
-- stockés — pas encore utilisés dans l'aperçu ni le PDF généré.
-- À exécuter dans Supabase : Dashboard > SQL Editor > coller ce fichier > Run

alter table public.templates
  add column if not exists mask_path text,
  add column if not exists shading_path text;
