-- Figer le chemin de recherche de handle_new_user.
--
-- La fonction s'exécute en « security definer », donc avec les droits de son
-- propriétaire, mais sans `set search_path` : elle résout ses noms de tables
-- selon le chemin de recherche de l'APPELANT. Quiconque peut créer un objet
-- dans un schéma consulté avant `public` détourne alors l'insertion vers sa
-- propre table, avec des droits élevés. C'est ce que le linter Supabase
-- signale sous « function_search_path_mutable ».
--
-- Exploitation difficile ici — créer un schéma demande déjà des droits que
-- personne n'a — mais le correctif tient en une clause, et bump_rate_limit
-- (migration 0056) le fait déjà.
--
-- Le corps est identique à celui de la migration 0048 : seule la clause
-- `set search_path` est ajoutée. Le déclencheur on_auth_user_created pointe
-- sur la fonction par son nom, il n'y a donc rien à recréer de ce côté.
-- À exécuter dans Supabase : Dashboard > SQL Editor > coller ce fichier > Run

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, new.raw_user_meta_data->>'full_name');
  return new;
end;
$$;
