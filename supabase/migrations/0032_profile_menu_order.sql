-- Ordre personnalisé des tuiles du tableau de bord / liens de la nav,
-- propre à chaque utilisateur (tableau de clés, ex. '{templates,products}').
-- null = ordre par défaut.
-- À exécuter dans Supabase : Dashboard > SQL Editor > coller ce fichier > Run

alter table public.profiles
  add column if not exists menu_order text[];
