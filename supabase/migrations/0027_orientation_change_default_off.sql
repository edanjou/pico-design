-- Le changement d'orientation (portrait/paysage) est désactivé par défaut
-- pour les modèles, plutôt qu'activé — à activer explicitement par modèle
-- quand ça a du sens.
-- À exécuter dans Supabase : Dashboard > SQL Editor > coller ce fichier > Run

alter table public.templates alter column allow_orientation_change set default false;
update public.templates set allow_orientation_change = false;
