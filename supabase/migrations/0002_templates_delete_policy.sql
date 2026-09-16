-- Ajoute la policy manquante pour permettre la suppression de modèles.
-- À exécuter dans Supabase : Dashboard > SQL Editor > coller ce fichier > Run

create policy "Les employés suppriment des modèles" on public.templates
  for delete using (auth.role() = 'authenticated');
