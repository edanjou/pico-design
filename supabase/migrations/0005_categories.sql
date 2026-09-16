-- Remplace la catégorie figée (check constraint) des modèles par une
-- table `categories` modifiable par les employés (créer/renommer/supprimer).
-- À exécuter dans Supabase : Dashboard > SQL Editor > coller ce fichier > Run

create table if not exists public.categories (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  created_at timestamptz not null default now()
);

alter table public.categories enable row level security;

create policy "Les employés lisent les catégories" on public.categories
  for select using (auth.role() = 'authenticated');
create policy "Les employés créent des catégories" on public.categories
  for insert with check (auth.role() = 'authenticated');
create policy "Les employés modifient des catégories" on public.categories
  for update using (auth.role() = 'authenticated');
create policy "Les employés suppriment des catégories" on public.categories
  for delete using (auth.role() = 'authenticated');

-- Reprend les 4 catégories existantes comme lignes de départ.
insert into public.categories (name) values
  ('Étuis de téléphone'),
  ('Tasses'),
  ('Papeterie'),
  ('Autres produits personnalisables')
on conflict (name) do nothing;

-- Ajoute la nouvelle colonne, la remplit à partir de l'ancienne, puis
-- bascule dessus.
alter table public.templates add column if not exists category_id uuid references public.categories(id);

update public.templates set category_id = (select id from public.categories where name = 'Étuis de téléphone')
  where category = 'etuis_telephone' and category_id is null;
update public.templates set category_id = (select id from public.categories where name = 'Tasses')
  where category = 'tasses' and category_id is null;
update public.templates set category_id = (select id from public.categories where name = 'Papeterie')
  where category = 'papeterie' and category_id is null;
update public.templates set category_id = (select id from public.categories where name = 'Autres produits personnalisables')
  where category = 'autre' and category_id is null;
-- filet de sécurité pour toute ligne qui aurait échappé au mapping ci-dessus
update public.templates set category_id = (select id from public.categories where name = 'Autres produits personnalisables')
  where category_id is null;

alter table public.templates alter column category_id set not null;
alter table public.templates drop column if exists category;
