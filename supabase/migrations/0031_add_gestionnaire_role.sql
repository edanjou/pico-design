-- Ajoute le rôle "gestionnaire" aux rôles possibles (admin, designer,
-- gestionnaire).
-- À exécuter dans Supabase : Dashboard > SQL Editor > coller ce fichier > Run

-- La contrainte est retirée avant toute conversion de données : tant que
-- l'ancienne contrainte (admin/employee) est active, elle bloque toute ligne
-- passée à "designer" ou "gestionnaire".
alter table public.profiles drop constraint if exists profiles_role_check;

-- Filet de sécurité si la migration 0030 (renommage "employee" -> "designer")
-- n'a pas été exécutée avant celle-ci.
update public.profiles set role = 'designer' where role = 'employee';

alter table public.profiles
  add constraint profiles_role_check check (role in ('admin', 'designer', 'gestionnaire'));
