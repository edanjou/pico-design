-- Module "Imposition" : repère REG (registration mark) des jobs de la Duplo.
-- Colonnes « REG mark », « Side mark » et « Lead mark » du fichier AllJobs :
--   * reg_mark : la machine lit un repère REG imprimé sur la feuille ;
--   * side_mark_mm / lead_mark_mm : distance (mm) du coin extérieur du repère
--     au bord latéral et au bord d'attaque de la feuille (6,4 mm par exemple).
-- Le repère est un L noir, posé dans le coin de la feuille réglé dans le profil
-- de découpeuse (le même que le code-barres). Réimporter l'AllJobs (Imposition
-- > Job Duplo > Gérer) renseigne ces colonnes pour les jobs déjà importés.
-- À exécuter dans Supabase : Dashboard > SQL Editor > coller ce fichier > Run

alter table public.imposition_duplo_jobs
  add column if not exists reg_mark boolean not null default false,
  add column if not exists side_mark_mm numeric not null default 0 check (side_mark_mm >= 0),
  add column if not exists lead_mark_mm numeric not null default 0 check (lead_mark_mm >= 0);
