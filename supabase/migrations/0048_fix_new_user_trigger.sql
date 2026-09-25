-- Correctif : « Database error creating new user » à la création d'un
-- compte (page Utilisateurs) — le déclencheur qui crée automatiquement le
-- profil à l'inscription (handle_new_user/on_auth_user_created, voir
-- 0001_init.sql) échoue, probablement parce que la migration 0030 et/ou
-- 0031 (rôles designer/gestionnaire) n'a été appliquée que partiellement :
-- la contrainte profiles_role_check et/ou le défaut de la colonne role
-- restent alors décalés par rapport à ce que le reste de l'app attend.
-- Recrée le déclencheur proprement et remet la contrainte/le défaut à
-- l'état attendu — sûr à relancer plusieurs fois, ne touche à aucune
-- donnée existante à part les anciennes lignes encore sur "employee".
-- À exécuter dans Supabase : Dashboard > SQL Editor > coller ce fichier > Run

create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, new.raw_user_meta_data->>'full_name');
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

update public.profiles set role = 'designer' where role = 'employee';

alter table public.profiles drop constraint if exists profiles_role_check;
alter table public.profiles
  add constraint profiles_role_check check (role in ('admin', 'designer', 'gestionnaire'));

alter table public.profiles alter column role set default 'designer';
