-- Module "Imposition" : catalogue des jobs de la Duplo (DC-618), importé depuis
-- le fichier « AllJobs » exporté par la machine. Chaque job est une
-- configuration de coupe pour une taille de feuille : les positions des traits
-- de refente (dans la largeur) et de coupe (dans la longueur), en mm. L'outil
-- d'imposition en tire la grille : les pièces sont placées entre ces traits.
-- Réimporter le fichier met le catalogue à jour (un job par numéro de job).
-- À exécuter dans Supabase : Dashboard > SQL Editor > coller ce fichier > Run

create table if not exists public.imposition_duplo_jobs (
  id uuid primary key default gen_random_uuid(),
  job_no integer not null unique check (job_no > 0),
  name text not null,
  width_mm numeric not null check (width_mm > 0),
  length_mm numeric not null check (length_mm > 0),
  slits numeric[] not null default '{}',
  cuts numeric[] not null default '{}',
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);

alter table public.imposition_duplo_jobs enable row level security;

create policy "Les employés lisent les jobs Duplo" on public.imposition_duplo_jobs
  for select using (auth.role() = 'authenticated');
create policy "Les employés créent des jobs Duplo" on public.imposition_duplo_jobs
  for insert with check (auth.role() = 'authenticated');
create policy "Les employés modifient des jobs Duplo" on public.imposition_duplo_jobs
  for update using (auth.role() = 'authenticated');
create policy "Les employés suppriment des jobs Duplo" on public.imposition_duplo_jobs
  for delete using (auth.role() = 'authenticated');
