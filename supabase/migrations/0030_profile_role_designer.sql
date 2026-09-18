-- Renomme le rôle "employee" en "designer" (reflète mieux le métier des
-- comptes non-admin de l'app).
-- À exécuter dans Supabase : Dashboard > SQL Editor > coller ce fichier > Run

update public.profiles set role = 'designer' where role = 'employee';

alter table public.profiles drop constraint if exists profiles_role_check;
alter table public.profiles
  add constraint profiles_role_check check (role in ('admin', 'designer'));

alter table public.profiles alter column role set default 'designer';
